import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import {
  collectionQueryKeys,
  deckQueryKeys,
  wishlistQueryKeys,
} from '@/src/api/queryKeys';
import { createMemoryAsyncStorage } from '../test/memory-async-storage';

const memoryStorage = createMemoryAsyncStorage();
memoryStorage.install();

const hydrateCatalogIndex = mock(async () => undefined);
const prefetchCatalogIndex = mock(async () => undefined);
const prefetchCatalogFilters = mock(async () => undefined);
const prefetchPlayLegendCatalog = mock(async () => undefined);
const hydrateCollectionCache = mock(async () => undefined);
const prefetchCollection = mock(async () => undefined);
const hydrateOwnedDecksCache = mock(async () => undefined);
const prefetchOwnedDecks = mock(async (client: QueryClient) => {
  await client.prefetchQuery({
    queryKey: deckQueryKeys.list('owned'),
    queryFn: async () => [],
  });
});
const prefetchDefaultDeckBrowse = mock(async () => undefined);
const hydrateWishlistCache = mock(async () => undefined);
const prefetchWishlist = mock(async (client: QueryClient) => {
  await client.prefetchQuery({
    queryKey: wishlistQueryKeys.all,
    queryFn: async () => [],
  });
});
const prefetchWishlistPrices = mock(async () => undefined);
const prefetchCollectionInsights = mock(async () => undefined);
const prefetchCollectionShareStatus = mock(async () => undefined);
const getCatalogIndexItems = mock(() => []);
const prefetchImageUris = mock(async () => undefined);
const preloadCriticalLocalAssets = mock(async () => undefined);
const preloadCollectionDashboardAssets = mock(async () => undefined);
const prefetchCardDetail = mock(() => undefined);
const flushCardDetailPrefetch = mock(async () => undefined);
const readLastCachedUserId = mock(async () => null as string | null);
const writeLastCachedUserId = mock(async () => undefined);
const removeUserDataQueries = mock(() => undefined);

mock.module('@/hooks/useCatalogIndex', () => ({
  hydrateCatalogIndex,
  prefetchCatalogIndex,
  getCatalogIndexItems,
}));

mock.module('@/hooks/useFiltersData', () => ({
  prefetchCatalogFilters,
}));

mock.module('@/hooks/useLegendCatalog', () => ({
  prefetchPlayLegendCatalog,
}));

mock.module('@/hooks/useCollection', () => ({
  hydrateCollectionCache,
  prefetchCollection,
}));

mock.module('@/hooks/useDecks', () => ({
  hydrateOwnedDecksCache,
  prefetchOwnedDecks,
  prefetchDefaultDeckBrowse,
}));

mock.module('@/hooks/useWishlist', () => ({
  hydrateWishlistCache,
  prefetchWishlist,
}));

mock.module('@/hooks/useWishlistPrices', () => ({
  prefetchWishlistPrices,
}));

mock.module('@/hooks/useCollectionInsights', () => ({
  prefetchCollectionInsights,
}));

mock.module('@/hooks/useCollectionShare', () => ({
  prefetchCollectionShareStatus,
}));

mock.module('@/lib/imagePrefetch', () => ({
  prefetchImageUris,
}));

mock.module('@/lib/preloadAssets', () => ({
  preloadCriticalLocalAssets,
  preloadCollectionDashboardAssets,
}));

mock.module('@/lib/prefetchCardDetail', () => ({
  prefetchCardDetail,
  flushCardDetailPrefetch,
}));

mock.module('@/services/userCacheScope', () => ({
  readLastCachedUserId,
  writeLastCachedUserId,
}));

mock.module('@/src/api/queryClient', () => ({
  removeUserDataQueries,
}));

const {
  bootstrapAppColdStart,
  bootstrapSignedInUser,
  bootstrapLocal,
  bootstrapCatalog,
  bootstrapUser,
  hydrateSignedInUser,
  refreshSignedInUser,
  bootstrapDeferred,
} = await import('@/services/appBootstrapService');

beforeEach(() => {
  memoryStorage.clear();
  hydrateCatalogIndex.mockClear();
  prefetchCatalogIndex.mockClear();
  prefetchCatalogFilters.mockClear();
  prefetchPlayLegendCatalog.mockClear();
  hydrateCollectionCache.mockClear();
  hydrateOwnedDecksCache.mockClear();
  hydrateWishlistCache.mockClear();
  prefetchCollection.mockClear();
  prefetchOwnedDecks.mockClear();
  prefetchWishlist.mockClear();
  prefetchCollectionShareStatus.mockClear();
  prefetchWishlistPrices.mockClear();
  prefetchCollectionInsights.mockClear();
  prefetchDefaultDeckBrowse.mockClear();
  prefetchImageUris.mockClear();
  flushCardDetailPrefetch.mockClear();
  prefetchCollection.mockImplementation(async () => undefined);
  prefetchOwnedDecks.mockImplementation(async (client: QueryClient) => {
    await client.prefetchQuery({
      queryKey: deckQueryKeys.list('owned'),
      queryFn: async () => [],
    });
  });
  prefetchWishlist.mockImplementation(async (client: QueryClient) => {
    await client.prefetchQuery({
      queryKey: wishlistQueryKeys.all,
      queryFn: async () => [],
    });
  });
  preloadCriticalLocalAssets.mockClear();
  preloadCollectionDashboardAssets.mockClear();
  readLastCachedUserId.mockClear();
  writeLastCachedUserId.mockClear();
  removeUserDataQueries.mockClear();
  readLastCachedUserId.mockImplementation(async () => null);
});

describe('appBootstrapService', () => {
  test('bootstrapLocal hydrates catalog and critical assets only', async () => {
    const client = new QueryClient();
    await bootstrapLocal(client);
    expect(hydrateCatalogIndex).toHaveBeenCalledWith(client);
    expect(preloadCriticalLocalAssets).toHaveBeenCalled();
    expect(preloadCollectionDashboardAssets).not.toHaveBeenCalled();
  });

  test('bootstrapCatalog prefetches filters, index, and warms images', async () => {
    const client = new QueryClient();
    await bootstrapCatalog(client);
    expect(prefetchCatalogFilters).toHaveBeenCalledWith(client);
    expect(prefetchCatalogIndex).toHaveBeenCalledWith(client);
    expect(prefetchImageUris).toHaveBeenCalled();
  });

  test('hydrateSignedInUser seeds disk caches without network or image warm', async () => {
    readLastCachedUserId.mockImplementation(async () => 'user-a');
    const client = new QueryClient();
    await hydrateSignedInUser(client, { userId: 'user-a' });
    expect(hydrateCollectionCache).toHaveBeenCalledWith(client);
    expect(hydrateOwnedDecksCache).toHaveBeenCalledWith(client);
    expect(hydrateWishlistCache).toHaveBeenCalledWith(client);
    expect(prefetchCollection).not.toHaveBeenCalled();
    expect(preloadCollectionDashboardAssets).not.toHaveBeenCalled();
    expect(writeLastCachedUserId).toHaveBeenCalledWith('user-a');
  });

  test('bootstrapUser hydrates wishlist alongside collection and decks for same user', async () => {
    readLastCachedUserId.mockImplementation(async () => 'user-a');
    const client = new QueryClient();
    await bootstrapUser(client, { userId: 'user-a' });
    expect(hydrateCollectionCache).toHaveBeenCalledWith(client);
    expect(hydrateOwnedDecksCache).toHaveBeenCalledWith(client);
    expect(hydrateWishlistCache).toHaveBeenCalledWith(client);
    expect(prefetchCollection).toHaveBeenCalledWith(client);
    expect(prefetchOwnedDecks).toHaveBeenCalledWith(client);
    expect(prefetchWishlist).toHaveBeenCalledWith(client);
    expect(prefetchCollectionShareStatus).toHaveBeenCalledWith(client);
    expect(preloadCollectionDashboardAssets).toHaveBeenCalled();
    expect(removeUserDataQueries).not.toHaveBeenCalled();
    expect(writeLastCachedUserId).toHaveBeenCalledWith('user-a');
  });

  test('bootstrapUser clears prior account caches when user changes', async () => {
    readLastCachedUserId.mockImplementation(async () => 'user-a');
    memoryStorage.store.set('riftbound_collection_cache', '{}');
    memoryStorage.store.set('riftbound_owned_decks_cache', '{}');
    memoryStorage.store.set('riftbound_wishlist_cache', '{}');
    const client = new QueryClient();
    client.setQueryData(collectionQueryKeys.all, [{ variantNumber: 'OLD' }]);
    client.setQueryData(wishlistQueryKeys.all, [{ variantNumber: 'OLD' }]);

    await bootstrapUser(client, { userId: 'user-b' });

    expect(removeUserDataQueries).toHaveBeenCalledWith(client);
    expect(memoryStorage.store.has('riftbound_collection_cache')).toBe(false);
    expect(memoryStorage.store.has('riftbound_owned_decks_cache')).toBe(false);
    expect(memoryStorage.store.has('riftbound_wishlist_cache')).toBe(false);
    expect(hydrateCollectionCache).not.toHaveBeenCalled();
    expect(hydrateOwnedDecksCache).not.toHaveBeenCalled();
    expect(hydrateWishlistCache).not.toHaveBeenCalled();
    expect(prefetchCollection).toHaveBeenCalledWith(client);
    expect(prefetchOwnedDecks).toHaveBeenCalledWith(client);
    expect(prefetchWishlist).toHaveBeenCalledWith(client);
    expect(writeLastCachedUserId).toHaveBeenCalledWith('user-b');
  });

  test('bootstrapDeferred signed-in warms remaining tabs', async () => {
    const client = new QueryClient();
    await bootstrapDeferred(client, { signedIn: true });
    expect(prefetchPlayLegendCatalog).toHaveBeenCalledWith(client);
    expect(flushCardDetailPrefetch).toHaveBeenCalled();
    expect(prefetchWishlistPrices).toHaveBeenCalledWith(client);
    expect(prefetchDefaultDeckBrowse).toHaveBeenCalledWith(client);
  });

  test('bootstrapAppColdStart reports local and catalog before returning', async () => {
    const client = new QueryClient();
    const phases: string[] = [];
    await bootstrapAppColdStart(client, {
      onPhaseComplete: (phase) => phases.push(phase),
    });
    expect(phases).toEqual(['local', 'catalog']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(phases).toContain('deferred');
  });

  test('bootstrapSignedInUser opens gate after hydrate; refresh runs in background', async () => {
    readLastCachedUserId.mockImplementation(async () => 'user-a');
    const client = new QueryClient();
    const phases: string[] = [];

    let resolveRefresh: (() => void) | undefined;
    const refreshGate = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });
    prefetchCollection.mockImplementation(async () => {
      await refreshGate;
    });

    const signedIn = bootstrapSignedInUser(client, {
      userId: 'user-a',
      onPhaseComplete: (phase) => phases.push(phase),
    });

    await signedIn;
    expect(phases).toEqual(['user']);
    expect(hydrateCollectionCache).toHaveBeenCalled();
    expect(prefetchCollection).toHaveBeenCalled();
    expect(prefetchWishlistPrices).not.toHaveBeenCalled();

    resolveRefresh?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(phases).toContain('deferred');
    expect(prefetchWishlistPrices).toHaveBeenCalled();
  });

  test('refreshSignedInUser warms collection dashboard after network', async () => {
    const client = new QueryClient();
    await refreshSignedInUser(client, { userId: 'user-a' });
    expect(prefetchCollection).toHaveBeenCalledWith(client);
    expect(preloadCollectionDashboardAssets).toHaveBeenCalled();
    expect(writeLastCachedUserId).toHaveBeenCalledWith('user-a');
  });

  test('prefetch helpers register deck and wishlist cache keys', async () => {
    readLastCachedUserId.mockImplementation(async () => 'user-a');
    const client = new QueryClient();
    await bootstrapUser(client, { userId: 'user-a' });
    expect(client.getQueryState(deckQueryKeys.list('owned'))).toBeDefined();
    expect(client.getQueryState(wishlistQueryKeys.all)).toBeDefined();
  });
});
