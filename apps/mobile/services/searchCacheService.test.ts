import { beforeEach, describe, expect, test } from 'bun:test';
import type { CardsListResponse } from '@riftbound/contracts';
import { DEFAULT_CATALOG_FILTERS } from '@/constants/catalogFilters';
import { DEFAULT_CATALOG_SORT } from '@/constants/catalogSort';
import { createMemoryAsyncStorage } from '../test/memory-async-storage';

const memoryStorage = createMemoryAsyncStorage();
memoryStorage.install();

const scope = {
  sort: DEFAULT_CATALOG_SORT,
  filters: DEFAULT_CATALOG_FILTERS,
  limit: 40,
};

const { cacheSearchResults, getCachedSearchResults, searchResultsCacheKey } =
  await import('./searchCacheService');

const sampleResponse = {
  data: [
    {
      cardId: '00000000-0000-0000-0000-000000000001',
      variantNumber: 'OGN-001',
      name: 'Vi Destructive',
      type: 'Unit',
      energy: 2,
      might: 2,
      power: 2,
      rarity: 'Rare',
      setCode: 'OGN',
      colors: ['Body'],
      imageUrl: 'https://example.com/vi.jpg',
      cardmarketId: null,
      priceEur: null,
      printings: [
        {
          variantNumber: 'OGN-001',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: null,
        },
      ],
      isBanned: false,
    },
  ],
  meta: {
    pagination: {
      total: 1,
      page: 1,
      limit: 40,
      totalPages: 1,
      hasNext: false,
    },
    source: 'cache' as const,
    catalogHash: 'hash-v1',
  },
} satisfies CardsListResponse;

beforeEach(() => {
  memoryStorage.clear();
});

describe('searchCacheService', () => {
  test('cacheSearchResults returns a hit for the same query and scope', async () => {
    await cacheSearchResults('Viktor', scope, sampleResponse);

    const cached = await getCachedSearchResults('viktor', scope);
    expect(cached?.data[0]?.name).toBe('Vi Destructive');
  });

  test('cache keys isolate sort and filters', async () => {
    await cacheSearchResults('vi', scope, sampleResponse);
    const priceScope = {
      ...scope,
      sort: { sortBy: 'price' as const, dir: 'desc' as const },
    };
    expect(await getCachedSearchResults('vi', priceScope)).toBeNull();
    expect(searchResultsCacheKey('vi', scope)).not.toBe(
      searchResultsCacheKey('vi', priceScope)
    );
  });

  test('getCachedSearchResults ignores expired entries', async () => {
    const expiredEntry = {
      cacheKey: searchResultsCacheKey('viktor', scope),
      cachedAt: Date.now() - 2 * 60 * 60 * 1000,
      response: sampleResponse,
    };
    memoryStorage.store.set(
      'riftbound_search_cache_norm-v1',
      JSON.stringify([expiredEntry])
    );

    expect(await getCachedSearchResults('viktor', scope)).toBeNull();
  });

  test('caches two-character names like Vi', async () => {
    await cacheSearchResults('Vi', scope, sampleResponse);
    expect(await getCachedSearchResults('vi', scope)).not.toBeNull();
  });

  test('does not cache empty misses so a later API fix can surface', async () => {
    const empty: CardsListResponse = {
      ...sampleResponse,
      data: [],
      meta: {
        ...sampleResponse.meta,
        pagination: { ...sampleResponse.meta.pagination, total: 0 },
      },
    };
    await cacheSearchResults('embessa', scope, empty);
    expect(await getCachedSearchResults('embessa', scope)).toBeNull();
  });
});
