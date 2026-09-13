import type { PaLogicalCard } from '@riftbound/contracts';
import type { S3Client } from 'bun';
import type { Env } from '../env.js';
import { readCappedResponseBody } from '../lib/capped-body.js';
import { resizeImageToWebp } from '../lib/image-resize-buffer.js';
import {
  canResizeKey,
  thumbStorageKey,
  type AllowedThumbWidth,
} from '../lib/image-resize.js';
import { createSlidingWindowLimiter } from '../lib/rate-limit.js';
import { TtlCache } from '../lib/ttl-cache.js';
import {
  cdnImageUrl,
  createS3Client,
  hasS3Config,
  isSafeImageKey,
  rewriteCardImageUrls,
  rewriteImageUrl,
  safeServedContentType,
} from '../lib/s3.js';

type CachedImage = {
  body: ArrayBuffer;
  contentType: string;
  etag: string;
};

export type ServeImageResult =
  | {
      kind: 'body';
      body: ArrayBuffer;
      contentType: string;
      source: 's3' | 'memory';
      etag: string;
    }
  | { kind: 'redirect'; url: string };

export type ServeImageOptions = {
  width?: AllowedThumbWidth;
  clientIp?: string;
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_MEMORY_CACHE_MAX_BYTES = 128 * 1024 * 1024;
export const IMAGE_MEMORY_CACHE_MAX_ENTRIES = 2000;
export const CDN_MISS_WINDOW_MS = 60_000;
export const CDN_MISS_PER_IP_MAX = 120;
export const CDN_MISS_GLOBAL_MAX = 600;

export type ImageStoreLimits = {
  maxImageBytes?: number;
  memoryMaxEntries?: number;
  memoryMaxBytes?: number;
  cdnMissPerIpMax?: number;
  cdnMissGlobalMax?: number;
};

const MEMORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const S3_MISS_CACHE_TTL_MS = 60 * 1000;

function imageEtag(key: string, byteLength: number): string {
  return `"${key}:${String(byteLength)}"`;
}

export class ImageStoreService {
  private readonly client: S3Client | null;
  private readonly memoryCache: TtlCache<CachedImage>;
  private readonly s3MissCache = new TtlCache<true>(S3_MISS_CACHE_TTL_MS, 5000);
  private readonly serveInflight = new Map<string, Promise<ServeImageResult | null>>();
  private readonly backgroundInflight = new Set<string>();
  private readonly maxImageBytes: number;
  private readonly cdnMissByIp: ReturnType<typeof createSlidingWindowLimiter>;
  private readonly cdnMissGlobal: ReturnType<typeof createSlidingWindowLimiter>;

  constructor(
    private readonly env: Env,
    limits: ImageStoreLimits = {}
  ) {
    this.maxImageBytes = limits.maxImageBytes ?? MAX_IMAGE_BYTES;
    this.memoryCache = new TtlCache<CachedImage>(
      MEMORY_CACHE_TTL_MS,
      limits.memoryMaxEntries ?? IMAGE_MEMORY_CACHE_MAX_ENTRIES,
      {
        maxBytes: limits.memoryMaxBytes ?? IMAGE_MEMORY_CACHE_MAX_BYTES,
        sizeOf: (image) => image.body.byteLength,
      }
    );
    this.cdnMissByIp = createSlidingWindowLimiter({
      windowMs: CDN_MISS_WINDOW_MS,
      max: limits.cdnMissPerIpMax ?? CDN_MISS_PER_IP_MAX,
    });
    this.cdnMissGlobal = createSlidingWindowLimiter({
      windowMs: CDN_MISS_WINDOW_MS,
      max: limits.cdnMissGlobalMax ?? CDN_MISS_GLOBAL_MAX,
    });

    if (hasS3Config(env)) {
      this.client = createS3Client(env);
      console.log(
        `[s3] Image cache enabled (bucket=${env.S3_BUCKET}, lazy background fill)`
      );
    } else {
      this.client = null;
      console.log('[s3] Image cache disabled (S3 env vars not fully configured)');
    }
  }

  private sharpRunning = 0;
  private sharpQueued = 0;
  private readonly sharpWaiters: Array<() => void> = [];

  private static readonly SHARP_MAX = 2;
  private static readonly SHARP_MAX_QUEUE = 8;

  private async resizeWithLimit(
    body: ArrayBuffer,
    width: AllowedThumbWidth
  ): Promise<ArrayBuffer | null> {
    if (this.sharpQueued >= ImageStoreService.SHARP_MAX_QUEUE) {
      return null;
    }
    this.sharpQueued += 1;
    try {
      while (this.sharpRunning >= ImageStoreService.SHARP_MAX) {
        await new Promise<void>((resolve) => {
          this.sharpWaiters.push(resolve);
        });
      }
      this.sharpRunning += 1;
      try {
        return await resizeImageToWebp(body, width);
      } finally {
        this.sharpRunning -= 1;
        this.sharpWaiters.shift()?.();
      }
    } finally {
      this.sharpQueued -= 1;
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  rewriteImageUrl(url: string): string {
    return rewriteImageUrl(this.env, url);
  }

  rewriteCard(card: PaLogicalCard): PaLogicalCard {
    return rewriteCardImageUrls(this.env, card);
  }

  async serveImage(
    key: string,
    options?: ServeImageOptions
  ): Promise<ServeImageResult | null> {
    const normalizedKey = key.replace(/^\//, '');
    if (!isSafeImageKey(normalizedKey) || normalizedKey.startsWith('thumbs/'))
      return null;

    const width = options?.width;
    if (width != null && canResizeKey(normalizedKey)) {
      return this.serveResizedImage(normalizedKey, width, options?.clientIp);
    }

    return this.serveOriginalImage(normalizedKey, options?.clientIp);
  }

  private async serveResizedImage(
    sourceKey: string,
    width: AllowedThumbWidth,
    clientIp: string | undefined
  ): Promise<ServeImageResult | null> {
    const derivativeKey = thumbStorageKey(sourceKey, width);
    const cached = this.readMemoryCache(derivativeKey);
    if (cached) return cached;

    const inflightKey = `thumb:${derivativeKey}`;
    const inflight = this.serveInflight.get(inflightKey);
    if (inflight) return inflight;

    const promise = this.buildResizedImage(sourceKey, width, derivativeKey, clientIp);
    this.serveInflight.set(inflightKey, promise);
    try {
      return await promise;
    } finally {
      this.serveInflight.delete(inflightKey);
    }
  }

  private async buildResizedImage(
    sourceKey: string,
    width: AllowedThumbWidth,
    derivativeKey: string,
    clientIp: string | undefined
  ): Promise<ServeImageResult | null> {
    const stored = await this.loadStoredBody(derivativeKey);
    if (stored) {
      return this.storeInMemoryCache(
        derivativeKey,
        stored.body,
        stored.contentType,
        's3'
      );
    }

    const original = await this.loadOriginalBody(sourceKey, clientIp);
    if (!original) return null;

    const resized = await this.resizeWithLimit(original.body, width);
    if (!resized) {
      return this.storeInMemoryCache(
        sourceKey,
        original.body,
        original.contentType,
        'memory'
      );
    }

    const contentType = 'image/webp';

    if (this.client) {
      try {
        await this.client.write(derivativeKey, resized, { type: contentType });
        this.s3MissCache.delete(derivativeKey);
      } catch (err) {
        console.warn(`[s3] Thumb write failed for ${derivativeKey}:`, err);
      }
    }

    return this.storeInMemoryCache(derivativeKey, resized, contentType, 'memory');
  }

  private async serveOriginalImage(
    normalizedKey: string,
    clientIp: string | undefined
  ): Promise<ServeImageResult | null> {
    const cached = this.readMemoryCache(normalizedKey);
    if (cached) return cached;

    const inflight = this.serveInflight.get(normalizedKey);
    if (inflight) return inflight;

    const promise = this.resolveOriginalImage(normalizedKey, clientIp);
    this.serveInflight.set(normalizedKey, promise);
    try {
      return await promise;
    } finally {
      this.serveInflight.delete(normalizedKey);
    }
  }

  private readMemoryCache(key: string): ServeImageResult | null {
    const cached = this.memoryCache.get(key);
    if (!cached) return null;
    return {
      kind: 'body',
      body: cached.body,
      contentType: cached.contentType,
      source: 'memory',
      etag: cached.etag,
    };
  }

  private storeInMemoryCache(
    key: string,
    body: ArrayBuffer,
    contentType: string,
    source: 's3' | 'memory'
  ): ServeImageResult {
    const etag = imageEtag(key, body.byteLength);
    this.memoryCache.set(key, { body, contentType, etag });
    return { kind: 'body', body, contentType, source, etag };
  }

  private allowCdnMiss(clientIp: string | undefined): boolean {
    const ip = clientIp && clientIp.length > 0 ? clientIp : 'unknown';
    if (!this.cdnMissByIp.check(ip).allowed) return false;
    return this.cdnMissGlobal.check('cdn').allowed;
  }

  private async resolveOriginalImage(
    key: string,
    clientIp: string | undefined
  ): Promise<ServeImageResult | null> {
    const stored = await this.loadStoredBody(key);
    if (stored) {
      return this.storeInMemoryCache(key, stored.body, stored.contentType, 's3');
    }

    const cdnUrl = cdnImageUrl(key);
    const fetched = await this.fetchCdnBody(key, cdnUrl, clientIp);
    if (!fetched) return { kind: 'redirect', url: cdnUrl };

    if (this.client) {
      this.scheduleBackgroundStore(key, cdnUrl);
    }

    return this.storeInMemoryCache(key, fetched.body, fetched.contentType, 'memory');
  }

  private async loadOriginalBody(
    key: string,
    clientIp: string | undefined
  ): Promise<{ body: ArrayBuffer; contentType: string } | null> {
    const stored = await this.loadStoredBody(key);
    if (stored) return stored;

    const cdnUrl = cdnImageUrl(key);
    const fetched = await this.fetchCdnBody(key, cdnUrl, clientIp);
    if (!fetched) return null;

    if (this.client) {
      this.scheduleBackgroundStore(key, cdnUrl);
    }
    return fetched;
  }

  private async fetchCdnBody(
    key: string,
    cdnUrl: string,
    clientIp: string | undefined
  ): Promise<{ body: ArrayBuffer; contentType: string } | null> {
    if (!this.allowCdnMiss(clientIp)) return null;

    try {
      const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const body = await readCappedResponseBody(res, this.maxImageBytes);
      if (!body) return null;
      return {
        body,
        contentType: safeServedContentType(
          res.headers.get('content-type')?.split(';')[0]?.trim(),
          key
        ),
      };
    } catch {
      return null;
    }
  }

  private async loadStoredBody(
    key: string
  ): Promise<{ body: ArrayBuffer; contentType: string } | null> {
    if (this.client && !this.s3MissCache.has(key)) {
      try {
        const stat = await this.client.stat(key);
        const size = typeof stat.size === 'number' ? stat.size : undefined;
        if (size === 0) {
          this.s3MissCache.set(key, true);
          return null;
        }
        if (size != null && size > this.maxImageBytes) return null;

        const file = this.client.file(key);
        const body = await file.arrayBuffer();
        if (body.byteLength === 0) {
          this.s3MissCache.set(key, true);
          return null;
        }
        if (body.byteLength > this.maxImageBytes) return null;
        const contentType = safeServedContentType(
          typeof stat.type === 'string' && stat.type.length > 0 ? stat.type : undefined,
          key
        );
        return { body, contentType };
      } catch {
        this.s3MissCache.set(key, true);
      }
    }
    return null;
  }

  private scheduleBackgroundStore(key: string, cdnUrl: string): void {
    if (this.backgroundInflight.has(key)) return;

    this.backgroundInflight.add(key);
    void this.storeFromCdn(key, cdnUrl)
      .catch((err) => {
        console.warn(`[s3] Background save failed for ${key}:`, err);
      })
      .finally(() => {
        this.backgroundInflight.delete(key);
      });
  }

  private async storeFromCdn(key: string, cdnUrl: string): Promise<void> {
    if (!this.client) return;

    try {
      const stat = await this.client.stat(key);
      if (typeof stat.size === 'number' && stat.size > 0) {
        this.s3MissCache.delete(key);
        return;
      }
    } catch {
      // Object is absent; download from the CDN.
    }

    console.log(`[s3] Background download: ${cdnUrl}`);
    const res = await fetch(cdnUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      throw new Error(`CDN download failed with status ${String(res.status)}`);
    }

    const body = await readCappedResponseBody(res, this.maxImageBytes);
    if (!body) {
      throw new Error(`CDN download exceeded ${String(this.maxImageBytes)} bytes`);
    }
    const contentType = safeServedContentType(
      res.headers.get('content-type')?.split(';')[0]?.trim(),
      key
    );

    await this.client.write(key, body, {
      type: contentType,
    });

    this.storeInMemoryCache(key, body, contentType, 'memory');
    this.s3MissCache.delete(key);

    console.log(
      `[s3] Background saved s3://${this.env.S3_BUCKET}/${key} (${String(body.byteLength)} bytes)`
    );
  }
}
