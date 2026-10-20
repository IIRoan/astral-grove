import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import {
  CardDetailResponse,
  CardsBatchResponse,
  CardsListResponse,
  CatalogIndexResponse,
  CollectionActivityHistoryResponse,
  CollectionAuditListResponse,
  CollectionRecentAddsResponse,
  CollectionShareInviteCreateResponse,
  CollectionShareStatusResponse,
  DeckDetailResponse,
  PaLogicalCard,
  PricesListResponse,
  SyncStatusResponse,
} from '@riftbound/contracts';
import sharp from 'sharp';
import type { z } from 'zod';
import { startStorageFixture } from './s3-fixture';
import { createHarness, json, waitFor } from './support';
import { startOfflineUpstream } from './fixtures/offline';

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
    if (url.pathname === '/v1/cards/E2E-MISSING-CARD')
      return new Response(null, { status: 404 });
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
test('activity cursors retain microseconds and order events with equal timestamps', async () => {
  const user = await harness.signup(app, 'activity-cursor');
  expect(
    (await app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } })).status
  ).toBe(200);
  const tied = Array.from({ length: 4 }, () => crypto.randomUUID())
    .sort()
    .reverse();
  const ids = [crypto.randomUUID(), ...tied, crypto.randomUUID()];
  for (const [index, id] of ids.entries()) {
    const at = `2026-10-20T00:00:00.${index === 0 ? '123457' : index === 5 ? '123455' : '123456'}Z`;
    await harness.sql`INSERT INTO collection_audit_events(id,collection_id,actor_user_id,action,variant_number,quantity_before,quantity_after,quantity_delta,created_at)
      SELECT ${id}::uuid,collection_id,${user.user.id},'add','OGN-001',0,1,1,${at}::text::timestamptz
      FROM collection_members WHERE user_id=${user.user.id}`;
  }
  let cursor: z.infer<typeof CollectionActivityHistoryResponse>['meta']['nextCursor'] =
    null;
  const seen: string[] = [];
  for (let page = 0; page < 3; page++) {
    const response = await app.fetch(
      '/api/v1/collection/activity-history',
      json(
        { variantNumbers: ['OGN-001'], limit: 2, ...(cursor ? { cursor } : {}) },
        user.cookie
      )
    );
    expect(response.status).toBe(200);
    const history = CollectionActivityHistoryResponse.parse(await response.json());
    seen.push(...history.data.map((event) => event.id));
    expect(history.data.map((event) => event.id)).toEqual(
      ids.slice(page * 2, page * 2 + 2)
    );
    expect(history.meta.hasMore).toBe(page < 2);
    cursor = history.meta.nextCursor;
    if (page < 2) {
      expect(cursor?.id).toBe(ids[page * 2 + 1]);
      expect(cursor?.at).toBe('2026-10-20T00:00:00.123456Z');
    } else expect(cursor).toBeNull();
  }
  expect(seen).toEqual(ids);
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

test('a warm catalog index stays available without querying locked catalog tables', async () => {
  const initial = await app.fetch('/api/v1/cards/index');
  expect(initial.status).toBe(200);
  const body = await initial.text();
  expect(CatalogIndexResponse.parse(JSON.parse(body)).data.length).toBeGreaterThan(0);
  await harness.sql.begin(async (tx) => {
    await tx`LOCK TABLE cards IN ACCESS EXCLUSIVE MODE`;
    const cached = await app.fetch('/api/v1/cards/index', {
      signal: AbortSignal.timeout(1500),
    });
    expect(cached.status).toBe(200);
    expect(cached.headers.get('content-type')).toContain('application/json');
    expect(await cached.text()).toBe(body);
  });
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
  const before = CatalogIndexResponse.parse(
    await (await app.fetch('/api/v1/cards/index')).json()
  );
  expect(before.data.some((item) => item.variantNumber === `RVW-${suffix}`)).toBe(true);
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
  const after = CatalogIndexResponse.parse(
    await (await app.fetch('/api/v1/cards/index')).json()
  );
  expect(after.data.some((item) => item.variantNumber === `RVW-${suffix}`)).toBe(false);
  expect(after.data.some((item) => item.variantNumber === `RVW-${suffix}a`)).toBe(true);
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

test('card detail preserves an upstream not-found response', async () => {
  const response = await app.fetch('/api/v1/cards/E2E-MISSING-CARD');
  expect(response.status).toBe(404);
});

test('filtered name sorting keeps printing ties in variant-number order', async () => {
  const response = await app.fetch('/api/v1/cards?types=legend&limit=100');
  const result = CardsListResponse.parse(await response.json());
  const sorted = [...result.data].sort(
    (left, right) =>
      left.name.localeCompare(right.name) ||
      left.cardId.localeCompare(right.cardId) ||
      left.variantNumber.localeCompare(right.variantNumber)
  );
  expect(result.data.map((item) => item.variantNumber)).toEqual(
    sorted.map((item) => item.variantNumber)
  );
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

test('incomplete community decks stay viewable but import waits for the catalog to recover', async () => {
  const [seed] = await harness.sql<{ raw: unknown }[]>`
    SELECT upstream_raw AS raw FROM cards WHERE jsonb_array_length(upstream_raw->'variants')>0 LIMIT 1`;
  const original = PaLogicalCard.parse(seed?.raw);
  const card = PaLogicalCard.parse({
    ...original,
    id: crypto.randomUUID(),
    name: `Import recovery ${crypto.randomUUID()}`,
    variants: [
      {
        ...original.variants[0],
        id: crypto.randomUUID(),
        variantNumber: `RFI-${crypto.randomUUID().slice(0, 8)}`,
        cardmarketId: null,
        tcgplayerId: null,
        parentVariantId: null,
      },
    ],
  });
  const variant = card.variants[0]!;
  cardIds.push(card.id);
  const deckId = `import-recovery-${crypto.randomUUID()}`;
  let available = false;
  const upstream = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === `/v1/decks/${deckId}`)
        return Response.json({
          id: deckId,
          name: 'Import recovery',
          createdAt: '2026-10-01T00:00:00.000Z',
          maindeck: [{ cardId: card.id, variantId: variant.id, quantity: 3 }],
        });
      if (!available) return new Response(null, { status: 503 });
      if (path === '/v1/cards')
        return Response.json({
          data: [{ ...variant, card: { id: card.id, name: card.name } }],
          pagination: { total: 1, page: 1, limit: 100, totalPages: 1, hasNext: false },
        });
      if (path === `/v1/cards/${variant.variantNumber}`) return Response.json(card);
      return new Response(null, { status: 404 });
    },
  });
  const other = createHarness();
  try {
    const server = await other.startServer({ PA_BASE_URL: upstream.url.origin });
    const user = await other.signup(server, 'import-recovery');
    const view = DeckDetailResponse.parse(
      await (
        await server.fetch(`/api/v1/decks/${deckId}`, {
          headers: { cookie: user.cookie },
        })
      ).json()
    );
    expect(view.data.readOnly).toBe(true);
    expect(view.data.mainDeck[0]?.card.variantNumber).toBe(`unknown:${variant.id}`);
    const importDeck = () =>
      server.fetch(`/api/v1/decks/${deckId}/import`, json({}, user.cookie));
    const refused = await importDeck();
    expect(refused.status).toBe(503);
    expect(await refused.json()).toMatchObject({ error: 'DECK_CATALOG_INCOMPLETE' });
    expect(
      await other.sql`SELECT id FROM user_decks WHERE user_id=${user.user.id}`
    ).toHaveLength(0);
    available = true;
    const response = await importDeck();
    expect(response.status).toBe(200);
    const imported = DeckDetailResponse.parse(await response.json());
    expect(imported.data.source).toBe('owned');
    expect(imported.data.mainDeck[0]?.card.variantNumber).toBe(variant.variantNumber);
    expect(imported.data.mainDeck[0]?.count).toBe(3);
    const repeated = DeckDetailResponse.parse(await (await importDeck()).json());
    expect(repeated.data.id).toBe(imported.data.id);
    expect(
      await other.sql`SELECT id FROM user_decks WHERE user_id=${user.user.id}`
    ).toHaveLength(1);
  } finally {
    await other.stopServer();
    upstream.stop(true);
  }
});

test('prices for an unresolved variant number are empty instead of the whole table', async () => {
  const all = PricesListResponse.parse(
    await (await app.fetch('/api/v1/prices')).json()
  );
  expect(all.data.length).toBeGreaterThan(0);
  const unknown = PricesListResponse.parse(
    await (await app.fetch('/api/v1/prices?variantNumber=ZZZ-NOT-A-CARD')).json()
  );
  expect(unknown.data).toEqual([]);
  expect(unknown.meta.rowCount).toBe(0);
});

test('audit pages resume after events that share the previous page boundary timestamp', async () => {
  const user = await harness.signup(app, 'audit-cursor');
  expect(
    (await app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } })).status
  ).toBe(200);
  const ids = Array.from({ length: 3 }, () => crypto.randomUUID())
    .sort()
    .reverse();
  for (const id of ids)
    await harness.sql`INSERT INTO collection_audit_events(id,collection_id,actor_user_id,action,variant_number,quantity_before,quantity_after,quantity_delta,created_at)
      SELECT ${id}::uuid,collection_id,${user.user.id},'add','OGN-001',0,1,1,'2026-10-20T00:00:00.123456Z'::timestamptz
      FROM collection_members WHERE user_id=${user.user.id}`;
  const page = async (query: string) =>
    CollectionAuditListResponse.parse(
      await (
        await app.fetch(`/api/v1/collection/audit?limit=2${query}`, {
          headers: { cookie: user.cookie },
        })
      ).json()
    );
  const first = await page('');
  expect(first.data.map((event) => event.id)).toEqual(ids.slice(0, 2));
  expect(first.meta.hasMore).toBe(true);
  const second = await page(`&beforeId=${ids[1]}`);
  expect(second.data.map((event) => event.id)).toEqual(ids.slice(2));
  expect(second.meta.hasMore).toBe(false);
  const unknown = await app.fetch(
    `/api/v1/collection/audit?limit=2&beforeId=${crypto.randomUUID()}`,
    { headers: { cookie: user.cookie } }
  );
  expect(unknown.status).toBe(404);
});

test('the remaining member owns the collection after its owner leaves', async () => {
  const owner = await harness.signup(app, 'leave-owner');
  const member = await harness.signup(app, 'leave-member');
  const invitation = CollectionShareInviteCreateResponse.parse(
    await (
      await app.fetch('/api/v1/collection/share/invite', json({}, owner.cookie))
    ).json()
  );
  expect(
    (
      await app.fetch(
        `/api/v1/collection/share/invite/${invitation.data.token}/accept`,
        json({ mode: 'use_theirs' }, member.cookie)
      )
    ).status
  ).toBe(200);
  expect(
    (await app.fetch('/api/v1/collection/share/leave', json({}, owner.cookie))).status
  ).toBe(200);
  const status = CollectionShareStatusResponse.parse(
    await (
      await app.fetch('/api/v1/collection/share', {
        headers: { cookie: member.cookie },
      })
    ).json()
  );
  expect(status.data.role).toBe('owner');
  expect(status.data.shared).toBe(false);
});

test('a batch that fails part-way still notifies live clients of committed items', async () => {
  const user = await harness.signup(app, 'batch-live');
  const controller = new AbortController();
  const events = await app.fetch('/api/v1/collection/events', {
    headers: { cookie: user.cookie },
    signal: controller.signal,
  });
  const reader = events.body!.getReader();
  try {
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      'event: ready'
    );
    const response = await app.fetch(
      '/api/v1/collection/batch',
      json(
        {
          items: [
            { variantNumber: 'OGN-001', quantity: 2 },
            { variantNumber: 'ZZZ-MISSING' },
          ],
        },
        user.cookie
      )
    );
    expect(response.status).toBe(404);
    const next = await Promise.race([
      reader.read(),
      Bun.sleep(2000).then(() => {
        throw new Error('Committed batch items were not announced');
      }),
    ]);
    expect(new TextDecoder().decode(next.value)).toContain('"reason":"batch"');
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
  }
});

test('a card that fails to load is left out of a batch instead of failing it', async () => {
  const offline = startOfflineUpstream();
  const upstream = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname !== '/v1/cards/batch')
        return new Response(null, { status: 500 });
      const { variantNumbers } = (await request.json()) as { variantNumbers: string[] };
      const known = (await (
        await fetch(offline.url + '/v1/cards/batch', {
          method: 'POST',
          body: JSON.stringify({ variantNumbers: ['OGN-001'] }),
        })
      ).json()) as { data: Array<Record<string, unknown>> };
      return Response.json({
        data: variantNumbers.map((variantNumber) => ({
          ...known.data[0],
          id: crypto.randomUUID(),
          variantNumber,
        })),
        notFound: [],
      });
    },
  });
  const other = createHarness();
  try {
    const server = await other.startServer({ PA_BASE_URL: upstream.url.origin });
    const response = await server.fetch(
      '/api/v1/cards/batch',
      json({ variantNumbers: ['OGN-001', `ZZF-${crypto.randomUUID().slice(0, 8)}`] })
    );
    expect(response.status).toBe(200);
    const batch = CardsBatchResponse.parse(await response.json());
    expect(batch.meta.found).toBe(1);
    expect(batch.meta.source).toBe('mixed');
  } finally {
    await other.stopServer();
    upstream.stop(true);
    offline.stop();
  }
});

test('a blocking catalog probe reuses the probe that was already running', async () => {
  const total = 900_000 + Math.floor(Math.random() * 99_999);
  const probe = gate();
  const probes: string[] = [];
  const upstream = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname !== '/v1/cards') return new Response(null, { status: 404 });
      const limit = Number(url.searchParams.get('limit'));
      probes.push(String(limit));
      if (limit === 100 && probes.filter((value) => value === '100').length === 1) {
        probe.entered.resolve();
        await probe.release.promise;
      }
      return Response.json({
        data: [],
        pagination: { total, page: 1, limit, totalPages: 1, hasNext: false },
      });
    },
  });
  const before = (
    await harness.sql`SELECT coalesce(max(id),0)::bigint AS id FROM filter_snapshots`
  )[0]!.id;
  const saved =
    await harness.sql`SELECT content_hash,row_count,status FROM sync_state WHERE key='catalog_probe'`;
  const other = createHarness();
  try {
    const server = await other.startServer({
      PA_BASE_URL: upstream.url.origin,
      CATALOG_PROBE_DISABLED: 'false',
    });
    expect((await server.fetch('/api/v1/filters')).status).toBe(200);
    await probe.entered.promise;
    const seen = probes.length;
    const sync = server.fetch('/api/v1/sync/catalog', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + server.config.ADMIN_SYNC_TOKEN },
    });
    // The sync's own fingerprint request arrives just before it waits on the running probe.
    await waitFor(() => probes.length > seen);
    await Bun.sleep(500);
    probe.release.resolve();
    expect((await sync).status).toBe(200);
    expect(
      await harness.sql`SELECT id FROM filter_snapshots WHERE id>${before}`
    ).toHaveLength(1);
  } finally {
    probe.release.resolve();
    await other.stopServer();
    upstream.stop(true);
    await harness.sql`DELETE FROM filter_snapshots WHERE id>${before}`;
    if (saved[0])
      await harness.sql`UPDATE sync_state SET content_hash=${saved[0].content_hash},row_count=${saved[0].row_count},status=${saved[0].status} WHERE key='catalog_probe'`;
    else await harness.sql`DELETE FROM sync_state WHERE key='catalog_probe'`;
  }
});
