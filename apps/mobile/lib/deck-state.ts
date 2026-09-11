import type { QueryClient } from '@tanstack/react-query';
import type { DeckState } from '@/lib/deck-types';
import { deckQueryKeys } from '@/src/api/queryKeys';

/** Merge remote deck into the query cache only when it is newer than local state. */
export function applyDeckStateIfNewerToCache(
  queryClient: QueryClient,
  deckId: string,
  incoming: DeckState | null
): void {
  if (!incoming) return;
  queryClient.setQueryData<DeckState | null>(
    deckQueryKeys.detail(deckId),
    (current) => {
      if (!current || current.id !== incoming.id) return incoming;
      if (incoming.updatedAt > current.updatedAt) return incoming;
      return current;
    }
  );
}

export function setDeckDetailCache(queryClient: QueryClient, deck: DeckState): void {
  queryClient.setQueryData(deckQueryKeys.detail(deck.id), deck);
  queryClient.setQueryData<DeckState[]>(deckQueryKeys.list('owned'), (current) => {
    if (!current?.length) return current;
    const index = current.findIndex((entry) => entry.id === deck.id);
    if (index < 0) return current;
    const next = [...current];
    next[index] = deck;
    return next;
  });
}
