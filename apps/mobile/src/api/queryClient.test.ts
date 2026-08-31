import { describe, expect, mock, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';

mock.module('react-native', () => ({
  AppState: {
    addEventListener: () => ({ remove: () => { } }),
  },
  Platform: { OS: 'ios' },
}));

const {
  createQueryClient,
  invalidateCatalogQueries,
  invalidateUserDataQueries,
  mutationLogAction,
  mutationLogContext,
  removeUserDataQueries,
} = await import('@/src/api/queryClient');
import {
  cardQueryKeys,
  catalogQueryKeys,
  collectionQueryKeys,
  deckQueryKeys,
  wishlistQueryKeys,
} from '@/src/api/queryKeys';
describe('createQueryClient', () => {
  test('enables focus and reconnect refetch by default', () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions().queries;
    expect(defaults?.refetchOnWindowFocus).toBe(true);
    expect(defaults?.refetchOnReconnect).toBe(true);
    expect(defaults?.staleTime).toBe(60_000);
  });

  test('logs mutation failures with action meta and compact context', async () => {
    const logged: unknown[][] = [];
    const originalError = console.error;
    console.error = ((...args: unknown[]) => {
      logged.push(args);
    }) as typeof console.error;

    try {
      const client = createQueryClient();
      const error = new Error("Property 'crypto' doesn't exist");
      const mutation = client.getMutationCache().build(client, {
        mutationKey: ['collection', 'mutation'],
        meta: { action: 'collection.add_detail' },
        mutationFn: async () => {
          throw error;
        },
      });

      await expect(
        mutation.execute({
          variantNumber: 'UNL-205',
          card: { name: 'Abandoned Hall' },
        })
      ).rejects.toBe(error);

      expect(logged).toHaveLength(1);
      expect(logged[0]?.[1]).toBe(error);
      expect(String(logged[0]?.[0])).toContain('"action":"collection.add_detail"');
      expect(String(logged[0]?.[0])).toContain('"variantNumber":"UNL-205"');
      expect(String(logged[0]?.[0])).toContain('"cardName":"Abandoned Hall"');
    } finally {
      console.error = originalError;
    }
  });
});

describe('mutationLogAction', () => {
  test('prefers meta.action then the mutation key', () => {
    expect(
      mutationLogAction(['collection', 'mutation'], { action: 'collection.add' })
    ).toBe('collection.add');
    expect(mutationLogAction(['wishlist'], undefined)).toBe('wishlist');
    expect(mutationLogAction(undefined, undefined)).toBe('mutation');
  });
});

describe('mutationLogContext', () => {
  test('keeps compact fields from mutation variables', () => {
    expect(
      mutationLogContext({
        variantNumber: 'UNL-205',
        card: { name: 'Abandoned Hall' },
        delta: -1,
      })
    ).toEqual({
      variantNumber: 'UNL-205',
      cardName: 'Abandoned Hall',
      delta: -1,
    });
    expect(mutationLogContext('OGN-001')).toEqual({ id: 'OGN-001' });
    expect(mutationLogContext(['OGN-001', 'OGN-002'])).toEqual({ count: 2 });
  });
});

describe('query invalidation helpers', () => {
  test('invalidateUserDataQueries marks account lists stale', async () => {
    const client = new QueryClient();
    const fetchers = {
      collection: 0,
      ownership: 0,
      wishlist: 0,
      decks: 0,
    };

    client.setQueryDefaults(collectionQueryKeys.all, {
      queryFn: async () => {
        fetchers.collection += 1;
        return [];
      },
    });
    client.setQueryDefaults(collectionQueryKeys.ownershipRoot, {
      queryFn: async () => {
        fetchers.ownership += 1;
        return {};
      },
    });
    client.setQueryDefaults(wishlistQueryKeys.all, {
      queryFn: async () => {
        fetchers.wishlist += 1;
        return [];
      },
    });
    client.setQueryDefaults(deckQueryKeys.all, {
      queryFn: async () => {
        fetchers.decks += 1;
        return [];
      },
    });

    await client.prefetchQuery({ queryKey: collectionQueryKeys.all });
    await client.prefetchQuery({ queryKey: collectionQueryKeys.ownershipRoot });
    await client.prefetchQuery({ queryKey: wishlistQueryKeys.all });
    await client.prefetchQuery({ queryKey: deckQueryKeys.all });

    await invalidateUserDataQueries(client);

    await client.fetchQuery({ queryKey: collectionQueryKeys.all });
    await client.fetchQuery({ queryKey: wishlistQueryKeys.all });

    expect(fetchers.collection).toBe(2);
    expect(fetchers.wishlist).toBe(2);
  });

  test('invalidateUserDataQueries does not treat ownership slices as the collection list', async () => {
    const client = new QueryClient();
    let collectionFetches = 0;
    let ownershipSliceFetches = 0;
    const ownershipKey = collectionQueryKeys.ownership(['OGN-001', 'OGN-002']);

    await client.prefetchQuery({
      queryKey: collectionQueryKeys.all,
      queryFn: async () => {
        collectionFetches += 1;
        return [];
      },
    });
    await client.prefetchQuery({
      queryKey: ownershipKey,
      queryFn: async () => {
        ownershipSliceFetches += 1;
        return { 'OGN-001': 0, 'OGN-002': 0 };
      },
    });

    await invalidateUserDataQueries(client);

    // Collection list is exact-matched and refetches when observed again.
    expect(client.getQueryState(collectionQueryKeys.all)?.isInvalidated).toBe(true);
    // Ownership root invalidates by prefix (expected); collection exact:true alone must not storm quantities.
    expect(client.getQueryState(ownershipKey)?.isInvalidated).toBe(true);

    await client.fetchQuery({
      queryKey: collectionQueryKeys.all,
      queryFn: async () => {
        collectionFetches += 1;
        return [];
      },
    });

    expect(collectionFetches).toBe(2);
    expect(ownershipSliceFetches).toBe(1);
  });

  test('removeUserDataQueries clears cached account data', () => {
    const client = new QueryClient();
    client.setQueryData(collectionQueryKeys.all, [
      { variantNumber: 'OGN-001', quantity: 1 },
    ]);
    client.setQueryData(wishlistQueryKeys.all, [{ variantNumber: 'OGN-001' }]);
    client.setQueryData(wishlistQueryKeys.prices, [{ variantNumber: 'OGN-001' }]);

    removeUserDataQueries(client);

    expect(client.getQueryData(collectionQueryKeys.all)).toBeUndefined();
    expect(client.getQueryData(wishlistQueryKeys.all)).toBeUndefined();
    expect(client.getQueryData(wishlistQueryKeys.prices)).toBeUndefined();
  });

  test('wishlist prices refetch reads fresh membership after invalidation', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: 60_000 } },
    });
    let wishlistFetches = 0;

    client.setQueryData(wishlistQueryKeys.all, [{ variantNumber: 'OLD' }]);
    client.setQueryData(wishlistQueryKeys.prices, [{ variantNumber: 'OLD' }]);

    await client.invalidateQueries({ queryKey: wishlistQueryKeys.all });
    await client.invalidateQueries({ queryKey: wishlistQueryKeys.prices });

    // ensureQueryData would return the invalidated cache; fetchQuery must refetch.
    const membership = await client.fetchQuery({
      queryKey: wishlistQueryKeys.all,
      queryFn: async () => {
        wishlistFetches += 1;
        return [{ variantNumber: 'NEW' }];
      },
    });

    expect(membership).toEqual([{ variantNumber: 'NEW' }]);
    expect(wishlistFetches).toBe(1);
    expect(client.getQueryState(wishlistQueryKeys.prices)?.isInvalidated).toBe(true);
  });

  test('invalidateCatalogQueries targets catalog and browse keys', async () => {
    const client = new QueryClient();
    let catalogFetches = 0;

    client.setQueryDefaults(catalogQueryKeys.index, {
      queryFn: async () => {
        catalogFetches += 1;
        return { items: [] };
      },
    });

    await client.prefetchQuery({ queryKey: catalogQueryKeys.index });
    await invalidateCatalogQueries(client);
    await client.fetchQuery({ queryKey: catalogQueryKeys.index });

    expect(catalogFetches).toBe(2);
    expect(cardQueryKeys.browse()).toEqual([
      'cards',
      'browse',
      'default',
      'name',
      'asc',
    ]);
  });
});
