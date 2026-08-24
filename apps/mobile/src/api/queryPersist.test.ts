import { describe, expect, mock, test } from 'bun:test';

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: mock(async () => null),
    setItem: mock(async () => undefined),
    removeItem: mock(async () => undefined),
  },
}));

const { shouldPersistQuery, QUERY_PERSIST_KEY } =
  await import('@/src/api/queryPersist');

describe('queryPersist', () => {
  test('persists filters, collection, wishlist, and catalog meta', () => {
    expect(
      shouldPersistQuery({
        queryKey: ['filters'],
        state: { status: 'success' },
      })
    ).toBe(true);
    expect(
      shouldPersistQuery({
        queryKey: ['collection'],
        state: { status: 'success' },
      })
    ).toBe(true);
    expect(
      shouldPersistQuery({
        queryKey: ['wishlist'],
        state: { status: 'success' },
      })
    ).toBe(true);
    expect(
      shouldPersistQuery({
        queryKey: ['catalog', 'meta'],
        state: { status: 'success' },
      })
    ).toBe(true);
  });

  test('skips catalog index, decks, and wishlist prices', () => {
    expect(
      shouldPersistQuery({
        queryKey: ['catalog', 'index'],
        state: { status: 'success' },
      })
    ).toBe(false);
    expect(
      shouldPersistQuery({
        queryKey: ['decks', 'list', 'owned', ''],
        state: { status: 'success' },
      })
    ).toBe(false);
    expect(
      shouldPersistQuery({
        queryKey: ['wishlist', 'prices', '30d'],
        state: { status: 'success' },
      })
    ).toBe(false);
    expect(
      shouldPersistQuery({
        queryKey: ['collection', 'recent-adds', 'OGN-001'],
        state: { status: 'success' },
      })
    ).toBe(false);
  });

  test('skips unsuccessful queries', () => {
    expect(
      shouldPersistQuery({
        queryKey: ['filters'],
        state: { status: 'pending' },
      })
    ).toBe(false);
  });

  test('uses a versioned storage key', () => {
    expect(QUERY_PERSIST_KEY).toContain('astral-grove-react-query');
  });
});
