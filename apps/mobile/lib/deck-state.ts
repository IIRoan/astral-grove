import type { QueryClient } from '@tanstack/react-query';
import type { DeckState } from '@/lib/deck-types';
import { deckQueryKeys } from '@/src/api/queryKeys';

/** Merge remote deck into the query cache only when it is newer than local state. */
export function pickNewerDeckState(
  current: DeckState | null,
  incoming: DeckState
): DeckState {
  if (!current || current.id !== incoming.id) return incoming;
  const versionChanged = Boolean(
    current.versionId && incoming.versionId && current.versionId !== incoming.versionId
  );
  const payload =
    versionChanged || incoming.updatedAt > current.updatedAt ? incoming : current;
  if (incoming.versions?.length) {
    return {
      ...payload,
      versions: incoming.versions,
      ...(incoming.versionId ? { versionId: incoming.versionId } : {}),
      ...(incoming.versionName ? { versionName: incoming.versionName } : {}),
    };
  }
  if (current.versions?.length) {
    return {
      ...payload,
      versions: current.versions,
      ...(payload.versionId ? { versionId: payload.versionId } : {}),
      ...(payload.versionName ? { versionName: payload.versionName } : {}),
    };
  }
  return payload;
}

export function applyDeckStateIfNewerToCache(
  queryClient: QueryClient,
  deckId: string,
  incoming: DeckState | null
): void {
  if (!incoming) return;
  queryClient.setQueryData<DeckState | null>(deckQueryKeys.detail(deckId), (current) =>
    pickNewerDeckState(current ?? null, incoming)
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
