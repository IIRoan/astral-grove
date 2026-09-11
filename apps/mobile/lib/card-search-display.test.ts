import { describe, expect, test } from 'bun:test';
import type { CardListItem } from '@riftbound/contracts';
import {
  localCardSearchMeta,
  paginateLocalCardSearch,
  pickCardSearchRawItems,
} from '@/lib/card-search-display';

const card = {
  cardId: '1',
  variantNumber: 'OGN-001',
  name: 'Vi Destructive',
} as CardListItem;

function numberedCards(count: number): CardListItem[] {
  return Array.from({ length: count }, (_, index) => ({
    ...card,
    cardId: String(index),
    variantNumber: `OGN-${String(index + 1).padStart(3, '0')}`,
  }));
}

describe('paginateLocalCardSearch', () => {
  test('returns a page window instead of a cumulative prefix', () => {
    const pool = numberedCards(100);
    const page1 = paginateLocalCardSearch(pool, 1, 40);
    const page2 = paginateLocalCardSearch(pool, 2, 40);

    expect(page1.items.map((item) => item.cardId)).toEqual(
      pool.slice(0, 40).map((item) => item.cardId)
    );
    expect(page2.items.map((item) => item.cardId)).toEqual(
      pool.slice(40, 80).map((item) => item.cardId)
    );
    expect(page2.loadedItems).toHaveLength(80);
    expect(page1.hasNextPage).toBe(true);
    expect(page2.hasNextPage).toBe(true);

    const concatenated = [...page1.items, ...page2.items].map((item) => item.cardId);
    expect(new Set(concatenated).size).toBe(80);
  });

  test('page 3 of a 100-item pool is the remaining 20 cards', () => {
    const pool = numberedCards(100);
    const page3 = paginateLocalCardSearch(pool, 3, 40);
    expect(page3.items).toHaveLength(20);
    expect(page3.items[0]?.cardId).toBe('80');
    expect(page3.hasNextPage).toBe(false);
    expect(page3.loadedItems).toHaveLength(100);
  });
});

describe('localCardSearchMeta', () => {
  test('reports the current page and a fixed page size', () => {
    const meta = localCardSearchMeta(100, 2, 40);
    expect(meta.pagination).toEqual({
      total: 100,
      page: 2,
      limit: 40,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
  });
});

describe('pickCardSearchRawItems', () => {
  test('prefers local matches while the API is still loading', () => {
    const picked = pickCardSearchRawItems({
      hasApiItems: false,
      apiItems: [],
      inputMatchesActive: true,
      instantCacheItems: [],
      localItems: [card],
      isFetching: true,
    });
    expect(picked).toEqual([card]);
  });

  test('keeps the last instant cache when the draft no longer matches the active term', () => {
    const picked = pickCardSearchRawItems({
      hasApiItems: false,
      apiItems: [],
      inputMatchesActive: false,
      instantCacheItems: [card],
      localItems: [],
      isFetching: true,
    });
    expect(picked).toEqual([card]);
  });

  test('uses local items when the API returns an empty page', () => {
    const picked = pickCardSearchRawItems({
      hasApiItems: false,
      apiItems: [],
      inputMatchesActive: true,
      instantCacheItems: [],
      localItems: [card],
      isFetching: false,
    });
    expect(picked).toEqual([card]);
  });

  test('prefers local matches while the draft is ahead of the debounced API term', () => {
    const picked = pickCardSearchRawItems({
      hasApiItems: true,
      apiItems: [{ ...card, variantNumber: 'OGN-002', name: 'Stale API' }],
      inputMatchesActive: false,
      instantCacheItems: [],
      localItems: [card],
      isFetching: true,
    });
    expect(picked).toEqual([card]);
  });

  test('uses API items once the server page is ready', () => {
    const apiCard = { ...card, variantNumber: 'OGN-002', name: 'Jinx Rebel' };
    const picked = pickCardSearchRawItems({
      hasApiItems: true,
      apiItems: [apiCard],
      inputMatchesActive: true,
      instantCacheItems: [card],
      localItems: [card],
      isFetching: false,
    });
    expect(picked).toEqual([apiCard]);
  });
});
