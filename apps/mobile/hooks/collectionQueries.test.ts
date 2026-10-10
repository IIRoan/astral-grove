import { beforeEach, expect, mock, test } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { CardListItem } from '@riftbound/contracts';
import type { CollectionEntry } from '@/services/collectionService';
import { collectionQueryKeys } from '@/src/api/queryKeys';
import { bumpCollectionMutationGeneration } from '@/hooks/collectionMutationGeneration';

const getCollection = mock(async (): Promise<CollectionEntry[]> => []);
const persistCollection = mock(async (): Promise<void> => undefined);
const addToCollection = mock(async (): Promise<void> => undefined);
mock.module('@/services/collectionService', () => ({
  getCollection,
  addDetailToCollection: mock(),
  addToCollection,
  adjustCollectionQuantity: mock(),
  removeFromCollection: mock(),
  removeManyFromCollection: mock(),
  updateCollectionQuantity: mock(),
}));
mock.module('@/services/collectionCacheService', () => ({
  persistCollection,
  readPersistedCollection: mock(async () => null),
}));
mock.module('@/services/remoteCollectionService', () => ({
  fetchRemoteCollectionQuantities: mock(async () => []),
}));
mock.module('@/hooks/useCollectionShare', () => ({ useCollectionShareStatus: mock() }));
mock.module('@/src/lib/auth-client', () => ({
  authClient: { useSession: mock(() => ({ data: null })) },
}));

const { prefetchCollection, useCollectionMutations } =
  await import('@/hooks/useCollection');
beforeEach(() => {
  getCollection.mockReset();
  persistCollection.mockReset();
  addToCollection.mockClear();
});

test.each([false, true])(
  'adding while paginated history is loaded preserves its pages (failure: %s)',
  async (fails) => {
    const client = new QueryClient();
    const historyKey = collectionQueryKeys.activityHistory(['OGN-001']);
    const history = {
      pages: [{ data: [], meta: { hasMore: false, nextCursor: null } }],
      pageParams: [undefined],
    };
    client.setQueryData(historyKey, history);
    client.setQueryData(collectionQueryKeys.recentAdds(['OGN-001']), []);
    let add!: ReturnType<typeof useCollectionMutations>['addCard']['mutateAsync'];
    function Probe() {
      add = useCollectionMutations().addCard.mutateAsync;
      return null;
    }
    renderToString(
      createElement(QueryClientProvider, { client }, createElement(Probe))
    );
    const card: CardListItem = {
      cardId: '00000000-0000-4000-8000-000000000001',
      variantNumber: 'OGN-001',
      name: 'Ahri',
      type: 'Legend',
      energy: 0,
      might: 0,
      power: 0,
      rarity: 'Rare',
      setCode: 'OGN',
      colors: ['Calm'],
      imageUrl: '',
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
    };
    addToCollection.mockImplementation(async () => {
      if (fails) throw new Error('Add failed');
    });
    if (fails) await expect(add({ card })).rejects.toThrow('Add failed');
    else await add({ card });
    expect(addToCollection).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(historyKey)).toEqual(history);
    expect(
      client.getQueryData(collectionQueryKeys.recentAdds(['OGN-001']))
    ).toHaveLength(fails ? 0 : 1);
  }
);

test('publishes fetched collection data without waiting for native disk persistence', async () => {
  const client = new QueryClient();
  getCollection.mockResolvedValue([]);
  let finishPersistence!: () => void;
  persistCollection.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishPersistence = resolve;
      })
  );
  const fetch = prefetchCollection(client);
  try {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(client.getQueryData(collectionQueryKeys.all)).toEqual([]);
  } finally {
    finishPersistence();
    await fetch;
  }
});

test('a stale refresh preserves optimistic collection and ownership data', async () => {
  const client = new QueryClient();
  const optimistic = [
    { variantNumber: 'OGN-001', quantity: 1, isFoil: false },
  ] as CollectionEntry[];
  let finishRefresh!: (entries: CollectionEntry[]) => void;
  getCollection.mockImplementation(
    () =>
      new Promise<CollectionEntry[]>((resolve) => {
        finishRefresh = resolve;
      })
  );
  const fetch = prefetchCollection(client);
  bumpCollectionMutationGeneration(client);
  client.setQueryData(collectionQueryKeys.all, optimistic);
  client.setQueryData(collectionQueryKeys.ownershipRoot, {
    'OGN-001': 1,
    'OGN-001::std': 1,
  });
  finishRefresh([]);
  await fetch;
  expect(client.getQueryData(collectionQueryKeys.all)).toEqual(optimistic);
  expect(client.getQueryData(collectionQueryKeys.ownershipRoot)).toEqual({
    'OGN-001': 1,
    'OGN-001::std': 1,
  });
  expect(persistCollection).not.toHaveBeenCalled();
});
