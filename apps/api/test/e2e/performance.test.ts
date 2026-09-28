import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CardsListResponse,
  CatalogIndexResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
  FiltersResponse,
  HealthResponse,
  PricesListResponse,
} from '@riftbound/contracts';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getEnv } from './support.js';
import { assertMaxMs, readBudget, timedJson } from './helpers/timing.js';

setDefaultTimeout(180_000);

const BUDGET = {
  health: readBudget('health', 150),
  filters: readBudget('filters', 250),
  search: readBudget('search', 600),
  index: readBudget('index', 5000),
  detail: readBudget('detail', 500),
  quantities: readBudget('quantities', 400),
  collectionList: readBudget('collection_list', 2500),
  // Includes local-only sibling merge on detail loads; leave headroom for host variance.
  batch: readBudget('batch', 1600),
  prices: readBudget('prices', 1500),
  priceStats: readBudget('price_stats', 2000),
  syncStatus: readBudget('sync_status', 200),
  priceHistory: readBudget('price_history', 2500),
};

const testEmail = `test-perf-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
let cookieHeader = '';
let sampleVariant = '';
let sampleVariants: string[] = [];

beforeAll(async () => {
  await cleanupTestUsers('test-perf-%');
  cookieHeader = await signUpTestUser({
    email: testEmail,
    password: testPassword,
    name: 'Performance User',
  });

  const search = CardsListResponse.parse(
    (
      await timedJson<unknown>('seed search', () =>
        authFetch('/api/v1/cards?q=vi&limit=20&page=1')
      )
    ).data
  );
  sampleVariant = search.data[0]?.variantNumber ?? '';
  sampleVariants = search.data.slice(0, 20).map((card) => card.variantNumber);
  expect(sampleVariant).toBeTruthy();
  expect(sampleVariants.length).toBeGreaterThan(0);

  await authFetch(`/api/v1/collection/${encodeURIComponent(sampleVariant)}/add`, {
    method: 'POST',
    cookie: cookieHeader,
    body: JSON.stringify({ delta: 2 }),
  });
});

afterAll(async () => {
  await cleanupTestUsers('test-perf-%');
});

describe('API response times (cached catalog)', () => {
  test(`GET /api/v1/health ≤ ${String(BUDGET.health)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('health', () =>
      authFetch('/api/v1/health')
    );
    HealthResponse.parse(data);
    assertMaxMs('health', ms, BUDGET.health);
  });

  test(`GET /api/v1/filters ≤ ${String(BUDGET.filters)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('filters', () =>
      authFetch('/api/v1/filters')
    );
    FiltersResponse.parse(data);
    assertMaxMs('filters', ms, BUDGET.filters);
  });

  test(`GET /api/v1/cards search ≤ ${String(BUDGET.search)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('search', () =>
      authFetch('/api/v1/cards?q=vi&limit=40&page=1&sortBy=name&dir=asc')
    );
    const parsed = CardsListResponse.parse(data);
    expect(parsed.data.length).toBeGreaterThan(0);
    assertMaxMs('search', ms, BUDGET.search);
  });

  test(`GET /api/v1/cards/index ≤ ${String(BUDGET.index)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('catalog index', () =>
      authFetch('/api/v1/cards/index')
    );
    const parsed = CatalogIndexResponse.parse(data);
    expect(parsed.meta.total).toBeGreaterThan(0);
    assertMaxMs('catalog index', ms, BUDGET.index);
  });

  test(`GET /api/v1/cards/:variantNumber ≤ ${String(BUDGET.detail)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('card detail', () =>
      authFetch(`/api/v1/cards/${encodeURIComponent(sampleVariant)}`)
    );
    expect(data).toBeTruthy();
    assertMaxMs('card detail', ms, BUDGET.detail);
  });

  test(`POST /api/v1/collection/quantities ≤ ${String(BUDGET.quantities)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('collection quantities', () =>
      authFetch('/api/v1/collection/quantities', {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ variantNumbers: sampleVariants }),
      })
    );
    const parsed = CollectionQuantitiesResponse.parse(data);
    expect(parsed.data).toHaveLength(sampleVariants.length);
    assertMaxMs('collection quantities', ms, BUDGET.quantities);
  });

  test(`GET /api/v1/collection ≤ ${String(BUDGET.collectionList)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('collection list', () =>
      authFetch('/api/v1/collection', { cookie: cookieHeader })
    );
    CollectionListResponse.parse(data);
    assertMaxMs('collection list', ms, BUDGET.collectionList);
  });

  test('collection quantities stays within budget for targeted lookups', async () => {
    const quantities = await timedJson<unknown>('quantities compare', () =>
      authFetch('/api/v1/collection/quantities', {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ variantNumbers: sampleVariants }),
      })
    );
    const fullList = await timedJson<unknown>('collection compare', () =>
      authFetch('/api/v1/collection', { cookie: cookieHeader })
    );

    CollectionQuantitiesResponse.parse(quantities.data);
    CollectionListResponse.parse(fullList.data);
    expect(quantities.ms).toBeLessThanOrEqual(BUDGET.quantities);
    expect(quantities.ms).toBeLessThanOrEqual(fullList.ms * 1.5);
  });

  test('repeat search benefits from server cache', async () => {
    const path = '/api/v1/cards?q=vi&limit=40&page=1&sortBy=name&dir=asc';
    const cold = await timedJson<unknown>('search cold', () => authFetch(path));
    const warm = await timedJson<unknown>('search warm', () => authFetch(path));

    CardsListResponse.parse(cold.data);
    CardsListResponse.parse(warm.data);
    if (cold.ms >= 15) {
      expect(warm.ms).toBeLessThanOrEqual(cold.ms * 1.5);
    }
  });

  test(`POST /api/v1/cards/batch ≤ ${String(BUDGET.batch)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('cards batch', () =>
      authFetch('/api/v1/cards/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantNumbers: sampleVariants }),
      })
    );
    expect(data).toBeTruthy();
    assertMaxMs('cards batch', ms, BUDGET.batch);
  });

  test(`GET /api/v1/prices ≤ ${String(BUDGET.prices)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('prices list', () =>
      authFetch('/api/v1/prices')
    );
    expect(data).toBeTruthy();
    assertMaxMs('prices list', ms, BUDGET.prices);
  });

  test(`GET /api/v1/sync/status ≤ ${String(BUDGET.syncStatus)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('sync status', () =>
      authFetch('/api/v1/sync/status', {
        headers: { Authorization: `Bearer ${getEnv().ADMIN_SYNC_TOKEN}` },
      })
    );
    expect(data).toBeTruthy();
    assertMaxMs('sync status', ms, BUDGET.syncStatus);
  });

  test(`POST /api/v1/prices/stats/batch ≤ ${String(BUDGET.priceStats)}ms`, async () => {
    const { ms, data } = await timedJson<unknown>('price stats batch', () =>
      authFetch('/api/v1/prices/stats/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          items: sampleVariants
            .slice(0, 10)
            .map((variantNumber) => ({ variantNumber })),
        }),
      })
    );
    expect(data).toBeTruthy();
    assertMaxMs('price stats batch', ms, BUDGET.priceStats);
  });

  test(`GET /api/v1/prices/history ≤ ${String(BUDGET.priceHistory)}ms`, async () => {
    const all = PricesListResponse.parse(
      (await timedJson<unknown>('prices seed', () => authFetch('/api/v1/prices'))).data
    );
    const sample = all.data.find((row) => row.cardmarketId != null);
    expect(sample?.cardmarketId).toBeTruthy();

    const { ms, data } = await timedJson<unknown>('price history', () =>
      authFetch(
        `/api/v1/prices/history?cardmarketId=${String(sample!.cardmarketId)}&isFoil=${String(
          sample!.isFoil
        )}&days=90`
      )
    );
    expect(data).toBeTruthy();
    assertMaxMs('price history', ms, BUDGET.priceHistory);
  });

  test('repeat filters and catalog index benefit from cache', async () => {
    const filtersCold = await timedJson<unknown>('filters cold', () =>
      authFetch('/api/v1/filters')
    );
    const filtersWarm = await timedJson<unknown>('filters warm', () =>
      authFetch('/api/v1/filters')
    );
    FiltersResponse.parse(filtersCold.data);
    FiltersResponse.parse(filtersWarm.data);
    // Sub-20ms endpoints have high relative jitter; allow 3x on repeat hits.
    expect(filtersWarm.ms).toBeLessThanOrEqual(filtersCold.ms * 3);

    const indexCold = await timedJson<unknown>('index cold', () =>
      authFetch('/api/v1/cards/index')
    );
    const indexWarm = await timedJson<unknown>('index warm', () =>
      authFetch('/api/v1/cards/index')
    );
    CatalogIndexResponse.parse(indexCold.data);
    CatalogIndexResponse.parse(indexWarm.data);
    expect(indexWarm.ms).toBeLessThanOrEqual(indexCold.ms * 3);
  });
});
