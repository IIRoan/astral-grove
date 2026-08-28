import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import {
  MIN_SEARCH_LENGTH,
  cacheSearchResults,
  getCachedSearchResults,
} from '@/services/searchCacheService';
import {
  getInMemoryCatalogIndex,
  mergeCatalogIndexItems,
} from '@/services/catalogIndexService';
import { api } from '@/src/api/client';
import { cardQueryKeys, catalogQueryKeys } from '@/src/api/queryKeys';
import { prefetchCardDetail } from '@/lib/prefetchCardDetail';
import { CATALOG_NETWORK_PAGE_SIZE } from '@/lib/catalog-page-size';
import {
  normalizeCardListItems,
  normalizeCardsListResponse,
  groupCardListItems,
} from '@/utils/variants';
import {
  catalogFiltersToQuery,
  DEFAULT_CATALOG_FILTERS,
  type CatalogFilters,
} from '@/constants/catalogFilters';

import type { CardsListQuery, CardsListResponse } from '@riftbound/contracts';
import { DEFAULT_CATALOG_SORT, type CatalogSort } from '@/constants/catalogSort';

const DEBOUNCE_MS = 150;
const STALE_MS = 5 * 60 * 1000;

export function useCardSearch(
  query: string,
  sort: CatalogSort = DEFAULT_CATALOG_SORT,
  _pageSize = 40,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS
) {
  const trimmed = query.trim();
  const debounced = useDebounce(trimmed, DEBOUNCE_MS);
  const [immediateTerm, setImmediateTerm] = useState<string | null>(null);
  const activeTerm = immediateTerm ?? debounced;
  const queryClient = useQueryClient();
  const [instantCache, setInstantCache] = useState<{
    term: string;
    response: CardsListResponse;
  } | null>(null);

  if (immediateTerm && debounced === immediateTerm) {
    setImmediateTerm(null);
  }

  const enabled = activeTerm.length >= MIN_SEARCH_LENGTH;
  const inputMatchesActive = trimmed === activeTerm;
  const instantCacheForTerm =
    instantCache?.term === activeTerm ? instantCache.response : null;

  useEffect(() => {
    if (!enabled) {
      setInstantCache(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const cached = await getCachedSearchResults(activeTerm);
      if (!cancelled) {
        setInstantCache(cached ? { term: activeTerm, response: cached } : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTerm, enabled]);

  const result = useInfiniteQuery({
    queryKey: cardQueryKeys.searchInfinite(activeTerm, sort.sortBy, sort.dir, filters),
    queryFn: async ({ pageParam }) => {
      const params: Partial<CardsListQuery> = {
        q: activeTerm,
        limit: CATALOG_NETWORK_PAGE_SIZE,
        page: pageParam,
        sortBy: sort.sortBy,
        dir: sort.dir,
        ...catalogFiltersToQuery(filters),
      };
      const response = await api.listCards(params);
      const normalized = normalizeCardsListResponse(response);
      if (pageParam === 1) {
        await cacheSearchResults(activeTerm, normalized);
      }
      return normalized;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination;
      return pagination.hasNext ? pagination.page + 1 : undefined;
    },
    enabled,
    staleTime: STALE_MS,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    placeholderData: () => {
      if (!instantCacheForTerm) return undefined;
      return {
        pages: [instantCacheForTerm],
        pageParams: [1],
      };
    },
    retry: 1,
  });

  const apiItems = useMemo(
    () => result.data?.pages.flatMap((page) => page.data) ?? [],
    [result.data]
  );

  const hasApiResults =
    enabled &&
    inputMatchesActive &&
    (apiItems.length > 0 || (result.isFetched && !result.isError));

  useEffect(() => {
    if (!hasApiResults || apiItems.length === 0) return;

    let cancelled = false;
    void (async () => {
      const changed = await mergeCatalogIndexItems(apiItems);
      if (cancelled || changed === 0) return;
      const merged = getInMemoryCatalogIndex();
      if (!merged) return;
      queryClient.setQueryData(catalogQueryKeys.index, merged);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasApiResults, apiItems, queryClient]);

  useEffect(() => {
    const cards = hasApiResults ? apiItems : (instantCacheForTerm?.data ?? []);
    if (!cards.length) return;
    for (const card of cards.slice(0, 12)) {
      prefetchCardDetail(queryClient, card);
    }
  }, [hasApiResults, apiItems, instantCacheForTerm, queryClient]);

  const searchNow = useCallback(
    (override?: string) => {
      const term = (override ?? trimmed).trim();
      if (term.length >= MIN_SEARCH_LENGTH) {
        setImmediateTerm(term);
      }
    },
    [trimmed]
  );

  const rawItems = useMemo(() => {
    if (hasApiResults) return apiItems;
    if (!inputMatchesActive) {
      return instantCacheForTerm?.data ?? apiItems;
    }
    if (result.isFetching && !instantCacheForTerm) return [];
    return instantCacheForTerm?.data ?? apiItems;
  }, [
    inputMatchesActive,
    hasApiResults,
    apiItems,
    result.isFetching,
    instantCacheForTerm,
  ]);

  const items = useMemo(
    () => groupCardListItems(normalizeCardListItems(rawItems)),
    [rawItems]
  );

  const hasInstantResults = instantCacheForTerm !== null;
  const lastPage = result.data?.pages.at(-1);
  const firstPage = result.data?.pages[0];

  return {
    debouncedQuery: activeTerm,
    minLength: MIN_SEARCH_LENGTH,
    debounceMs: DEBOUNCE_MS,
    items,
    meta: hasApiResults
      ? (lastPage?.meta ?? firstPage?.meta ?? instantCacheForTerm?.meta)
      : (instantCacheForTerm?.meta ?? lastPage?.meta ?? firstPage?.meta),
    isLoading:
      enabled &&
      !hasInstantResults &&
      !hasApiResults &&
      (result.isPending || result.isFetching),
    isFetching: enabled && result.isFetching && !hasApiResults && !hasInstantResults,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: result.hasNextPage ?? false,
    fetchNextPage: () => {
      if (result.hasNextPage && !result.isFetchingNextPage) {
        void result.fetchNextPage();
      }
    },
    isError: result.isError && !hasInstantResults,
    error: result.error,
    refetch: result.refetch,
    searchNow,
    isLocalSearch: false,
    isReconciling:
      enabled && result.isFetching && (hasInstantResults || items.length > 0),
  };
}
