import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { createEmptyDeck } from '@/lib/deck-card';
import { deckQueryKeys } from '@/src/api/queryKeys';
import { createMemoryAsyncStorage } from '../test/memory-async-storage';

const memoryStorage = createMemoryAsyncStorage();
memoryStorage.install();

const listDecks = mock(async (): Promise<ReturnType<typeof createEmptyDeck>[]> => []);

mock.module('@/services/deckService', () => ({
  listDecks,
}));

const {
  clearPersistedOwnedDecks,
  persistOwnedDecks,
} = await import('./deckCacheService');
const { hydrateOwnedDecksCache, prefetchOwnedDecks } = await import('./ownedDecksCache');

beforeEach(async () => {
  memoryStorage.clear();
  await clearPersistedOwnedDecks();
  listDecks.mockClear();
  listDecks.mockImplementation(async () => []);
});

describe('ownedDecksCache', () => {
  test('hydrate seeds a stale list so prefetch still hits the network', async () => {
    const staleDeck = createEmptyDeck('Stale on device');
    await persistOwnedDecks([staleDeck]);

    const client = new QueryClient();
    await hydrateOwnedDecksCache(client);

    expect(client.getQueryData(deckQueryKeys.list('owned'))).toHaveLength(1);
    expect(client.getQueryState(deckQueryKeys.list('owned'))?.dataUpdatedAt).toBe(0);

    const remoteDeck = createEmptyDeck('From server');
    listDecks.mockImplementation(async () => [remoteDeck]);

    await prefetchOwnedDecks(client);

    expect(listDecks).toHaveBeenCalled();
    const next = client.getQueryData(deckQueryKeys.list('owned'));
    expect(next).toHaveLength(1);
    expect(next?.[0]?.name).toBe('From server');
  });

  test('prefetch replaces disk hydrate when a deck was deleted elsewhere', async () => {
    const kept = createEmptyDeck('Kept');
    const deletedElsewhere = createEmptyDeck('Deleted elsewhere');
    await persistOwnedDecks([kept, deletedElsewhere]);

    const client = new QueryClient();
    await hydrateOwnedDecksCache(client);
    client.setQueryData(deckQueryKeys.detail(deletedElsewhere.id), deletedElsewhere);

    listDecks.mockImplementation(async () => [kept]);
    await prefetchOwnedDecks(client);

    const list = client.getQueryData(deckQueryKeys.list('owned'));
    expect(list?.map((deck) => deck.id)).toEqual([kept.id]);
    expect(client.getQueryData(deckQueryKeys.detail(deletedElsewhere.id))).toBeUndefined();
  });

  test('prefetchOwnedDecks fetches even when an in-memory list looks fresh', async () => {
    const client = new QueryClient();
    const localOnly = createEmptyDeck('Local only');
    client.setQueryData(deckQueryKeys.list('owned'), [localOnly]);

    listDecks.mockImplementation(async () => []);
    await prefetchOwnedDecks(client);

    expect(listDecks).toHaveBeenCalled();
    expect(client.getQueryData(deckQueryKeys.list('owned'))).toEqual([]);
  });
});
