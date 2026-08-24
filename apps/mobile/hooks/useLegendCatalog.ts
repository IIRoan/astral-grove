import { useDebounce } from '@/hooks/useDebounce';
import {
  buildPlayLegendRows,
  groupLegendListItems,
  PLAY_LEGEND_DETAIL_DEFER_MS,
  PLAY_LEGEND_PAGE_SIZE,
  PLAY_LEGEND_SEARCH_DEBOUNCE_MS,
  PLAY_LEGEND_STALE_MS,
  playLegendDetailsQueryKey,
  playLegendListQueryKey,
  resolveDisplayedLegends,
  shouldShowLegendCatalogLoading,
} from '@/lib/legend-catalog';
import { api } from '@/src/api/client';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

const legendListQueryOptions = (search: string) => ({
  queryKey: playLegendListQueryKey(search),
  initialPageParam: 1 as const,
  queryFn: ({ pageParam }: { pageParam: number }) =>
    api.listCards({
      q: search || undefined,
      types: 'Legend',
      limit: PLAY_LEGEND_PAGE_SIZE,
      page: pageParam,
      sortBy: 'name',
      dir: 'asc',
    }),
  getNextPageParam: (last: Awaited<ReturnType<typeof api.listCards>>) =>
    last.meta.pagination.hasNext ? last.meta.pagination.page + 1 : undefined,
  staleTime: PLAY_LEGEND_STALE_MS,
  gcTime: PLAY_LEGEND_STALE_MS,
});

/** Warm the default legend page so the picker opens from cache. */
export function prefetchPlayLegendCatalog(queryClient: QueryClient): Promise<void> {
  return queryClient
    .prefetchInfiniteQuery(legendListQueryOptions(''))
    .then(() => undefined);
}

/** Legend catalog search: browse grouping, list art first, deferred hydrate, previous-result placeholders. */
export function useLegendCatalog() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), PLAY_LEGEND_SEARCH_DEBOUNCE_MS);
  const [detailsReady, setDetailsReady] = useState(false);
  const previousLegendsRef = useRef<ReturnType<typeof buildPlayLegendRows>>([]);

  useEffect(() => {
    void prefetchPlayLegendCatalog(queryClient);
  }, [queryClient]);

  useEffect(() => {
    setDetailsReady(false);
    const id = setTimeout(() => setDetailsReady(true), PLAY_LEGEND_DETAIL_DEFER_MS);
    return () => clearTimeout(id);
  }, [debounced]);

  const listQuery = useInfiniteQuery({
    ...legendListQueryOptions(debounced),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
    retry: 1,
  });

  const listItems = useMemo(() => {
    const raw = listQuery.data?.pages.flatMap((page) => page.data) ?? [];
    return groupLegendListItems(raw);
  }, [listQuery.data?.pages]);

  const variantNumbers = useMemo(
    () => listItems.map((item) => item.variantNumber),
    [listItems]
  );

  const detailsQuery = useQuery({
    queryKey: playLegendDetailsQueryKey(variantNumbers),
    queryFn: () => api.batchCards(variantNumbers),
    enabled: detailsReady && variantNumbers.length > 0,
    staleTime: PLAY_LEGEND_STALE_MS,
    gcTime: PLAY_LEGEND_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
    retry: 1,
  });

  const legends = useMemo(
    () => buildPlayLegendRows(listItems, detailsQuery.data?.data),
    [detailsQuery.data?.data, listItems]
  );

  const displayedLegends = resolveDisplayedLegends(
    legends,
    previousLegendsRef.current,
    listQuery.isFetching
  );

  useEffect(() => {
    if (legends.length > 0) {
      previousLegendsRef.current = legends;
      return;
    }
    if (!listQuery.isFetching) {
      previousLegendsRef.current = [];
    }
  }, [legends, listQuery.isFetching]);

  const loading = shouldShowLegendCatalogLoading(
    listQuery.isLoading,
    displayedLegends.length
  );
  const loadingMore = listQuery.isFetchingNextPage;

  return {
    query,
    setQuery,
    /** Debounced search string — use as a transition key when results settle. */
    searchKey: debounced,
    legends: displayedLegends as typeof legends,
    loading,
    loadingMore,
    isFetching: listQuery.isFetching || detailsQuery.isFetching,
    hasNextPage: Boolean(listQuery.hasNextPage),
    fetchNextPage: () => {
      if (listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
        void listQuery.fetchNextPage();
      }
    },
  };
}
