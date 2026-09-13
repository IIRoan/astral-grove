import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { CardListItem } from '@riftbound/contracts';
import { CardTile } from '@/components/cards/CardTile';
import { ThemedIcon, CardsIcon, ChevronLeftIcon, SearchIcon } from '@/components/icons';
import { SearchEmptyState } from '@/components/search/SearchScreenEmpty';
import { SearchSkeleton } from '@/components/search/SearchSkeleton';
import { ScreenLayoutBody, useScreenLayout } from '@/components/shell/ScreenLayout';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import {
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  sanitizeCatalogFilters,
} from '@/constants/catalogFilters';
import { DEFAULT_CATALOG_SORT } from '@/constants/catalogSort';
import { getSetCatalogEntry } from '@/constants/setCatalog';
import { useTheme } from '@/context/ThemeContext';
import { useCatalogArtLookahead } from '@/hooks/useCatalogArtLookahead';
import { useCatalogBrowseInfinite } from '@/hooks/useCatalogBrowseInfinite';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import { useCollection } from '@/hooks/useCollection';
import { useFiltersData } from '@/hooks/useFiltersData';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import { catalogGridCellStyle, catalogGridListStyle } from '@/lib/catalog-grid-layout';
import {
  CATALOG_END_REACHED_THRESHOLD,
  estimateCatalogPageSize,
} from '@/lib/catalog-page-size';
import { cn } from '@/lib/utils';
import { searchCatalogItems, sortCatalogItems } from '@/utils/catalogSearch';
import { ownershipMapFromCollection } from '@/utils/collectionOwnership';
import { mergeSetStats } from '@/utils/collectionStats';
import { FACTORY_RADIUS_CARD_CLASS } from '@/constants/factoryShape';

function paramString(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? '';
}

export function CollectionSetMissingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ setCode?: string }>();
  const setCode = paramString(params.setCode).toUpperCase();
  const { defaultLayout: view } = useTheme();
  const { contentWidth, paddingBottomInline } = useScreenLayout();
  const [query, setQuery] = useState('');

  const { data: collection = [] } = useCollection();
  const filtersQuery = useFiltersData();
  const catalogIndex = useCatalogIndex();
  const catalogItems = getCatalogIndexItems(catalogIndex.data);
  const indexReady = catalogItems.length > 0;

  const apiSets = useMemo(
    () =>
      (filtersQuery.data?.sets ?? []).map((s) => ({
        code: s.code ?? s.id,
        name: s.name,
        count: s.printCount ?? s.count,
        ...(s.foilPrintCount != null ? { foilCount: s.foilPrintCount } : {}),
      })),
    [filtersQuery.data?.sets]
  );

  const mergedSets = useMemo(
    () => mergeSetStats(collection, apiSets, getSetCatalogEntry),
    [collection, apiSets]
  );

  const setStat = mergedSets.find((set) => set.code.toUpperCase() === setCode);
  const catalogEntry = getSetCatalogEntry(setCode);
  const setName = setStat?.name ?? catalogEntry?.name ?? setCode;
  const knownSet = Boolean(setStat || catalogEntry);

  useEffect(() => {
    if (!setCode) {
      router.replace('/(tabs)/collection');
      return;
    }
    if (!filtersQuery.isLoading && !filtersQuery.isFetching && !knownSet) {
      router.replace('/(tabs)/collection');
    }
  }, [setCode, filtersQuery.isLoading, filtersQuery.isFetching, knownSet, router]);

  const filters = useMemo(
    () =>
      sanitizeCatalogFilters({
        ...DEFAULT_CATALOG_FILTERS,
        collection: 'missing',
        sets: [setCode],
      }),
    [setCode]
  );

  const collectionByVariant = useMemo(
    () => ownershipMapFromCollection(collection),
    [collection]
  );

  const { numColumns, tileWidth, compact } = useResponsiveColumns(view, {
    measuredWidth: contentWidth,
    fillAvailable: view === 'grid',
  });

  const pageSize = useMemo(
    () => estimateCatalogPageSize(numColumns, view, 640, tileWidth, compact),
    [numColumns, view, tileWidth, compact]
  );

  const browse = useCatalogBrowseInfinite(
    pageSize,
    filters,
    collectionByVariant,
    DEFAULT_CATALOG_SORT,
    Boolean(setCode) && !indexReady
  );

  const allMissing = useMemo(() => {
    if (indexReady) {
      return sortCatalogItems(
        catalogItems.filter((card) =>
          matchesCatalogFilters(card, filters, collectionByVariant)
        ),
        DEFAULT_CATALOG_SORT
      );
    }
    return browse.items;
  }, [indexReady, catalogItems, filters, collectionByVariant, browse.items]);

  const displayItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return allMissing;
    return searchCatalogItems(allMissing, trimmed, DEFAULT_CATALOG_SORT);
  }, [allMissing, query]);

  const isList = view === 'list';
  const gridCellStyle = useMemo(() => catalogGridCellStyle(), []);
  const listStyle = useMemo(
    () => (isList ? { flex: 1 } : catalogGridListStyle()),
    [isList]
  );

  const { drawDistance, viewabilityConfig, handleViewableItemsChanged, handleScroll } =
    useCatalogArtLookahead({
      items: displayItems,
      numColumns,
      layout: view,
      tileWidth,
      compact,
    });

  const loading =
    Boolean(setCode) &&
    ((catalogIndex.isPending && !indexReady && browse.isLoading) ||
      (filtersQuery.isLoading && !knownSet));

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/collection');
  }, [router]);

  const renderItem = useMemo<ListRenderItem<CardListItem>>(
    () =>
      ({ item, index }) => {
        if (!item) return null;
        if (isList) {
          const isLast = index === displayItems.length - 1;
          return (
            <View className={cn(!isLast && 'border-b border-border')}>
              <CardTile
                card={item}
                layout="list"
                mode="search"
                compact={compact}
                enableQuickAdd
                collectionByVariant={collectionByVariant}
              />
            </View>
          );
        }

        return (
          <View style={gridCellStyle} collapsable={false}>
            <CardTile
              card={item}
              layout="grid"
              mode="search"
              compact={compact}
              enableQuickAdd
              collectionByVariant={collectionByVariant}
            />
          </View>
        );
      },
    [isList, compact, collectionByVariant, displayItems.length, gridCellStyle]
  );

  const listEmpty = loading ? (
    <SearchSkeleton
      layout={view}
      count={isList ? 8 : numColumns * 2}
      tileWidth={tileWidth}
      compact={compact}
    />
  ) : query.trim() ? (
    <SearchEmptyState
      icon={SearchIcon}
      title="No missing cards match this search"
      description="Try a different name or variant number"
    />
  ) : (
    <SearchEmptyState
      icon={CardsIcon}
      title={`You've collected every card in ${setName}`}
      description="New printings will show up here when the catalog updates"
    />
  );

  const owned = setStat?.owned ?? 0;
  const total = setStat?.total ?? 0;
  const missingCount = allMissing.length;
  const subtitle =
    total > 0
      ? `${missingCount.toLocaleString()} missing · ${owned.toLocaleString()}/${total.toLocaleString()} collected`
      : `${missingCount.toLocaleString()} missing`;

  return (
    <ScreenLayoutBody className="gap-3">
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to collection"
          className="size-10 shrink-0 items-center justify-center rounded-[3px] border border-border bg-card active:bg-card-panel"
          onPress={goBack}
        >
          <ThemedIcon icon={ChevronLeftIcon} size={22} color="foreground" />
        </Pressable>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-base font-semibold text-foreground">{setName}</Text>
          <Text className="font-mono text-[11px] text-muted-foreground">
            {subtitle}
          </Text>
        </View>
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search missing cards"
        accessibilityLabel="Search missing cards"
        className="min-h-12 rounded-[10px] border-border bg-card"
      />

      <View className="relative min-h-0 flex-1">
        <View
          className={cn(
            'min-h-0 flex-1',
            isList &&
              displayItems.length > 0 &&
              cn(
                'overflow-hidden border border-border bg-card',
                FACTORY_RADIUS_CARD_CLASS
              )
          )}
        >
          <FlashList
            data={displayItems}
            key={`${view}-${String(numColumns)}`}
            numColumns={isList ? 1 : numColumns}
            keyExtractor={(item) => item.variantNumber}
            renderItem={renderItem}
            extraData={collectionByVariant}
            ListFooterComponent={<View style={{ height: paddingBottomInline }} />}
            style={listStyle}
            contentContainerStyle={{ flexGrow: 1 }}
            ListEmptyComponent={listEmpty}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
            onScrollBeginDrag={Platform.OS === 'web' ? undefined : Keyboard.dismiss}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onEndReached={() => {
              if (!indexReady) browse.fetchNextPage();
            }}
            onEndReachedThreshold={CATALOG_END_REACHED_THRESHOLD}
            drawDistance={drawDistance}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </ScreenLayoutBody>
  );
}
