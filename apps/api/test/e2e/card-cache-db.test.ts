import { describe, expect, test, setDefaultTimeout } from 'bun:test';
import { count, eq } from 'drizzle-orm';
import { CardsListResponse, CatalogIndexResponse } from '@riftbound/contracts';
import { apiJson, getContext } from './support.js';
import { syncState, variants } from '../../src/db/schema.js';
import { sumSetPrintCounts } from '../../src/lib/catalog-total.js';
import { expectedCatalogTotal } from '../fixtures/enriched-filters.js';

setDefaultTimeout(120_000);

describe('card cache database integrity', () => {
  test('variants table is populated after catalog sync', async () => {
    const { cardCache, db } = getContext();
    const variantCount = await cardCache.countVariants();
    expect(variantCount).toBeGreaterThan(100);

    const [row] = await db.select({ value: count() }).from(variants);
    expect(row?.value).toBe(variantCount);
  });

  test('sync_state catalog hash matches CardCacheService', async () => {
    const { cardCache, db } = getContext();
    const [catalog] = await db
      .select()
      .from(syncState)
      .where(eq(syncState.key, 'catalog'))
      .limit(1);

    expect(catalog?.contentHash).toBeTruthy();
    expect(await cardCache.getCatalogHash()).toBe(catalog?.contentHash);
    expect(catalog?.rowCount ?? 0).toBeGreaterThan(0);
  });

  test('filter snapshot row count aligns with expanded catalog total', async () => {
    const { catalogMetadata } = getContext();
    const meta = await catalogMetadata.getFiltersMeta();
    expect(meta.variantCount).toBeGreaterThanOrEqual(expectedCatalogTotal);
    expect(meta.variantCount).toBe(sumSetPrintCounts(meta.snapshot));
    expect(meta.catalogHash.length).toBeGreaterThan(0);
    expect(meta.pricesCatalogHash.length).toBeGreaterThan(0);
    expect(meta.snapshot.sets.length).toBeGreaterThan(0);
  });
});

describe('card cache service reads', () => {
  test('getByVariantNumber serves from Postgres cache', async () => {
    const { cardCache } = getContext();
    const list = CardsListResponse.parse(
      await apiJson<unknown>('/api/v1/cards?limit=1')
    );
    const variantNumber = list.data[0]?.variantNumber;
    expect(variantNumber).toBeTruthy();

    const cached = await cardCache.getByVariantNumber(variantNumber!);
    expect(cached.source).toBe('cache');
    expect(cached.detail.variants.some((v) => v.variantNumber === variantNumber)).toBe(
      true
    );
    expect(cached.contentHash.length).toBeGreaterThan(0);
  });

  test('batchGet resolves cached variants without upstream', async () => {
    const { cardCache } = getContext();
    const list = CardsListResponse.parse(
      await apiJson<unknown>('/api/v1/cards?limit=5')
    );
    const variantNumbers = list.data.map((row) => row.variantNumber);

    const batch = await cardCache.batchGet(variantNumbers);
    expect(batch.source).toBe('cache');
    expect(batch.notFound).toEqual([]);
    expect(batch.found).toHaveLength(variantNumbers.length);
  });

  test('listIndex matches HTTP catalog index totals', async () => {
    const { cardCache } = getContext();
    const [serviceIndex, httpIndex] = await Promise.all([
      cardCache.listIndex(),
      apiJson<unknown>('/api/v1/cards/index').then((json) =>
        CatalogIndexResponse.parse(json)
      ),
    ]);

    expect(serviceIndex.total).toBe(httpIndex.meta.total);
    expect(serviceIndex.catalogHash).toBe(httpIndex.meta.catalogHash);
    expect(serviceIndex.pricesCatalogHash).toBe(httpIndex.meta.pricesCatalogHash);
    expect(serviceIndex.items.length).toBe(httpIndex.data.length);
  });

  test('searchLocal results align with HTTP cards list for the same query', async () => {
    const { cardCache } = getContext();
    const query = {
      q: 'vi',
      page: 1,
      limit: 20,
      sortBy: 'name' as const,
      dir: 'asc' as const,
    };

    const [serviceResult, httpList] = await Promise.all([
      cardCache.search(query),
      apiJson<unknown>('/api/v1/cards?q=vi&limit=20&page=1&sortBy=name&dir=asc').then(
        (json) => CardsListResponse.parse(json)
      ),
    ]);

    expect(serviceResult.total).toBe(httpList.meta.pagination.total);
    expect(serviceResult.items.length).toBe(httpList.data.length);
    expect(serviceResult.items[0]?.variantNumber).toBe(httpList.data[0]?.variantNumber);
  });
});

describe('card cache in-memory TTL', () => {
  test('repeat search hits the service cache', async () => {
    const { cardCache } = getContext();
    const query = {
      q: 'darius',
      page: 1,
      limit: 25,
      sortBy: 'name' as const,
      dir: 'asc' as const,
    };

    cardCache.invalidateSearchCache();

    const coldStart = performance.now();
    const cold = await cardCache.search(query);
    const coldMs = performance.now() - coldStart;

    const warmStart = performance.now();
    const warm = await cardCache.search(query);
    const warmMs = performance.now() - warmStart;

    expect(warm.total).toBe(cold.total);
    expect(warm.items.length).toBe(cold.items.length);
    expect(warmMs).toBeLessThanOrEqual(coldMs * 0.75);
  });

  test('invalidateSearchCache forces a fresh DB read', async () => {
    const { cardCache } = getContext();
    const query = {
      q: 'jinx',
      page: 1,
      limit: 10,
      sortBy: 'name' as const,
      dir: 'asc' as const,
    };

    const first = await cardCache.search(query);
    cardCache.invalidateSearchCache();
    const second = await cardCache.search(query);

    expect(second.total).toBe(first.total);
    expect(second.items.length).toBe(first.items.length);
  });
});
