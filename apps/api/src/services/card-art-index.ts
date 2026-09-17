import {
  ART_BIT_BYTES,
  ART_DESCRIPTOR_VERSION,
  ART_IMAGE_HEIGHT,
  ART_IMAGE_WIDTH,
  ART_TRIM_INSET,
  ART_VECTOR_DIMENSION,
  artIndexKey,
  describeCardPixels,
  packArtIndex,
  type ArtIndexMeta,
  type ArtIndexRecord,
} from '@riftbound/contracts';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import type { Database } from '../db/client.js';
import { cardArtFingerprints, variants } from '../db/schema.js';
import { entityHash } from '../lib/hash.js';
import type { ImageStoreService } from './image-store.js';

/**
 * The reference side of visual card scanning.
 *
 * Every catalog image is reduced to a few hundred bytes describing what it looks like,
 * once, here — rather than on every phone that opens the scanner. Apple's own image
 * embedding cannot be used for this because its vectors are only comparable within one
 * OS revision, which is what forced the previous attempt to download the whole catalog
 * of artwork to each device and embed it there.
 */

/** How many images one backfill pass will fetch and describe. */
export const ART_BACKFILL_BATCH = 200;
/** Concurrent image fetches. The sharp work behind them is already capped downstream. */
const FETCH_CONCURRENCY = 4;

export type ArtIndexPayload = {
  bytes: Uint8Array;
  meta: ArtIndexMeta;
};

type FingerprintRow = {
  imageKey: string;
  vector: string;
  bits: string;
};

/**
 * Reduce one catalog image to the canonical card face the descriptor is defined over.
 *
 * The trim comes first and at full resolution, so the black border and any stray
 * background are gone before the resize averages pixels together. `fit: 'fill'` because
 * the aspect is already 5:7 and a card photographed at a slight angle rectifies to the
 * same frame on the device; letterboxing either side would put grey bars in the
 * descriptor.
 */
export async function renderCanonicalFace(image: ArrayBuffer): Promise<Uint8Array> {
  const source = sharp(Buffer.from(image), { failOn: 'none' }).rotate();
  const { width, height } = await source.metadata();
  if (!width || !height) throw new Error('Card image has no dimensions');

  const inset = {
    left: Math.round(width * ART_TRIM_INSET),
    top: Math.round(height * ART_TRIM_INSET),
  };
  const { data } = await source
    .extract({
      left: inset.left,
      top: inset.top,
      width: Math.max(1, width - inset.left * 2),
      height: Math.max(1, height - inset.top * 2),
    })
    .resize({
      width: ART_IMAGE_WIDTH,
      height: ART_IMAGE_HEIGHT,
      fit: 'fill',
      kernel: 'lanczos3',
    })
    // No colour management and no alpha: the descriptor is defined over raw sRGB bytes
    // so that CoreImage on the device arrives at the same numbers.
    .toColorspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

export class CardArtIndexService {
  private cached: { hash: string; payload: ArtIndexPayload } | null = null;

  constructor(
    private readonly db: Database,
    private readonly images: ImageStoreService
  ) {}

  /** Every distinct image the catalog points at, in a stable order. */
  private async catalogImageKeys(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ imageUrl: variants.imageUrl })
      .from(variants);

    const keys = new Set<string>();
    for (const row of rows) {
      const key = artIndexKey(row.imageUrl);
      if (key) keys.add(key);
    }
    return [...keys].sort();
  }

  /**
   * Describe catalog images that have no current fingerprint yet, up to `limit`.
   *
   * Bounded per call, like the search-embedding backfill it runs beside: the first pass
   * over a fresh catalog has to download every card image, and that should spread over
   * several sync runs rather than hold one open.
   */
  async backfillMissing(limit = ART_BACKFILL_BATCH): Promise<number> {
    const keys = await this.catalogImageKeys();
    if (keys.length === 0) return 0;

    const current = await this.freshFingerprintKeys();
    const missing = keys.filter((key) => !current.has(key)).slice(0, limit);
    if (missing.length === 0) return 0;

    let described = 0;
    const queue = [...missing];
    const worker = async () => {
      for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
        const record = await this.describeImage(key);
        if (!record) continue;
        await this.db
          .insert(cardArtFingerprints)
          .values({
            imageKey: key,
            descriptorVersion: ART_DESCRIPTOR_VERSION,
            vector: encode(record.vector),
            bits: encode(record.bits),
            computedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: cardArtFingerprints.imageKey,
            set: {
              descriptorVersion: ART_DESCRIPTOR_VERSION,
              vector: encode(record.vector),
              bits: encode(record.bits),
              computedAt: new Date(),
            },
          });
        described += 1;
      }
    };
    await Promise.all(Array.from({ length: FETCH_CONCURRENCY }, worker));

    if (described > 0) this.invalidate();
    return described;
  }

  /** Keys already described by the current descriptor version. */
  private async freshFingerprintKeys(): Promise<Set<string>> {
    const rows = await this.db
      .select({ imageKey: cardArtFingerprints.imageKey })
      .from(cardArtFingerprints)
      .where(eq(cardArtFingerprints.descriptorVersion, ART_DESCRIPTOR_VERSION));
    return new Set(rows.map((row) => row.imageKey));
  }

  private async describeImage(key: string): Promise<ArtIndexRecord | null> {
    try {
      const body = await this.loadImage(key);
      if (!body) return null;
      const face = await renderCanonicalFace(body);
      return { key, ...describeCardPixels(face) };
    } catch (error) {
      console.warn(`[art-index] Could not describe ${key}:`, error);
      return null;
    }
  }

  private async loadImage(key: string): Promise<ArrayBuffer | null> {
    const served = await this.images.serveImage(key);
    if (!served) return null;
    if (served.kind === 'body') return served.body;

    const response = await fetch(served.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;
    return response.arrayBuffer();
  }

  /**
   * The packed index the device installs, with the hash it checks staleness against.
   *
   * Descriptors are a pure function of the image key and the descriptor version, so the
   * key list and that version identify the payload completely — no need to hash
   * megabytes of vectors to know whether a client is up to date.
   */
  async getIndex(): Promise<ArtIndexPayload> {
    const keys = await this.catalogImageKeys();
    const hash = entityHash({ version: ART_DESCRIPTOR_VERSION, keys });
    if (this.cached?.hash === hash) return this.cached.payload;

    const rows = await this.db
      .select({
        imageKey: cardArtFingerprints.imageKey,
        vector: cardArtFingerprints.vector,
        bits: cardArtFingerprints.bits,
      })
      .from(cardArtFingerprints)
      .where(eq(cardArtFingerprints.descriptorVersion, ART_DESCRIPTOR_VERSION));

    const wanted = new Set(keys);
    const records: ArtIndexRecord[] = [];
    for (const row of rows) {
      if (!wanted.has(row.imageKey)) continue;
      const record = decodeRow(row);
      if (record) records.push(record);
    }
    records.sort((left, right) => (left.key < right.key ? -1 : 1));

    const bytes = packArtIndex(records);
    const payload: ArtIndexPayload = {
      bytes,
      meta: {
        descriptorVersion: ART_DESCRIPTOR_VERSION,
        // The served index is what the client caches, so the hash names its contents,
        // not the catalog it was meant to cover.
        indexHash: entityHash({
          version: ART_DESCRIPTOR_VERSION,
          keys: records.map((record) => record.key),
        }),
        count: records.length,
        bytes: bytes.length,
      },
    };
    this.cached = { hash, payload };
    return payload;
  }

  /** Cheap enough to call on every request that needs only the staleness check. */
  async getMeta(): Promise<ArtIndexMeta> {
    return (await this.getIndex()).meta;
  }

  invalidate(): void {
    this.cached = null;
  }
}

function encode(bytes: Int8Array | Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString(
    'base64'
  );
}

function decodeRow(row: FingerprintRow): ArtIndexRecord | null {
  const vector = Buffer.from(row.vector, 'base64');
  const bits = Buffer.from(row.bits, 'base64');
  if (vector.byteLength !== ART_VECTOR_DIMENSION || bits.byteLength !== ART_BIT_BYTES) {
    return null;
  }
  return {
    key: row.imageKey,
    vector: new Int8Array(
      vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength)
    ),
    bits: new Uint8Array(
      bits.buffer.slice(bits.byteOffset, bits.byteOffset + bits.byteLength)
    ),
  };
}
