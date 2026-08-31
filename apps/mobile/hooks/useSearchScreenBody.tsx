import { useFocusEffect } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import {
  InteractionManager,
  Keyboard,
  Platform,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { type FlashListRef, type ViewToken } from '@shopify/flash-list';
import type { CardListItem } from '@riftbound/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { CardDetailDrawer } from '@/components/catalog/CardDetailDrawer';
import { CatalogDetailPanel } from '@/components/catalog/CatalogDetailPanel';
import { CatalogDetailPanelSkeleton } from '@/components/catalog/CatalogDetailPanelSkeleton';
import { CatalogFilterSheet } from '@/components/catalog/FilterSheet';
import { SortSheet } from '@/components/catalog/SortSheet';
import { SearchCatalogList } from '@/components/search/SearchCatalogList';
import { SearchScreenListEmpty } from '@/components/search/SearchScreenListEmpty';
import { SearchScreenToolbar } from '@/components/search/SearchScreenToolbar';
import {
  DEFAULT_CATALOG_SORT,
  normalizeCatalogSort,
  sortOptionKey,
  type CatalogSort,
} from '@/constants/catalogSort';
import {
  catalogFiltersActive,
  catalogFiltersQueryKey,
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  sanitizeCatalogFilters,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import {
  ScreenLayoutBody,
  ScreenSplit,
  useScreenLayout,
} from '@/components/shell/ScreenLayout';
import { useTheme } from '@/context/ThemeContext';
import { useCardSearch } from '@/hooks/useCardSearch';
import { useCatalogBrowseInfinite } from '@/hooks/useCatalogBrowseInfinite';
import { useLatestRef } from '@/hooks/useLatestRef';
import { prefetchCatalogFilters } from '@/hooks/useFiltersData';
import { useCollectionOwnership, useCollection } from '@/hooks/useCollection';
import {
  collectVariantNumbers,
  ownershipMapFromCollection,
  preferCollectionOwnership,
} from '@/utils/collectionOwnership';
import { cardListItemMatchesVariant } from '@/utils/variants';
import {
  CATALOG_DETAIL_GAP,
  DETAIL_PANEL_WIDTH,
  SIDE_RAIL_WIDTH,
  useCatalogSplitLayout,
  useMobileLayout,
} from '@/hooks/useBreakpoint';
import { useStableResponsiveColumns } from '@/hooks/useResponsiveColumns';
import { prefetchCardDetail, ensureCardDetail } from '@/lib/prefetchCardDetail';
import {
  CATALOG_END_REACHED_THRESHOLD,
  catalogDrawDistance,
  catalogLookaheadCount,
  catalogViewportTargetHeight,
  estimateCatalogPageSize,
  estimateCatalogRowHeight,
  isFastCatalogScroll,
  measureCatalogScrollVelocity,
  shouldPrefetchCatalog,
  type CatalogScrollMetrics,
} from '@/lib/catalog-page-size';
import { prefetchCatalogArt } from '@/lib/imagePrefetch';
import {
  isCatalogGridLoading,
  resolveCatalogDisplayItems,
} from '@/lib/catalog-loading';
import {
  beginCatalogDrawerDismiss,
  createCatalogDrawerPresentation,
  finishCatalogDrawerDismiss,
  type CatalogDrawerPresentation,
} from '@/lib/bottom-sheet-lifecycle';
import { logDrawer, snapshotPresentation, watchDrawerOpen } from '@/lib/drawer-debug';

export function useSearchScreenBody(): React.ReactElement {
  const { defaultLayout: view } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const {
    contentWidth: layoutContentWidth,
    measuredWidth: layoutMeasuredWidth,
    paddingBottomInline,
    showRail,
  } = useScreenLayout();
  const [splitMainWidth, setSplitMainWidth] = useState<number | null>(null);
  const splitLayout = useCatalogSplitLayout();
  const isMobile = useMobileLayout();
  const [query, setQuery] = useState('');
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(
    DEFAULT_CATALOG_FILTERS
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const applyCatalogFilters = useCallback((next: CatalogFilters) => {
    setCatalogFilters(sanitizeCatalogFilters(next));
  }, []);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [catalogSort, setCatalogSort] = useState<CatalogSort>(DEFAULT_CATALOG_SORT);
  const [sortPending, setSortPending] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [drawerPresentation, setDrawerPresentation] =
    useState<CatalogDrawerPresentation | null>(null);
  const nextDrawerSessionIdRef = useRef(0);
  const drawerPresentationRef = useLatestRef(drawerPresentation);
  const queryClient = useQueryClient();
  const catalogListRef = useRef<FlashListRef<CardListItem>>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;
  const lastArtWarmIndexRef = useRef(-1);

  const catalogColumnWidth = splitLayout
    ? (splitMainWidth ??
      Math.max(280, layoutContentWidth - DETAIL_PANEL_WIDTH - CATALOG_DETAIL_GAP))
    : layoutContentWidth;

  const gridMeasurementReady =
    layoutMeasuredWidth != null &&
    layoutMeasuredWidth > 0 &&
    (!splitLayout || splitMainWidth != null);

  const catalogReservedWidth = useMemo(() => {
    let reserved = 0;
    if (showRail) reserved += SIDE_RAIL_WIDTH;
    if (splitLayout) {
      reserved += 48;
      if (selectedVariant) {
        reserved += DETAIL_PANEL_WIDTH + CATALOG_DETAIL_GAP;
      }
    }
    return reserved;
  }, [showRail, splitLayout, selectedVariant]);

  const { numColumns, contentWidth, tileWidth, compact } = useStableResponsiveColumns(
    view,
    {
      reservedWidth: splitLayout
        ? catalogReservedWidth
        : showRail
          ? SIDE_RAIL_WIDTH
          : 0,
      measuredWidth: splitLayout ? catalogColumnWidth : layoutContentWidth,
      fillAvailable: view === 'grid',
      measurementReady: gridMeasurementReady,
    }
  );

  const catalogViewportHeight = useMemo(
    () => Math.max(320, windowHeight - 220),
    [windowHeight]
  );

  const pageSize = useMemo(
    () =>
      estimateCatalogPageSize(
        numColumns,
        view,
        catalogViewportHeight,
        tileWidth,
        compact
      ),
    [numColumns, view, catalogViewportHeight, tileWidth, compact]
  );

  const {
    debouncedQuery,
    items,
    isLoading,
    isFetching,
    isError,
    minLength,
    searchNow,
    hasNextPage: searchHasNextPage,
    isFetchingNextPage: searchIsFetchingNextPage,
    fetchNextPage: fetchNextSearchPage,
  } = useCardSearch(query, catalogSort, pageSize, catalogFilters);

  const trimmedQuery = query.trim();
  const hasSearchInput = trimmedQuery.length >= minLength;
  const searchPending = hasSearchInput && trimmedQuery !== debouncedQuery;
  const ownershipVariantSetRef = useRef(new Set<string>());
  const ownershipFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ownershipRevision, setOwnershipRevision] = useState(0);

  const queueOwnershipFetch = useCallback(() => {
    if (ownershipFlushTimerRef.current) return;
    ownershipFlushTimerRef.current = setTimeout(() => {
      ownershipFlushTimerRef.current = null;
      setOwnershipRevision((revision) => revision + 1);
    }, 400);
  }, []);

  useEffect(
    () => () => {
      if (ownershipFlushTimerRef.current) {
        clearTimeout(ownershipFlushTimerRef.current);
      }
    },
    []
  );

  const ownedFilterActive = catalogFilters.collection === 'owned';
  // Warm full collection so list tiles show owned counts without a quantities round-trip.
  const { data: collectionEntries = [] } = useCollection();

  const ownershipVariants = useMemo(() => {
    void ownershipRevision;
    const variants = [...ownershipVariantSetRef.current];
    if (selectedVariant && !variants.includes(selectedVariant)) {
      variants.push(selectedVariant);
    }
    return variants.sort();
  }, [ownershipRevision, selectedVariant]);

  const { collectionByVariant: fetchedOwnership } =
    useCollectionOwnership(ownershipVariants);

  const collectionByVariant = useMemo(() => {
    const fromCollection = ownershipMapFromCollection(collectionEntries);
    return preferCollectionOwnership(fetchedOwnership, fromCollection);
  }, [collectionEntries, fetchedOwnership]);

  const filterOwnership = useMemo(() => {
    if (!ownedFilterActive) return collectionByVariant;
    const ownedMap = new Map(ownershipMapFromCollection(collectionEntries));
    for (const [variantNumber, entry] of collectionByVariant) {
      const current = ownedMap.get(variantNumber)?.quantity ?? 0;
      if (entry.quantity > current) {
        ownedMap.set(variantNumber, entry);
      }
    }
    return ownedMap;
  }, [ownedFilterActive, collectionEntries, collectionByVariant]);

  const browseCatalog = useCatalogBrowseInfinite(
    pageSize,
    catalogFilters,
    filterOwnership,
    catalogSort,
    !hasSearchInput
  );

  const filteredItems = useMemo(
    () =>
      items.filter((card) =>
        matchesCatalogFilters(card, catalogFilters, filterOwnership)
      ),
    [items, catalogFilters, filterOwnership]
  );

  const featuredFiltered = browseCatalog.items;
  const displayItems = resolveCatalogDisplayItems({
    hasSearchInput,
    searchItems: filteredItems,
    browseItems: featuredFiltered,
    searchPending,
    isLoading,
    isFetching,
    searchItemsLength: items.length,
  });
  const displayItemsRef = useLatestRef(displayItems);
  const scrollMetricsRef = useRef<CatalogScrollMetrics>({
    distanceFromEnd: Number.POSITIVE_INFINITY,
    viewportHeight: catalogViewportHeight,
    velocityY: 0,
  });
  const lastScrollSampleRef = useRef({ y: 0, t: Date.now() });
  const pendingCatalogFetchRef = useRef(false);
  const isSearching = hasSearchInput;
  const hasNextPage = hasSearchInput ? searchHasNextPage : browseCatalog.hasNextPage;
  const isFetchingNextPage = hasSearchInput
    ? searchIsFetchingNextPage
    : browseCatalog.isFetchingNextPage;
  const fetchNextPage = hasSearchInput
    ? fetchNextSearchPage
    : browseCatalog.fetchNextPage;
  const isList = view === 'list';

  const selectedCard = useMemo(
    () =>
      selectedVariant
        ? (displayItems.find((item) =>
            cardListItemMatchesVariant(item, selectedVariant)
          ) ?? null)
        : null,
    [displayItems, selectedVariant]
  );

  const catalogSelectedVariant = splitLayout
    ? selectedVariant
    : drawerPresentation?.open
      ? drawerPresentation.variantNumber
      : null;

  const drawerVariant = drawerPresentation?.variantNumber ?? null;

  const drawerCard = useMemo(
    () =>
      drawerVariant
        ? (displayItems.find((item) =>
            cardListItemMatchesVariant(item, drawerVariant)
          ) ?? null)
        : null,
    [displayItems, drawerVariant]
  );

  useEffect(() => {
    logDrawer('host.render', {
      platform: Platform.OS,
      isMobile,
      splitLayout,
      drawerHostMounted: Boolean(!splitLayout && drawerPresentation && drawerVariant),
      drawerVariant,
      selectedVariant,
      ...snapshotPresentation(drawerPresentation),
    });
  }, [drawerPresentation, drawerVariant, isMobile, selectedVariant, splitLayout]);

  useEffect(() => {
    if (!drawerPresentation?.open) return;
    return watchDrawerOpen({ watch: 'catalog-host' }, () => ({
      platform: Platform.OS,
      isMobile,
      splitLayout,
      ...snapshotPresentation(drawerPresentationRef.current),
    }));
  }, [
    drawerPresentation?.open,
    drawerPresentation?.sessionId,
    drawerPresentationRef,
    isMobile,
    splitLayout,
  ]);

  useEffect(() => {
    if (displayItems.length === 0) return;

    let added = false;
    for (const card of displayItems.slice(0, pageSize)) {
      for (const variant of collectVariantNumbers([card])) {
        if (!ownershipVariantSetRef.current.has(variant)) {
          ownershipVariantSetRef.current.add(variant);
          added = true;
        }
      }
    }
    if (added) {
      queueOwnershipFetch();
    }
  }, [displayItems, pageSize, queueOwnershipFetch]);

  useEffect(() => {
    const prefetchFrom = Math.max(0, displayItems.length - pageSize);
    for (const card of displayItems.slice(prefetchFrom)) {
      prefetchCardDetail(queryClient, card);
    }
    lastArtWarmIndexRef.current = -1;
    prefetchCatalogArt(displayItems.slice(0, pageSize), {
      limit: pageSize,
      includeFull: true,
    });
  }, [displayItems, pageSize, queryClient]);

  useEffect(() => {
    if (!splitLayout) return;
    setDrawerPresentation(null);
    if (displayItems.length === 0) {
      if (searchPending || isLoading || isFetching) return;
      setSelectedVariant(null);
      return;
    }
    const stillVisible = displayItems.some((c) =>
      cardListItemMatchesVariant(c, selectedVariant)
    );
    if (!stillVisible) {
      setSelectedVariant(displayItems[0]?.variantNumber ?? null);
    }
  }, [
    displayItems,
    selectedVariant,
    splitLayout,
    searchPending,
    isLoading,
    isFetching,
  ]);

  const handleSelectCard = useCallback(
    (variantNumber: string) => {
      const previous = drawerPresentationRef.current;
      const item = displayItemsRef.current.find((card) =>
        cardListItemMatchesVariant(card, variantNumber)
      );
      logDrawer('host.select', {
        platform: Platform.OS,
        isMobile,
        splitLayout,
        hasListItem: item != null,
        nextSessionId: nextDrawerSessionIdRef.current + (splitLayout ? 0 : 1),
        sameVariant: previous?.variantNumber === variantNumber,
        ...snapshotPresentation(previous),
        variantNumber,
      });
      if (item) {
        prefetchCardDetail(queryClient, item);
      }
      // Direct GET for rules text — don't wait on the batch prefetch queue.
      ensureCardDetail(queryClient, variantNumber);
      if (!splitLayout) {
        nextDrawerSessionIdRef.current += 1;
        const next = createCatalogDrawerPresentation(
          nextDrawerSessionIdRef.current,
          variantNumber
        );
        logDrawer('host.present', {
          platform: Platform.OS,
          replacingSessionId: previous?.sessionId ?? null,
          ...snapshotPresentation(next),
        });
        setDrawerPresentation(next);
      } else {
        logDrawer('host.skip-drawer', {
          platform: Platform.OS,
          reason: 'split-layout',
          variantNumber,
        });
      }
      setSelectedVariant(variantNumber);
    },
    [queryClient, displayItemsRef, drawerPresentationRef, isMobile, splitLayout]
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<CardListItem>[] }) => {
      let added = false;
      let maxIndex = -1;

      for (const entry of viewableItems) {
        if (!entry.item) continue;
        if (typeof entry.index === 'number') {
          maxIndex = Math.max(maxIndex, entry.index);
        }
        prefetchCardDetail(queryClient, entry.item);
        for (const variant of collectVariantNumbers([entry.item])) {
          if (!ownershipVariantSetRef.current.has(variant)) {
            ownershipVariantSetRef.current.add(variant);
            added = true;
          }
        }
      }

      if (maxIndex >= 0) {
        const catalogItems = displayItemsRef.current;
        const lookahead = catalogLookaheadCount(
          isList ? 'list' : 'grid',
          numColumns,
          scrollMetricsRef.current.velocityY
        );
        for (
          let i = maxIndex + 1;
          i <= maxIndex + lookahead && i < catalogItems.length;
          i += 1
        ) {
          prefetchCardDetail(queryClient, catalogItems[i]!);
        }
      }

      if (selectedVariant && !ownershipVariantSetRef.current.has(selectedVariant)) {
        ownershipVariantSetRef.current.add(selectedVariant);
        added = true;
      }

      if (added) {
        queueOwnershipFetch();
      }
    },
    [
      isList,
      numColumns,
      queryClient,
      selectedVariant,
      queueOwnershipFetch,
      displayItemsRef,
    ]
  );

  const onViewableItemsChangedRef = useLatestRef(onViewableItemsChanged);

  const handleViewableItemsChanged = useCallback(
    (info: { viewableItems: ViewToken<CardListItem>[] }) => {
      onViewableItemsChangedRef.current(info);
    },
    [onViewableItemsChangedRef]
  );

  const requestCatalogFetch = useCallback(() => {
    if (!hasNextPage) return;
    if (isFetchingNextPage) {
      pendingCatalogFetchRef.current = true;
      return;
    }
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const maybePrefetchCatalog = useCallback(() => {
    if (!hasNextPage) return;
    if (shouldPrefetchCatalog(scrollMetricsRef.current, view, tileWidth, compact)) {
      requestCatalogFetch();
      if (isFastCatalogScroll(scrollMetricsRef.current.velocityY)) {
        requestCatalogFetch();
      }
    }
  }, [compact, hasNextPage, requestCatalogFetch, tileWidth, view]);

  useEffect(() => {
    if (isFetchingNextPage) return;
    if (
      !pendingCatalogFetchRef.current &&
      !isFastCatalogScroll(scrollMetricsRef.current.velocityY)
    ) {
      return;
    }
    pendingCatalogFetchRef.current = false;
    maybePrefetchCatalog();
  }, [displayItems.length, isFetchingNextPage, maybePrefetchCatalog]);

  const fetchMoreCatalog = useCallback(() => {
    requestCatalogFetch();
  }, [requestCatalogFetch]);

  const catalogTargetHeight = useMemo(
    () => catalogViewportTargetHeight(catalogViewportHeight, view, tileWidth, compact),
    [catalogViewportHeight, view, tileWidth, compact]
  );

  const catalogListDrawDistance = useMemo(
    () => catalogDrawDistance(catalogViewportHeight),
    [catalogViewportHeight]
  );

  const handleCatalogScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const now = Date.now();
      const velocityY = measureCatalogScrollVelocity(
        lastScrollSampleRef.current,
        contentOffset.y,
        now
      );
      lastScrollSampleRef.current = { y: contentOffset.y, t: now };

      scrollMetricsRef.current = {
        distanceFromEnd:
          contentSize.height - (layoutMeasurement.height + contentOffset.y),
        viewportHeight: layoutMeasurement.height,
        velocityY,
      };

      if (velocityY <= 0) return;
      maybePrefetchCatalog();

      const layout = isList ? 'list' : 'grid';
      const rowHeight = estimateCatalogRowHeight(layout, tileWidth, compact);
      const firstRow = Math.max(
        0,
        Math.floor(contentOffset.y / Math.max(1, rowHeight))
      );
      const firstIndex = layout === 'list' ? firstRow : firstRow * numColumns;
      const visibleRows = Math.max(
        1,
        Math.ceil(layoutMeasurement.height / Math.max(1, rowHeight))
      );
      const visibleCount = layout === 'list' ? visibleRows : visibleRows * numColumns;
      const lookahead = catalogLookaheadCount(layout, numColumns, velocityY);
      const warmStart = firstIndex + visibleCount;

      if (Math.abs(warmStart - lastArtWarmIndexRef.current) < Math.max(1, numColumns)) {
        return;
      }
      lastArtWarmIndexRef.current = warmStart;
      const upcoming = displayItemsRef.current.slice(warmStart, warmStart + lookahead);
      prefetchCatalogArt(upcoming, { limit: lookahead, includeFull: true });
    },
    [compact, displayItemsRef, isList, maybePrefetchCatalog, numColumns, tileWidth]
  );

  const maybeFillCatalogViewport = useCallback(
    (contentHeight: number) => {
      scrollMetricsRef.current = {
        ...scrollMetricsRef.current,
        distanceFromEnd: Math.max(0, contentHeight - catalogViewportHeight),
        viewportHeight: catalogViewportHeight,
      };
      if (contentHeight > 0 && contentHeight < catalogTargetHeight && hasNextPage) {
        requestCatalogFetch();
      } else {
        maybePrefetchCatalog();
      }
    },
    [
      catalogTargetHeight,
      catalogViewportHeight,
      hasNextPage,
      maybePrefetchCatalog,
      requestCatalogFetch,
    ]
  );
  const catalogGridLoading = isCatalogGridLoading({
    isSearching: hasSearchInput,
    searchPending,
    isLoading,
    isFetching,
    searchItemsLength: items.length,
    browseLoading: browseCatalog.isLoading,
  });
  const filterActive = catalogFiltersActive(catalogFilters);

  const clearSearch = useCallback(() => {
    setQuery('');
  }, []);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void prefetchCatalogFilters(queryClient);
    }, [queryClient])
  );

  const listEmpty = useMemo(
    () => (
      <SearchScreenListEmpty
        query={query}
        minLength={minLength}
        fetchStatus={{
          isSearching,
          searchPending,
          isLoading,
          isError,
          isFetching,
        }}
        itemsLength={items.length}
        browseCatalogLoading={browseCatalog.isLoading}
        featuredFilteredLength={featuredFiltered.length}
        filteredItemsLength={filteredItems.length}
        view={view}
        isList={isList}
        numColumns={numColumns}
        tileWidth={tileWidth}
        compact={compact}
        filterActive={filterActive}
        ownedFilterActive={ownedFilterActive}
        catalogFilters={catalogFilters}
      />
    ),
    [
      query,
      isSearching,
      searchPending,
      isLoading,
      isError,
      isFetching,
      browseCatalog.isLoading,
      featuredFiltered.length,
      items.length,
      filteredItems.length,
      minLength,
      view,
      isList,
      numColumns,
      tileWidth,
      compact,
      filterActive,
      ownedFilterActive,
      catalogFilters,
    ]
  );

  const pageMaxWidth = splitLayout ? undefined : contentWidth;

  const handleSubmitSearch = useCallback(
    (event?: { nativeEvent: { text: string } }) => {
      searchNow(event?.nativeEvent.text);
    },
    [searchNow]
  );

  const handleSortPress = useCallback(() => {
    setSortSheetOpen(true);
  }, []);

  const handleFilterPress = useCallback(() => {
    setFilterSheetOpen(true);
  }, []);

  const searchLoading = hasSearchInput && isLoading;

  const searchPanel = useMemo(
    () => (
      <SearchScreenToolbar
        pageMaxWidth={pageMaxWidth}
        query={query}
        onQueryChange={setQuery}
        onClearSearch={clearSearch}
        // Spinner uses isLoading only — isFetching must not flip chrome mid-keystroke.
        searchLoading={searchLoading}
        onSubmitSearch={handleSubmitSearch}
        isMobile={isMobile}
        filterActive={filterActive}
        catalogFilters={catalogFilters}
        onFiltersChange={applyCatalogFilters}
        catalogSort={catalogSort}
        onSortPress={handleSortPress}
        onFilterPress={handleFilterPress}
      />
    ),
    [
      pageMaxWidth,
      query,
      clearSearch,
      searchLoading,
      handleSubmitSearch,
      isMobile,
      filterActive,
      catalogFilters,
      applyCatalogFilters,
      catalogSort,
      handleSortPress,
      handleFilterPress,
    ]
  );

  const resultsTransitionKey = catalogFiltersQueryKey(catalogFilters);

  useEffect(() => {
    catalogListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [resultsTransitionKey]);

  useEffect(() => {
    if (!sortPending) return;

    let cancelled = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const MIN_VISIBLE_MS = 360;

    const task = InteractionManager.runAfterInteractions(() => {
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      hideTimer = setTimeout(() => {
        if (!cancelled) setSortPending(false);
      }, remaining);
    });

    return () => {
      cancelled = true;
      task.cancel?.();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [sortPending, catalogSort]);

  const applyCatalogSort = useCallback(
    (next: CatalogSort) => {
      const normalized = normalizeCatalogSort(next);
      if (sortOptionKey(normalized) === sortOptionKey(catalogSort)) return;
      setSortPending(true);
      requestAnimationFrame(() => {
        startTransition(() => {
          setCatalogSort(normalized);
        });
        catalogListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    },
    [catalogSort]
  );

  const listExtraData = useMemo(
    () => ({
      selectedVariant: catalogSelectedVariant,
      ownership: collectionByVariant,
      simpleAdd: catalogFilters.simpleAdd,
    }),
    [catalogSelectedVariant, collectionByVariant, catalogFilters.simpleAdd]
  );

  const catalogList = (
    <SearchCatalogList
      catalogListRef={catalogListRef}
      displayItems={displayItems}
      view={view}
      numColumns={numColumns}
      isList={isList}
      selectedVariant={catalogSelectedVariant}
      splitLayout={splitLayout}
      compact={compact}
      catalogFiltersSimpleAdd={catalogFilters.simpleAdd}
      collectionByVariant={collectionByVariant}
      handleSelectCard={handleSelectCard}
      listExtraData={listExtraData}
      paddingBottomInline={paddingBottomInline}
      listEmpty={listEmpty}
      resultsTransitionKey={resultsTransitionKey}
      sortPending={sortPending}
      dismissKeyboard={dismissKeyboard}
      handleViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      handleCatalogScroll={handleCatalogScroll}
      fetchMoreCatalog={fetchMoreCatalog}
      maybeFillCatalogViewport={maybeFillCatalogViewport}
      drawDistance={catalogListDrawDistance}
      onEndReachedThreshold={CATALOG_END_REACHED_THRESHOLD}
    />
  );

  return (
    <View className="relative min-h-0 flex-1">
      {splitLayout ? (
        <ScreenSplit
          asideWidth={DETAIL_PANEL_WIDTH}
          gap={CATALOG_DETAIL_GAP}
          onMainWidthChange={setSplitMainWidth}
          aside={
            catalogGridLoading && displayItems.length === 0 ? (
              <CatalogDetailPanelSkeleton />
            ) : selectedVariant ? (
              <CatalogDetailPanel
                variantNumber={selectedVariant}
                catalogListItem={selectedCard}
              />
            ) : (
              <View className="w-full" />
            )
          }
        >
          {searchPanel}
          {catalogList}
        </ScreenSplit>
      ) : (
        <ScreenLayoutBody>
          {searchPanel}
          {catalogList}
        </ScreenLayoutBody>
      )}

      {isMobile ? (
        <CatalogFilterSheet
          visible={filterSheetOpen}
          filters={catalogFilters}
          onClose={() => setFilterSheetOpen(false)}
          onFiltersChange={applyCatalogFilters}
        />
      ) : null}
      <SortSheet
        visible={sortSheetOpen}
        activeSort={catalogSort}
        onClose={() => {
          setSortSheetOpen(false);
        }}
        onSortChange={applyCatalogSort}
      />

      {/* Selection clears at dismiss-start; visual host stays until Gorhom finishes close. */}
      {!splitLayout && drawerPresentation && drawerVariant ? (
        <CardDetailDrawer
          key={drawerPresentation.sessionId}
          open={drawerPresentation.open}
          onClose={() => {
            const dismissedSessionId = drawerPresentation.sessionId;
            logDrawer('host.close', {
              platform: Platform.OS,
              dismissedSessionId,
              ...snapshotPresentation(drawerPresentation),
            });
            setDrawerPresentation((current) =>
              beginCatalogDrawerDismiss(current, dismissedSessionId)
            );
          }}
          onDismissed={() => {
            const dismissedSessionId = drawerPresentation.sessionId;
            logDrawer('host.dismissed', {
              platform: Platform.OS,
              dismissedSessionId,
              ...snapshotPresentation(drawerPresentation),
            });
            setDrawerPresentation((current) =>
              finishCatalogDrawerDismiss(current, dismissedSessionId)
            );
          }}
        >
          <CatalogDetailPanel
            variantNumber={drawerVariant}
            catalogListItem={drawerCard}
            embedded="drawer"
          />
        </CardDetailDrawer>
      ) : null}
    </View>
  );
}
