import { useMemo } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import type { DeckSectionKey, DeckState } from '@/lib/deck-types';
import {
  buildDeckAddCandidates,
  DECK_ADD_CATALOG_STALE_MS,
  deckAddInfiniteQueryKey,
  defaultDeckAddSearch,
  describeDeckAddEmptyState,
  fetchDeckAddListPage,
  filterDeckAddDisplayCards,
  getDeckAddSectionMeta,
  legendNeedsHydration,
  mergeHydratedLegend,
  pickDeckAddDisplayListItems,
  searchLocalDeckAddCatalog,
  type DeckAddCatalogStatus,
} from '@/lib/deck-add-catalog';
import {
  catalogFiltersActive,
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import { useCollection } from '@/hooks/useCollection';
import { ownershipMapFromCollection } from '@/utils/collectionOwnership';
import { api } from '@/src/api/client';

export function useDeckAddCatalog(
  deck: DeckState,
  section: DeckSectionKey,
  userQuery: string,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS,
  options?: { enabled?: boolean }
) {
  const hookEnabled = options?.enabled !== false;
  const catalogIndex = useCatalogIndex();
  const catalogItems = getCatalogIndexItems(catalogIndex.data);
  const sectionMeta = useMemo(
    () => getDeckAddSectionMeta(section, deck),
    [section, deck]
  );

  const legendHydrationQuery = useQuery({
    queryKey: ['deck-add-legend-hydrate', deck.legend?.variantNumber],
    queryFn: async () => {
      const response = await api.getCard(deck.legend!.variantNumber);
      return response.data;
    },
    enabled:
      hookEnabled &&
      section === 'champion' &&
      deck.format !== 'pre-rift' &&
      legendNeedsHydration(deck.legend),
    staleTime: DECK_ADD_CATALOG_STALE_MS,
    gcTime: DECK_ADD_CATALOG_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const resolvedDeck = useMemo(() => {
    if (!legendHydrationQuery.data) return deck;
    return mergeHydratedLegend(deck, legendHydrationQuery.data);
  }, [deck, legendHydrationQuery.data]);

  const catalogEnabled =
    hookEnabled && (!sectionMeta.requiresLegend || Boolean(resolvedDeck.legend));

  const ownedFilterActive = filters.collection === 'owned';
  const { data: collectionEntries = [] } = useCollection({
    enabled: ownedFilterActive,
  });

  const collectionByVariant = useMemo(() => {
    if (!ownedFilterActive) return new Map<string, { quantity: number }>();
    return ownershipMapFromCollection(collectionEntries);
  }, [ownedFilterActive, collectionEntries]);

  const listQuery = useInfiniteQuery({
    queryKey: deckAddInfiniteQueryKey(section, resolvedDeck, userQuery, filters),
    queryFn: ({ pageParam }) =>
      fetchDeckAddListPage(section, resolvedDeck, userQuery, filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination;
      return pagination.hasNext ? pagination.page + 1 : undefined;
    },
    enabled: catalogEnabled,
    staleTime: DECK_ADD_CATALOG_STALE_MS,
    gcTime: DECK_ADD_CATALOG_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const listItems = useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [listQuery.data]
  );

  const localListItems = useMemo(() => {
    if (!catalogEnabled || catalogItems.length === 0) return [];
    return searchLocalDeckAddCatalog(catalogItems, section, resolvedDeck, userQuery);
  }, [catalogEnabled, catalogItems, section, resolvedDeck, userQuery]);

  const displayListItems = pickDeckAddDisplayListItems(listItems, localListItems);

  const filteredListItems = useMemo(() => {
    if (!catalogFiltersActive(filters)) return displayListItems;
    return displayListItems.filter((item) =>
      matchesCatalogFilters(item, filters, collectionByVariant, { colorMode: 'within' })
    );
  }, [displayListItems, filters, collectionByVariant]);

  const candidateCards = useMemo(
    () =>
      buildDeckAddCandidates({
        section,
        listItems: filteredListItems,
        details: [],
        deck: resolvedDeck,
      }),
    [section, filteredListItems, resolvedDeck]
  );

  const displayCards = useMemo(
    () => filterDeckAddDisplayCards(resolvedDeck, section, candidateCards),
    [resolvedDeck, section, candidateCards]
  );

  const hasNextPage = listQuery.hasNextPage ?? false;
  const isFetchingNextPage = listQuery.isFetchingNextPage;
  const isInitialListLoading =
    catalogEnabled &&
    listQuery.isPending &&
    listItems.length === 0 &&
    localListItems.length === 0;

  const isLoading =
    (section === 'champion' &&
      legendNeedsHydration(deck.legend) &&
      legendHydrationQuery.isPending) ||
    isInitialListLoading;

  const isError = legendHydrationQuery.isError || listQuery.isError;

  const status: DeckAddCatalogStatus = useMemo(() => {
    if (!catalogEnabled) return 'needs-legend';
    if (isError) return 'error';
    if (isLoading) return 'loading';
    if (displayListItems.length === 0) return 'no-catalog-results';
    if (displayCards.length === 0) return 'no-eligible-results';
    return 'ready';
  }, [
    catalogEnabled,
    isError,
    isLoading,
    displayListItems.length,
    displayCards.length,
  ]);

  const emptyState = useMemo(
    () =>
      describeDeckAddEmptyState({
        section,
        deck: resolvedDeck,
        status: status === 'loading' ? 'no-catalog-results' : status,
        catalogTotal: displayListItems.length,
        candidateCount: candidateCards.length,
        userQuery,
      }),
    [
      section,
      resolvedDeck,
      status,
      displayListItems.length,
      candidateCards.length,
      userQuery,
    ]
  );

  const fetchNextPageSafe = () => {
    if (!hasNextPage || isFetchingNextPage) return;
    void listQuery.fetchNextPage();
  };

  return {
    cards: displayCards,
    resolvedDeck,
    sectionMeta,
    defaultSearch: defaultDeckAddSearch(section, resolvedDeck),
    status,
    isLoading,
    isError,
    emptyState,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: fetchNextPageSafe,
    refetch: () => {
      void legendHydrationQuery.refetch();
      void listQuery.refetch();
    },
  };
}
