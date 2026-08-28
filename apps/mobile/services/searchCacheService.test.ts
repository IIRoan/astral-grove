import { beforeEach, describe, expect, test } from 'bun:test';
import type { CardsListResponse } from '@riftbound/contracts';
import { createMemoryAsyncStorage } from '../test/memory-async-storage';

const memoryStorage = createMemoryAsyncStorage();
memoryStorage.install();

const { cacheSearchResults, getCachedSearchResults } =
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
  test('cacheSearchResults returns a hit for the same query', async () => {
    await cacheSearchResults('Viktor', sampleResponse);

    const cached = await getCachedSearchResults('viktor');
    expect(cached?.data[0]?.name).toBe('Vi Destructive');
  });

  test('getCachedSearchResults ignores expired entries', async () => {
    const expiredEntry = {
      query: 'viktor',
      cachedAt: Date.now() - 2 * 60 * 60 * 1000,
      response: sampleResponse,
    };
    memoryStorage.store.set('riftbound_search_cache', JSON.stringify([expiredEntry]));

    expect(await getCachedSearchResults('viktor')).toBeNull();
  });

  test('caches two-character names like Vi', async () => {
    await cacheSearchResults('Vi', sampleResponse);
    expect(await getCachedSearchResults('vi')).not.toBeNull();
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
    await cacheSearchResults('embessa', empty);
    expect(await getCachedSearchResults('embessa')).toBeNull();
  });
});
