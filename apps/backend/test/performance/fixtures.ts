import sharp from 'sharp';
import { startOfflineUpstream } from '../fixtures/offline';
import { startStorageFixture } from '../s3-fixture';

type Barrier = ReturnType<typeof Promise.withResolvers<void>>;

export async function startFixtures() {
  const pixels = new Uint8Array(768 * 1024 * 3);
  let seed = 12345;
  for (let index = 0; index < pixels.length; index++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    pixels[index] = seed >>> 24;
  }
  const image = new Uint8Array(
    await sharp(pixels, { raw: { width: 768, height: 1024, channels: 3 } })
      .png()
      .toBuffer()
  );
  const upstream = startOfflineUpstream();
  const cdnReads = new Map<string, number>();
  const counters = { uploads: 0, activeUploads: 0, peakUploads: 0 };
  let uploadBarrier: Barrier | undefined;
  let syncBarrier:
    (Barrier & { started: { catalog: number; prices: number } }) | undefined;
  const pa = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const key =
        url.pathname === '/v1/cards' && url.searchParams.get('limit') === '100'
          ? 'catalog'
          : url.pathname.startsWith('/priceGuide/')
            ? 'prices'
            : undefined;
      if (key && syncBarrier) {
        const current = syncBarrier;
        current.started[key]++;
        await current.promise;
      }
      return fetch(upstream.url + url.pathname + url.search);
    },
  });
  const storage = startStorageFixture(async (key, store) => {
    counters.uploads++;
    counters.activeUploads++;
    counters.peakUploads = Math.max(counters.peakUploads, counters.activeUploads);
    try {
      if (uploadBarrier) await uploadBarrier.promise;
      if (!key.includes('/memory-')) store();
    } finally {
      counters.activeUploads--;
    }
  });
  const cdn = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const key = new URL(request.url).pathname;
      cdnReads.set(key, (cdnReads.get(key) ?? 0) + 1);
      await Bun.sleep(50);
      return new Response(new Uint8Array(image).buffer, {
        headers: { 'content-type': 'image/png' },
      });
    },
  });
  return {
    image,
    cdnReads,
    counters,
    config: {
      PA_BASE_URL: pa.url.origin,
      CARDMARKET_EXPORT_BASE_URL: pa.url.origin,
      IMAGE_CDN_BASE_URL: cdn.url.origin,
      S3_ENDPOINT: storage.origin,
      S3_BUCKET: 'performance-fixture',
      S3_ACCESS_KEY_ID: 'fixture-access',
      S3_SECRET_ACCESS_KEY: 'fixture-secret',
      SYNC_MAX_PAGES: '1',
      DB_POOL_MAX: '4',
    },
    blockUploads() {
      uploadBarrier = Promise.withResolvers<void>();
      return uploadBarrier;
    },
    blockSync() {
      syncBarrier = {
        ...Promise.withResolvers<void>(),
        started: { catalog: 0, prices: 0 },
      };
      return syncBarrier;
    },
    release() {
      uploadBarrier?.resolve();
      syncBarrier?.resolve();
    },
    stop() {
      this.release();
      pa.stop(true);
      storage.stop();
      cdn.stop(true);
      upstream.stop();
    },
  };
}
