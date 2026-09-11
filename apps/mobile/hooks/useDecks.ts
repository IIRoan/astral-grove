import type { DeckFormat } from '@riftbound/contracts';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from '@/components/ui/toast.api';
import type { DeckBrowseFilters, DeckBrowseSort } from '@/constants/deckBrowse';
import {
  DEFAULT_DECK_BROWSE_FILTERS,
  DEFAULT_DECK_BROWSE_SORT,
  deckBrowseFiltersToQuery,
} from '@/constants/deckBrowse';
import { filterDecksByQuery } from '@/lib/deck-list';
import type { DeckState } from '@/lib/deck-types';
import { setDeckDetailCache } from '@/lib/deck-state';
import { persistOwnedDecks } from '@/services/deckCacheService';
import {
  fetchOwnedDecks,
  hydrateOwnedDecksCache,
  prefetchOwnedDecks,
} from '@/services/ownedDecksCache';
import {
  createDeck,
  deleteDeck,
  duplicateDeck,
  importDeckToAccount,
  listDecksPage,
  saveDeckToAccount,
  scheduleRemoteDeckSave,
} from '@/services/deckService';
import { isRemoteDeckReadOnlyError } from '@/services/remoteDeckService';

import { deckQueryKeys } from '@/src/api/queryKeys';

export { hydrateOwnedDecksCache, prefetchOwnedDecks };

const DECK_LIST_STALE_MS = 60_000;

function deckBrowseQueryOptions(options: {
  q?: string;
  sort: DeckBrowseSort;
  filters: DeckBrowseFilters;
}) {
  const filterQuery = deckBrowseFiltersToQuery(options.filters);
  return {
    queryKey: deckQueryKeys.browse(options),
    initialPageParam: 1 as const,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      listDecksPage({
        source: 'imported',
        preview: true,
        q: options.q,
        page: pageParam,
        limit: 25,
        sort: options.sort.sort,
        dir: options.sort.dir,
        ...filterQuery,
      }),
    getNextPageParam: (lastPage: Awaited<ReturnType<typeof listDecksPage>>) =>
      lastPage.pagination?.hasNext ? lastPage.pagination.page + 1 : undefined,
    staleTime: DECK_LIST_STALE_MS,
  };
}

/** First page of community browse (default sort/filters) for the Decks tab. */
export function prefetchDefaultDeckBrowse(queryClient: QueryClient): Promise<void> {
  return queryClient
    .prefetchInfiniteQuery(
      deckBrowseQueryOptions({
        sort: DEFAULT_DECK_BROWSE_SORT,
        filters: DEFAULT_DECK_BROWSE_FILTERS,
      })
    )
    .then(() => undefined);
}

/** Owned decks: one cached list, client-filtered so search never misses the bootstrap cache. */
export function useOwnedDecks(query?: string) {
  const queryClient = useQueryClient();

  const ownedQuery = useQuery({
    queryKey: deckQueryKeys.list('owned'),
    queryFn: () => fetchOwnedDecks(queryClient),
    staleTime: DECK_LIST_STALE_MS,
    // Cross-device deletes must not linger behind a fresh disk hydrate.
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    placeholderData: (previous) => previous,
  });

  const data = useMemo(
    () => filterDecksByQuery(ownedQuery.data ?? [], query ?? ''),
    [ownedQuery.data, query]
  );

  return {
    ...ownedQuery,
    data,
  };
}

export function useImportedDecksBrowse(options: {
  q?: string;
  sort: DeckBrowseSort;
  filters: DeckBrowseFilters;
}) {
  return useInfiniteQuery({
    ...deckBrowseQueryOptions(options),
    placeholderData: (previousData) => previousData,
  });
}

export function useDeckMutations() {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: deckQueryKeys.all });
  }, [queryClient]);

  const saveDeck = useMutation({
    mutationFn: async (deck: DeckState) => {
      setDeckDetailCache(queryClient, deck);
      scheduleRemoteDeckSave(deck);
      return deck;
    },
    meta: { action: 'decks.save' },
    onSuccess: invalidate,
  });

  const saveDeckNow = useMutation({
    mutationFn: (deck: DeckState) => saveDeckToAccount(deck),
    meta: { action: 'decks.save_now' },
    onSuccess: (saved) => {
      setDeckDetailCache(queryClient, saved);
      invalidate();
    },
  });

  const removeDeck = useMutation({
    mutationFn: (id: string) => deleteDeck(id),
    meta: { action: 'decks.remove' },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: deckQueryKeys.all });
      const previousLists = queryClient.getQueriesData<DeckState[]>({
        queryKey: ['decks', 'list'],
      });
      queryClient.setQueriesData<DeckState[]>(
        { queryKey: ['decks', 'list'] },
        (current) => current?.filter((deck) => deck.id !== id)
      );
      queryClient.removeQueries({ queryKey: deckQueryKeys.detail(id) });
      const owned = queryClient.getQueryData<DeckState[]>(deckQueryKeys.list('owned'));
      if (owned) void persistOwnedDecks(owned);
      return { previousLists };
    },
    onError: (error, _id, context) => {
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data);
        }
        const owned = queryClient.getQueryData<DeckState[]>(
          deckQueryKeys.list('owned')
        );
        if (owned) void persistOwnedDecks(owned);
      }
      if (isRemoteDeckReadOnlyError(error)) {
        toast.error('Imported Piltover Archive decks cannot be deleted.');
        return;
      }
      toast.error('Could not delete deck.');
    },
    onSettled: invalidate,
  });

  const importDeck = useMutation({
    mutationFn: ({
      sourceDeckId,
      format,
    }: {
      sourceDeckId: string;
      format: DeckFormat;
    }) => importDeckToAccount(sourceDeckId, format),
    meta: { action: 'decks.import' },
    onSuccess: (saved) => {
      setDeckDetailCache(queryClient, saved);
      invalidate();
      toast.success('Deck imported to your collection.');
    },
    onError: () => {
      toast.error('Could not import deck.');
    },
  });

  const duplicateOwnedDeck = useMutation({
    mutationFn: (deck: DeckState) => duplicateDeck(deck),
    meta: { action: 'decks.duplicate' },
    onSuccess: (saved) => {
      setDeckDetailCache(queryClient, saved);
      invalidate();
      toast.success('Deck duplicated.');
    },
    onError: () => {
      toast.error('Could not duplicate deck.');
    },
  });

  const createNewDeck = useMutation({
    mutationFn: (input?: {
      name?: string;
      description?: string;
      format?: DeckFormat;
    }) => createDeck(input?.name, input?.description, input?.format ?? 'constructed'),
    meta: { action: 'decks.create' },
    onSuccess: invalidate,
  });

  return {
    saveDeck,
    saveDeckNow,
    removeDeck,
    importDeck,
    duplicateOwnedDeck,
    createNewDeck,
  };
}
