import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import {
  MIN_SEARCH_LENGTH,
  cacheSearchResults,
  getCachedSearchResults,
  type SearchResultsCacheScope,
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
  localCardSearchMeta,
  paginateLocalCardSearch,
  pickCardSearchRawItems,
} from '@/lib/card-search-display';
import {
  normalizeCardListItems,
  normalizeCardsListResponse,
  groupCardListItems,
} from '@/utils/variants';
import { searchCatalogItems } from '@/utils/catalogSearch';
import {
  catalogFiltersToQuery,
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  type CatalogFilters,
} from '@/constants/catalogFilters';

import type { CardsListQuery, CardsListResponse } from '@riftbound/contracts';
import { DEFAULT_CATALOG_SORT, type CatalogSort } from '@/constants/catalogSort';

const DEBOUNCE_MS = 150;
const STALE_MS = 5 * 60 * 1000;

export function useCardSearch(
  query: string,
  sort: CatalogSort = DEFAULT_CATALOG_SORT,
  pageSize = 40,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS
) {
  const trimmed = query.trim();
  const debouncedApiTerm = useDebounce(trimmed, DEBOUNCE_MS);
  const [immediateTerm, setImmediateTerm] = useState<string | null>(null);
  const activeApiTerm = immediateTerm ?? debouncedApiTerm;
  const hasQuery = trimmed.length >= MIN_SEARCH_LENGTH;
  const apiMatchesInput = trimmed === activeApiTerm;
  const queryClient = useQueryClient();
  const catalogIndex = useCatalogIndex();
  const catalogItems = getCatalogIndexItems(catalogIndex.data);
  const indexReady = catalogItems.length > 0;
  const [localPage, setLocalPage] = useState(1);
  const [instantCache, setInstantCache] = useState<{
    term: string;
    response: CardsListResponse;
  } | null>(null);

  if (immediateTerm && debouncedApiTerm === immediateTerm) {
    setImmediateTerm(null);
  }

  const apiEnabled = activeApiTerm.length >= MIN_SEARCH_LENGTH;
  const instantCacheForTerm =
    instantCache?.term === activeApiTerm ? instantCache.response : null;

  const cacheScope = useMemo<SearchResultsCacheScope>(
    () => ({
      sort,
      filters,
      limit: CATALOG_NETWORK_PAGE_SIZE,
    }),
    [sort, filters]
  );

  useEffect(() => {
    setLocalPage(1);
  }, [trimmed, sort.sortBy, sort.dir, filters]);

  useEffect(() => {
    if (!apiEnabled) {
      setInstantCache(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const cached = await getCachedSearchResults(activeApiTerm, cacheScope);
      if (!cancelled) {
        setInstantCache(cached ? { term: activeApiTerm, response: cached } : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeApiTerm, apiEnabled, cacheScope]);

  const localSearchPool = useMemo(() => {
    if (!hasQuery || !indexReady) return [];
    const filtered = catalogItems.filter((card) =>
      matchesCatalogFilters(card, filters, new Map(), { colorMode: 'within' })
    );
    return searchCatalogItems(filtered, trimmed, sort);
  }, [hasQuery, indexReady, catalogItems, filters, trimmed, sort]);

  const localPageResult = useMemo(
    () => paginateLocalCardSearch(localSearchPool, localPage, pageSize),
    [localSearchPool, localPage, pageSize]
  );
  const localLoadedItems = localPageResult.loadedItems;

  const result = useInfiniteQuery({
    queryKey: cardQueryKeys.searchInfinite(
      activeApiTerm,
      sort.sortBy,
      sort.dir,
      filters
    ),
    queryFn: async ({ pageParam }) => {
      const params: Partial<CardsListQuery> = {
        q: activeApiTerm,
        limit: CATALOG_NETWORK_PAGE_SIZE,
        page: pageParam,
        sortBy: sort.sortBy,
        dir: sort.dir,
        ...catalogFiltersToQuery(filters),
      };
      const response = await api.listCards(params);
      const normalized = normalizeCardsListResponse(response);
      if (pageParam === 1) {
        await cacheSearchResults(activeApiTerm, cacheScope, normalized);
      }
      return normalized;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta.pagination;
      return pagination.hasNext ? pagination.page + 1 : undefined;
    },
    enabled: apiEnabled,
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

  const hasApiResults = apiEnabled && apiMatchesInput && apiItems.length > 0;

  const isLocalSearch = hasQuery && !hasApiResults && localLoadedItems.length > 0;

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
    const cards = hasApiResults
      ? apiItems
      : isLocalSearch
        ? localLoadedItems
        : (instantCacheForTerm?.data ?? []);
    if (!cards.length) return;
    for (const card of cards.slice(0, 12)) {
      prefetchCardDetail(queryClient, card);
    }
  }, [
    hasApiResults,
    apiItems,
    isLocalSearch,
    localLoadedItems,
    instantCacheForTerm,
    queryClient,
  ]);

  const searchNow = useCallback(
    (override?: string) => {
      const term = (override ?? trimmed).trim();
      if (term.length >= MIN_SEARCH_LENGTH) {
        setImmediateTerm(term);
      }
    },
    [trimmed]
  );

  const rawItems = useMemo(
    () =>
      pickCardSearchRawItems({
        hasApiItems: hasApiResults,
        apiItems,
        inputMatchesActive: apiMatchesInput,
        instantCacheItems: instantCacheForTerm?.data ?? [],
        localItems: localLoadedItems,
        isFetching: result.isFetching,
      }),
    [
      hasApiResults,
      apiItems,
      apiMatchesInput,
      instantCacheForTerm,
      localLoadedItems,
      result.isFetching,
    ]
  );

  const items = useMemo(
    () => groupCardListItems(normalizeCardListItems(rawItems)),
    [rawItems]
  );

  const hasInstantResults =
    instantCacheForTerm !== null || (isLocalSearch && items.length > 0);
  const lastPage = result.data?.pages.at(-1);
  const firstPage = result.data?.pages[0];

  const localMeta = useMemo(
    () => localCardSearchMeta(localSearchPool.length, localPage, pageSize),
    [localSearchPool.length, localPage, pageSize]
  );

  return {
    debouncedQuery: activeApiTerm,
    minLength: MIN_SEARCH_LENGTH,
    debounceMs: DEBOUNCE_MS,
    items,
    meta: hasApiResults
      ? (lastPage?.meta ?? firstPage?.meta ?? instantCacheForTerm?.meta)
      : isLocalSearch
        ? localMeta
        : (instantCacheForTerm?.meta ?? lastPage?.meta ?? firstPage?.meta),
    isLoading:
      hasQuery &&
      !hasInstantResults &&
      !hasApiResults &&
      localLoadedItems.length === 0 &&
      (result.isPending || result.isFetching),
    isFetching:
      hasQuery &&
      result.isFetching &&
      !hasApiResults &&
      !hasInstantResults &&
      localLoadedItems.length === 0,
    isFetchingNextPage: hasApiResults ? result.isFetchingNextPage : false,
    hasNextPage: hasApiResults
      ? (result.hasNextPage ?? false)
      : localPageResult.hasNextPage,
    fetchNextPage: () => {
      if (hasApiResults) {
        if (result.hasNextPage && !result.isFetchingNextPage) {
          void result.fetchNextPage();
        }
        return;
      }
      if (localPageResult.hasNextPage) {
        setLocalPage((page) => page + 1);
      }
    },
    isError: result.isError && !hasInstantResults,
    error: result.error,
    refetch: result.refetch,
    searchNow,
    isLocalSearch,
    isReconciling:
      hasQuery && result.isFetching && (hasInstantResults || items.length > 0),
  };
}
