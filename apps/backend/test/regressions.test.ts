import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import {
  CardDetailResponse,
  CardsListResponse,
  CollectionActivityHistoryResponse,
  CollectionRecentAddsResponse,
  SyncStatusResponse,
} from '@riftbound/contracts';
import sharp from 'sharp';
import { startStorageFixture } from './s3-fixture';
import { createHarness, json, waitFor } from './support';

setDefaultTimeout(60000);
const harness = createHarness();
const cardIds: string[] = [];
let app: Awaited<ReturnType<typeof harness.startServer>>;
let upstreamCard: unknown = null;
function gate() {
  return {
    entered: Promise.withResolvers<void>(),
    release: Promise.withResolvers<void>(),
    completed: Promise.withResolvers<void>(),
  };
}
let syncGate: ReturnType<typeof gate> | undefined;
let priceGate: ReturnType<typeof gate> | undefined;
let uploadGate: ReturnType<typeof gate> | undefined;
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
    if (url.pathname.startsWith('/v1/cards/') && upstreamCard)
      return Response.json(upstreamCard);
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
const storage = startStorageFixture(async (_key, store) => {
  uploads++;
  const current = uploadGate;
  if (current) {
    current.entered.resolve();
    await current.release.promise;
  }
  store();
  current?.completed.resolve();
});
const { objects } = storage;
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
  S3_ENDPOINT: storage.origin,
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
  app = await harness.startServer(overrides);
});
afterAll(async () => {
  syncGate?.release.resolve();
  priceGate?.release.resolve();
  uploadGate?.release.resolve();
  await harness.sql`DELETE FROM card_colors WHERE card_id=ANY(${cardIds}::uuid[])`;
  await harness.sql`DELETE FROM variants WHERE card_id=ANY(${cardIds}::uuid[])`;
  await harness.sql`DELETE FROM cards WHERE id=ANY(${cardIds}::uuid[])`;
  await harness.stopServer();
  pa.stop(true);
  storage.stop();
  cdn.stop(true);
});
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
test('excludeBanned drops exactly the cards listed as isBanned', async () => {
  const list = async (query: string) =>
    CardsListResponse.parse(
      await (await app.fetch(`/api/v1/cards?limit=100&${query}`)).json()
    );
  const all = await list('q=draven');
  expect(all.data.some((card) => card.isBanned)).toBe(true);
  const legal = await list('q=draven&excludeBanned=true');
  expect(legal.data.some((card) => card.isBanned)).toBe(false);
  expect(legal.meta.pagination.total).toBe(
    all.meta.pagination.total - all.data.filter((card) => card.isBanned).length
  );
  // Unfiltered browse uses the direct-page path, so check the flag disables it too.
  const browse = await list('excludeBanned=true');
  expect(browse.data.some((card) => card.isBanned)).toBe(false);
});
test('activity endpoints retain a matching variant at the 5000th position', async () => {
  const user = await harness.signup(app, 'activity-limit');
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
      const server = await other.startServer(overrides);
      await startInterruptedSync(server, key, current);
      await other.stopServer();
      const rows =
        await harness.sql`SELECT status,last_error FROM sync_state WHERE key=${key}`;
      expect(rows[0]?.status).toBe('failed');
      expect(rows[0]?.last_error).toContain('shutdown');
    } finally {
      current.release.resolve();
      syncGate = undefined;
      priceGate = undefined;
      await other.stopServer();
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
        const server = await other.startServer(overrides);
        const persisted = await server.fetch(path);
        expect(persisted.status).toBe(200);
        expect(persisted.headers.get('x-image-source')).toBe('s3');
        expect(new Uint8Array(await persisted.arrayBuffer())).toEqual(bytes);
        expect(cdnReads).toBe(reads);
      } finally {
        await other.stopServer();
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
    const server = await other.startServer(overrides);
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
    await other.stopServer();
    expect(uploads - initialUploads).toBe(8);
  } finally {
    current.release.resolve();
    uploadGate = undefined;
    await Promise.all(requests);
    await other.stopServer();
  }
});

test('a Piltover Archive renumber of an existing variant id updates the cached row', async () => {
  const [seed] = await harness.sql<
    { raw: { variants: Record<string, unknown>[] } & Record<string, unknown> }[]
  >`SELECT upstream_raw AS raw FROM cards WHERE jsonb_array_length(upstream_raw->'variants')>0 LIMIT 1`;
  if (!seed) throw new Error('Offline catalog has no cards');
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
  const cardId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  cardIds.push(cardId);
  const card = (variantNumber: string) => ({
    ...seed.raw,
    id: cardId,
    name: `Renumber ${suffix}`,
    variants: [
      {
        ...seed.raw.variants[0],
        id: variantId,
        variantNumber,
        cardmarketId: null,
        tcgplayerId: null,
        parentVariantId: null,
      },
    ],
  });
  upstreamCard = card(`RVW-${suffix}`);
  expect((await app.fetch(`/api/v1/cards/RVW-${suffix}`)).status).toBe(200);
  upstreamCard = card(`RVW-${suffix}a`);
  const refreshed = await app.fetch(`/api/v1/cards/RVW-${suffix}?refresh=true`, {
    headers: { authorization: 'Bearer ' + app.config.ADMIN_SYNC_TOKEN },
  });
  expect(refreshed.status).toBe(200);
  const detail = CardDetailResponse.parse(await refreshed.json());
  expect(detail.data.variants.map((variant) => variant.variantNumber)).toEqual([
    `RVW-${suffix}a`,
  ]);
  expect([
    ...(await harness.sql`SELECT variant_number FROM variants WHERE card_id=${cardId}::uuid`),
  ]).toEqual([{ variant_number: `RVW-${suffix}a` }]);
});

test('collection writes for a variant missing from the catalog return 404, not a foreign-key 500', async () => {
  const session = (await harness.signup(app, 'missing')).cookie;
  const missing = `ZZZ-${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const set = await app.fetch(`/api/v1/collection/${missing}`, {
    ...json({ quantity: 1 }, session),
    method: 'PUT',
  });
  expect(set.status).toBe(404);
  expect(await set.json()).toMatchObject({ message: `Variant ${missing} not found` });
  for (const body of [{}, { isFoil: true }]) {
    expect(
      (await app.fetch(`/api/v1/collection/${missing}/add`, json(body, session))).status
    ).toBe(404);
  }
});

test('a Piltover Archive outage fails community deck browsing but keeps owned decks listed', async () => {
  const session = (await harness.signup(app, 'deck-outage')).cookie;
  const community = await app.fetch('/api/v1/decks?source=imported', {
    headers: { cookie: session },
  });
  expect(community.status).toBeGreaterThanOrEqual(400);
  const mixed = await app.fetch('/api/v1/decks', { headers: { cookie: session } });
  expect(mixed.status).toBe(200);
});
