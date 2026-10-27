import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { DeckState } from '@/lib/deck-types';
import { deckQueryKeys } from '@/src/api/queryKeys';
import { useDeckLiveLegality } from '@/hooks/useBanDatesByVariant';
import { applyDeckStateIfNewerToCache, setDeckDetailCache } from '@/lib/deck-state';
import {
  flushRemoteDeckSave,
  getDeck,
  hasPendingDeckSave,
  queueRemoteDeckSave,
  scheduleRemoteDeckSave,
} from '@/services/deckService';

type PersistInput = DeckState | ((previous: DeckState) => DeckState);

type PersistOptions = {
  /** Save to the account immediately instead of waiting for debounce. */
  immediate?: boolean;
};

/** Shared deck detail — single source of truth for editor and add screens. */
export function useDeckDetail(deckId: string | undefined, shared = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: shared ? ['shared-deck', deckId] : deckQueryKeys.detail(deckId ?? ''),
    queryFn: () => getDeck(deckId!, shared),
    enabled: Boolean(deckId),
    staleTime: shared ? 0 : 5_000,
    ...(shared ? { gcTime: 0 } : {}),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    initialData: () => {
      if (shared || !deckId) return undefined;
      return (
        queryClient.getQueryData<DeckState | null>(deckQueryKeys.detail(deckId)) ??
        undefined
      );
    },
  });

  const { deck: deckWithLegality, isRefreshing: isRefreshingLegality } =
    useDeckLiveLegality(query.data ?? null);

  useFocusEffect(
    useCallback(() => {
      if (shared) {
        void query.refetch();
        return;
      }
      if (!deckId || hasPendingDeckSave(deckId)) return;
      void getDeck(deckId).then((loaded) => {
        if (hasPendingDeckSave(deckId)) return;
        applyDeckStateIfNewerToCache(queryClient, deckId, loaded);
      });
    }, [deckId, queryClient, shared, query.refetch])
  );

  const persist = useCallback(
    (input: PersistInput, options?: PersistOptions) => {
      if (shared || !deckId) return;
      const previous =
        queryClient.getQueryData<DeckState | null>(deckQueryKeys.detail(deckId)) ??
        null;
      if (!previous || previous.readOnly) return;
      const next = typeof input === 'function' ? input(previous) : input;
      setDeckDetailCache(queryClient, next);
      queueRemoteDeckSave(next);
      if (options?.immediate) {
        void flushRemoteDeckSave(next.id, next.versionId).then((saved) => {
          if (!saved) return;
          const current = queryClient.getQueryData<DeckState | null>(
            deckQueryKeys.detail(deckId)
          );
          if (
            current?.versionId &&
            saved.versionId &&
            current.versionId !== saved.versionId
          ) {
            return;
          }
          setDeckDetailCache(queryClient, saved);
        });
        return;
      }
      scheduleRemoteDeckSave(next);
    },
    [deckId, queryClient, shared]
  );

  const flushSave = useCallback(async () => {
    if (shared || !deckId) return null;
    const latest =
      queryClient.getQueryData<DeckState | null>(deckQueryKeys.detail(deckId)) ?? null;
    if (!latest || latest.readOnly) return null;
    queueRemoteDeckSave(latest);
    const saved = await flushRemoteDeckSave(deckId, latest.versionId);
    if (!saved) return null;
    const current =
      queryClient.getQueryData<DeckState | null>(deckQueryKeys.detail(deckId)) ?? null;
    if (
      current?.versionId &&
      saved.versionId &&
      current.versionId !== saved.versionId
    ) {
      return saved;
    }
    setDeckDetailCache(queryClient, saved);
    return saved;
  }, [deckId, queryClient, shared]);

  return {
    deck: deckWithLegality ?? query.data ?? null,
    error: query.error,
    isLoading: query.isLoading,
    isRefreshingLegality,
    persist,
    flushSave,
    refetch: query.refetch,
  };
}
