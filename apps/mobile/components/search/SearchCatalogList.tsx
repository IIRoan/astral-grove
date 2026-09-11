import { useMemo } from 'react';
import {
  Platform,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  FlashList,
  type FlashListRef,
  type ListRenderItem,
  type ViewToken,
} from '@shopify/flash-list';
import type { CardListItem } from '@riftbound/contracts';
import { CardTile } from '@/components/cards/CardTile';
import { CatalogResultsTransition } from '@/components/catalog/CatalogResultsTransition';
import { AppLoader } from '@/components/ui/app-loader';
import { catalogGridCellStyle, catalogGridListStyle } from '@/lib/catalog-grid-layout';
import { cardListItemMatchesVariant } from '@/utils/variants';
import type { CollectionOwnershipMap } from '@/utils/collectionOwnership';
import { cn } from '@/lib/utils';
import { FACTORY_RADIUS_CARD_CLASS } from '@/constants/factoryShape';

interface SearchCatalogListProps {
  catalogListRef: React.RefObject<FlashListRef<CardListItem> | null>;
  displayItems: CardListItem[];
  view: 'grid' | 'list';
  numColumns: number;
  isList: boolean;
  selectedVariant: string | null;
  splitLayout: boolean;
  compact: boolean;
  catalogFiltersSimpleAdd: boolean;
  collectionByVariant: CollectionOwnershipMap;
  handleSelectCard: (variantNumber: string) => void;
  listExtraData: object;
  paddingBottomInline: number;
  listEmpty: React.ReactElement | null;
  resultsTransitionKey: string;
  sortPending: boolean;
  dismissKeyboard: () => void;
  handleViewableItemsChanged: (info: {
    viewableItems: ViewToken<CardListItem>[];
  }) => void;
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  handleCatalogScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  fetchMoreCatalog: () => void;
  maybeFillCatalogViewport: (height: number) => void;
  drawDistance: number;
  onEndReachedThreshold?: number;
}

export function SearchCatalogList({
  catalogListRef,
  displayItems,
  view,
  numColumns,
  isList,
  selectedVariant,
  splitLayout,
  compact,
  catalogFiltersSimpleAdd,
  collectionByVariant,
  handleSelectCard,
  listExtraData,
  paddingBottomInline,
  listEmpty,
  resultsTransitionKey,
  sortPending,
  dismissKeyboard,
  handleViewableItemsChanged,
  viewabilityConfig,
  handleCatalogScroll,
  fetchMoreCatalog,
  maybeFillCatalogViewport,
  drawDistance,
  onEndReachedThreshold = 1.75,
}: SearchCatalogListProps) {
  const gridCellStyle = useMemo(() => catalogGridCellStyle(), []);

  const listStyle = useMemo(
    () => (isList ? { flex: 1 } : catalogGridListStyle()),
    [isList]
  );

  const renderItem = useMemo<ListRenderItem<CardListItem>>(
    () =>
      ({ item, index }) => {
        if (!item) return null;
        const tileSelected = cardListItemMatchesVariant(item, selectedVariant);
        // Phone drawer: no selection chrome (lingered after close); desktop split still highlights.
        const showSelected = splitLayout && tileSelected;
        const familyContextVariantNumber =
          showSelected && selectedVariant != null
            ? selectedVariant
            : item.variantNumber;

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
                simpleAdd={catalogFiltersSimpleAdd}
                selected={showSelected}
                collectionByVariant={collectionByVariant}
                familyContextVariantNumber={familyContextVariantNumber}
                onSelectVariant={handleSelectCard}
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
              simpleAdd={catalogFiltersSimpleAdd}
              selected={showSelected}
              collectionByVariant={collectionByVariant}
              familyContextVariantNumber={familyContextVariantNumber}
              onSelectVariant={handleSelectCard}
            />
          </View>
        );
      },
    [
      isList,
      gridCellStyle,
      compact,
      selectedVariant,
      splitLayout,
      handleSelectCard,
      collectionByVariant,
      catalogFiltersSimpleAdd,
      displayItems.length,
    ]
  );

  const listFooter = useMemo(
    () => <View style={{ height: paddingBottomInline }} />,
    [paddingBottomInline]
  );

  return (
    <View className="relative min-h-0 flex-1">
      <CatalogResultsTransition transitionKey={resultsTransitionKey}>
        <View
          className={cn(
            'min-h-0 flex-1',
            isList &&
              displayItems.length > 0 &&
              !sortPending &&
              cn(
                'overflow-hidden border border-border bg-card',
                FACTORY_RADIUS_CARD_CLASS
              )
          )}
        >
          <FlashList
            ref={catalogListRef}
            data={displayItems}
            key={`${view}-${String(numColumns)}`}
            numColumns={isList ? 1 : numColumns}
            keyExtractor={(item) => item.variantNumber}
            renderItem={renderItem}
            extraData={listExtraData}
            ListFooterComponent={listFooter}
            style={listStyle}
            contentContainerStyle={{ flexGrow: 1 }}
            ListEmptyComponent={listEmpty}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
            onScrollBeginDrag={Platform.OS === 'web' ? undefined : dismissKeyboard}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onScroll={handleCatalogScroll}
            scrollEventThrottle={16}
            onEndReached={fetchMoreCatalog}
            onEndReachedThreshold={onEndReachedThreshold}
            drawDistance={drawDistance}
            onContentSizeChange={(_, height) => {
              maybeFillCatalogViewport(height);
            }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </CatalogResultsTransition>
      {sortPending ? (
        <View
          className="absolute inset-0 items-center justify-center bg-background"
          pointerEvents="none"
          accessibilityLabel="Sorting cards"
        >
          <AppLoader size="lg" />
        </View>
      ) : null}
    </View>
  );
}
