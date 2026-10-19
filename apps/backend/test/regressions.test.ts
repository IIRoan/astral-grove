import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import {
  CardsListResponse,
  CollectionActivityHistoryResponse,
  CollectionRecentAddsResponse,
  SyncStatusResponse,
} from '@riftbound/contracts';
import sharp from 'sharp';
import { validS3Signature } from './s3-fixture';
import { cookie, createHarness, json } from './support';

setDefaultTimeout(60000);
const harness = createHarness();
const emails: string[] = [];
let app: Awaited<ReturnType<typeof harness.startRust>>;
function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function gate() {
  return { entered: deferred(), release: deferred(), completed: deferred() };
}
let syncGate: ReturnType<typeof gate> | undefined;
let priceGate: ReturnType<typeof gate> | undefined;
let uploadGate: ReturnType<typeof gate> | undefined;
const objects = new Map<string, { body: ArrayBuffer; type: string }>();
let uploads = 0;
let cdnReads = 0;
let source: Uint8Array<ArrayBuffer>;
const pa = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/priceGuide/price_guide_22.json') {
      const current = priceGate;
      if (current) {
        current.entered.resolve();
        await current.release.promise;
        current.completed.resolve();
      }
      return Response.json({
        version: 1,
        createdAt: '2026-10-18T00:00:00.000Z',
        priceGuides: [],
      });
    }
    if (url.pathname === '/productList/products_singles_22.json')
      return Response.json({
        version: 1,
        createdAt: '2026-10-18T00:00:00.000Z',
        products: [],
      });
    if (url.pathname !== '/v1/cards') return new Response(null, { status: 404 });
    if (url.searchParams.get('limit') === '100' && syncGate) {
      const current = syncGate;
      current.entered.resolve();
      await current.release.promise;
      current.completed.resolve();
    }
    return Response.json({
      data: [],
      pagination: {
        total: 0,
        limit: 100,
        page: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
    });
  },
});
const storage = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  async fetch(request) {
    if (!validS3Signature(request, 'fixture-secret'))
      return new Response(null, { status: 403 });
    const key = new URL(request.url).pathname;
    if (request.method === 'PUT') {
      const body = await request.arrayBuffer();
      uploads++;
      const current = uploadGate;
      if (current) {
        current.entered.resolve();
        await current.release.promise;
      }
      objects.set(key, {
        body,
        type: request.headers.get('content-type') ?? '',
      });
      current?.completed.resolve();
      return new Response(null, { status: 200 });
    }
    const object = objects.get(key);
    return object
      ? new Response(request.method === 'HEAD' ? null : object.body, {
          headers: {
            'content-type': object.type,
            'content-length': String(object.body.byteLength),
          },
        })
      : new Response(null, { status: 404 });
  },
});
const cdn = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch() {
    cdnReads++;
    return new Response(new Uint8Array(source).buffer, {
      headers: { 'content-type': 'image/png' },
    });
  },
});
const overrides = {
  PA_BASE_URL: pa.url.origin,
  CARDMARKET_EXPORT_BASE_URL: pa.url.origin,
  IMAGE_CDN_BASE_URL: cdn.url.origin,
  S3_ENDPOINT: storage.url.origin,
  S3_BUCKET: 'regression-fixture',
  S3_ACCESS_KEY_ID: 'fixture-access',
  S3_SECRET_ACCESS_KEY: 'fixture-secret',
};
beforeAll(async () => {
  source = new Uint8Array(
    await sharp({
      create: { width: 256, height: 128, channels: 4, background: '#123456' },
    })
      .png()
      .toBuffer()
  );
  app = await harness.startRust(overrides);
});
afterAll(async () => {
  syncGate?.release.resolve();
  priceGate?.release.resolve();
  uploadGate?.release.resolve();
  await harness.sql`DELETE FROM "user" WHERE email=ANY(${emails})`;
  await harness.stopRust();
  pa.stop(true);
  storage.stop(true);
  cdn.stop(true);
});
async function signup(label: string) {
  const email = `regression-${label}-${crypto.randomUUID()}@test.riftbound.dev`;
  emails.push(email);
  const response = await app.fetch(
    '/api/auth/sign-up/email',
    json({ name: label, email, password: 'regression-password-12345' })
  );
  expect(response.status).toBe(200);
  return { cookie: cookie(response), email };
}
async function waitFor(check: () => boolean | Promise<boolean>) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await Bun.sleep(20);
  }
  throw new Error('Regression condition did not become true');
}
test.each(['unit', 'legend', 'champion', 'rune', 'battlefield'])(
  'a search for only the %s type matches its catalog filter',
  async (type) => {
    const filter = type === 'champion' ? 'super=Champion' : `types=${type}`;
    const filtered = CardsListResponse.parse(
      await (await app.fetch(`/api/v1/cards?${filter}`)).json()
    );
    expect(filtered.meta.pagination.total).toBeGreaterThan(0);
    const searched = CardsListResponse.parse(
      await (await app.fetch(`/api/v1/cards?q=${type}`)).json()
    );
    expect(searched.meta.pagination.total).toBe(filtered.meta.pagination.total);
    expect(searched.data.length).toBeGreaterThan(0);
    expect(
      searched.data.every((card) =>
        `${card.type} ${card.super ?? ''}`.toLowerCase().includes(type)
      )
    ).toBe(true);
  }
);
test('activity endpoints retain a matching variant at the 5000th position', async () => {
  const user = await signup('activity-limit');
  expect(
    (await app.fetch('/api/v1/collection/OGN-001/add', json({}, user.cookie))).status
  ).toBe(200);
  const variantNumbers = [
    ...Array.from({ length: 4999 }, (_, index) => `UNOWNED-${index}`),
    'OGN-001',
  ];
  const recent = CollectionRecentAddsResponse.parse(
    await (
      await app.fetch(
        '/api/v1/collection/recent-adds',
        json({ variantNumbers }, user.cookie)
      )
    ).json()
  );
  const history = CollectionActivityHistoryResponse.parse(
    await (
      await app.fetch(
        '/api/v1/collection/activity-history',
        json({ variantNumbers }, user.cookie)
      )
    ).json()
  );
  expect(recent.data).toHaveLength(1);
  expect(recent.data[0]?.quantityDelta).toBe(1);
  expect(history.data).toEqual(recent.data);
  expect(history.meta).toEqual({ hasMore: false, nextCursor: null });
});
async function startInterruptedSync(
  server: typeof app,
  key: 'catalog' | 'prices',
  current: ReturnType<typeof gate>
) {
  if (key === 'catalog') syncGate = current;
  else priceGate = current;
  const controller = new AbortController();
  const request = server
    .fetch(`/api/v1/sync/${key}?force=1`, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + server.config.ADMIN_SYNC_TOKEN },
      signal: controller.signal,
    })
    .then((response) => response.text())
    .catch((error: unknown) => {
      if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
    });
  await current.entered.promise;
  controller.abort();
  await request;
}
test.each(['catalog', 'prices'] as const)(
  '%s synchronization finishes after its HTTP client disconnects',
  async (key) => {
    const current = gate();
    try {
      await startInterruptedSync(app, key, current);
      current.release.resolve();
      await current.completed.promise;
      await waitFor(async () => {
        const status = SyncStatusResponse.parse(
          await (
            await app.fetch('/api/v1/sync/status', {
              headers: { authorization: 'Bearer ' + app.config.ADMIN_SYNC_TOKEN },
            })
          ).json()
        );
        return status.data[key].status === 'idle';
      });
    } finally {
      current.release.resolve();
      syncGate = undefined;
      priceGate = undefined;
    }
  }
);
test.each(['catalog', 'prices'] as const)(
  'shutdown interrupts detached %s synchronization and records a retryable failure',
  async (key) => {
    const other = createHarness();
    const current = gate();
    try {
      const server = await other.startRust(overrides);
      await startInterruptedSync(server, key, current);
      await other.stopRust();
      const rows =
        await harness.sql`SELECT status,last_error FROM sync_state WHERE key=${key}`;
      expect(rows[0]?.status).toBe('failed');
      expect(rows[0]?.last_error).toContain('shutdown');
    } finally {
      current.release.resolve();
      syncGate = undefined;
      priceGate = undefined;
      await other.stopRust();
    }
  }
);
test.each(['original', 'thumbnail'] as const)(
  'cold %s images are served and cached while S3 uploads are blocked',
  async (kind) => {
    const width = kind === 'thumbnail' ? 96 : undefined;
    const current = gate();
    uploadGate = current;
    const key = `cards/blocked-upload-${crypto.randomUUID()}.png`;
    const initialUploads = uploads;
    const path = '/api/v1/images/' + key + (width ? `?w=${width}` : '');
    const storedKey = width ? `thumbs/w${width}/${key}` : key;
    const response = app.fetch(path);
    try {
      await current.entered.promise;
      const delivered = await Promise.race([
        response,
        Bun.sleep(1000).then(() => undefined),
      ]);
      expect(delivered).toBeDefined();
      if (!delivered) throw new Error('Image delivery waited for the S3 upload');
      expect(delivered.status).toBe(200);
      const bytes = new Uint8Array(await delivered.arrayBuffer());
      if (width) {
        const metadata = await sharp(bytes).metadata();
        expect(metadata.width).toBe(width);
        expect(metadata.height).toBe(width / 2);
      } else expect(bytes).toEqual(source);
      const cached = await app.fetch(path, {
        headers: { 'if-none-match': delivered.headers.get('etag')! },
      });
      expect(cached.status).toBe(304);
      expect(cached.headers.get('x-image-source')).toBe('memory');
      await waitFor(() => uploads - initialUploads === (width ? 2 : 1));
      current.release.resolve();
      await current.completed.promise;
      await waitFor(() => objects.has('/regression-fixture/' + storedKey));
      const reads = cdnReads;
      const other = createHarness();
      try {
        const server = await other.startRust(overrides);
        const persisted = await server.fetch(path);
        expect(persisted.status).toBe(200);
        expect(persisted.headers.get('x-image-source')).toBe('s3');
        expect(new Uint8Array(await persisted.arrayBuffer())).toEqual(bytes);
        expect(cdnReads).toBe(reads);
      } finally {
        await other.stopRust();
      }
    } finally {
      current.release.resolve();
      uploadGate = undefined;
      await response;
    }
  }
);

test('concurrent thumbnails share an original upload without waiting for persistence', async () => {
  const current = gate();
  uploadGate = current;
  const key = `cards/shared-upload-${crypto.randomUUID()}.png`;
  const initialUploads = uploads;
  const first = app.fetch(`/api/v1/images/${key}?w=96`);
  let second: Promise<Response> | undefined;
  try {
    await current.entered.promise;
    second = app.fetch(`/api/v1/images/${key}?w=160`);
    const responses = await Promise.race([
      Promise.all([first, second]),
      Bun.sleep(1000).then(() => undefined),
    ]);
    expect(responses?.map((response) => response.status)).toEqual([200, 200]);
    await waitFor(() => uploads - initialUploads === 3);
  } finally {
    current.release.resolve();
    uploadGate = undefined;
    await Promise.all([first, second]);
    await waitFor(() => objects.has('/regression-fixture/thumbs/w160/' + key));
  }
});

test('a full upload queue still serves images and stalled uploads drain within shutdown bounds', async () => {
  const other = createHarness();
  const current = gate();
  uploadGate = current;
  const initialUploads = uploads;
  const requests: Promise<Response>[] = [];
  try {
    const server = await other.startRust(overrides);
    for (let index = 0; index < 9; index++)
      requests.push(
        server.fetch(`/api/v1/images/cards/bounded-${crypto.randomUUID()}.png`)
      );
    const responses = await Promise.race([
      Promise.all(requests),
      Bun.sleep(1000).then(() => undefined),
    ]);
    expect(responses?.map((response) => response.status)).toEqual(Array(9).fill(200));
    await waitFor(() => uploads - initialUploads === 8);
    await other.stopRust();
    expect(uploads - initialUploads).toBe(8);
  } finally {
    current.release.resolve();
    uploadGate = undefined;
    await Promise.all(requests);
    await other.stopRust();
  }
});
