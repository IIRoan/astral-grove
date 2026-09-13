import type { QueryClient } from '@tanstack/react-query';
import type { DeckState } from '@/lib/deck-types';
import { applyDeckStateIfNewerToCache } from '@/lib/deck-state';
import {
  persistOwnedDecks,
  readPersistedOwnedDecks,
} from '@/services/deckCacheService';
import { listDecks } from '@/services/deckService';
import { deckQueryKeys } from '@/src/api/queryKeys';

function seedDeckDetailCaches(queryClient: QueryClient, decks: DeckState[]): void {
  for (const deck of decks) {
    const current = queryClient.getQueryData<DeckState | null>(
      deckQueryKeys.detail(deck.id)
    );
    if (current && !deck.versions?.length) continue;
    applyDeckStateIfNewerToCache(queryClient, deck.id, deck);
  }
}

function isDeckDetailQueryKey(
  queryKey: readonly unknown[]
): queryKey is readonly ['decks', string] {
  return (
    queryKey.length === 2 &&
    queryKey[0] === 'decks' &&
    typeof queryKey[1] === 'string' &&
    queryKey[1] !== 'list' &&
    queryKey[1] !== 'browse'
  );
}

/** Drop detail caches for decks removed on another device. */
export function pruneMissingDeckDetailCaches(
  queryClient: QueryClient,
  decks: DeckState[]
): void {
  const keep = new Set(decks.map((deck) => deck.id));
  for (const [queryKey] of queryClient.getQueriesData({
    queryKey: deckQueryKeys.all,
  })) {
    if (!isDeckDetailQueryKey(queryKey)) continue;
    if (keep.has(queryKey[1])) continue;
    queryClient.removeQueries({ queryKey });
  }
}

export async function fetchOwnedDecks(queryClient: QueryClient): Promise<DeckState[]> {
  const decks = await listDecks({ source: 'owned' });
  seedDeckDetailCaches(queryClient, decks);
  pruneMissingDeckDetailCaches(queryClient, decks);
  await persistOwnedDecks(decks);
  return decks;
}

/** Seed owned-deck list (+ detail) caches from AsyncStorage before network. */
export async function hydrateOwnedDecksCache(queryClient: QueryClient): Promise<void> {
  const cached = await readPersistedOwnedDecks();
  if (!cached?.length) return;
  if (!queryClient.getQueryData<DeckState[]>(deckQueryKeys.list('owned'))) {
    // updatedAt: 0 keeps disk seed stale so bootstrap/list always refetch.
    queryClient.setQueryData(deckQueryKeys.list('owned'), cached, {
      updatedAt: 0,
    });
  }
  seedDeckDetailCaches(queryClient, cached);
}

/** Always hit the network so deletes from other devices replace disk hydrate. */
export function prefetchOwnedDecks(queryClient: QueryClient): Promise<void> {
  return queryClient
    .fetchQuery({
      queryKey: deckQueryKeys.list('owned'),
      queryFn: () => fetchOwnedDecks(queryClient),
      staleTime: 0,
    })
    .then(() => undefined);
}
