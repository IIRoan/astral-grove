import { ThemedIcon, LibraryIcon } from '@/components/icons';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { AppLoader } from '@/components/ui/app-loader';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { View, type LayoutChangeEvent } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import {
  CatalogActiveFilterChips,
  CatalogFilterSheet,
} from '@/components/catalog/FilterSheet';
import { CatalogCollectionPillNav } from '@/components/catalog/CatalogCollectionPillNav';
import { CatalogDesktopFilterBar } from '@/components/catalog/CatalogDesktopFilterBar';
import { DeckCatalogGridTile } from '@/components/deck/DeckCatalogGridTile';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { SearchInput } from '@/components/ui/search-input';
import { Text } from '@/components/ui/text';
import {
  catalogFiltersActive,
  sanitizeCatalogFilters,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useCatalogArtLookahead } from '@/hooks/useCatalogArtLookahead';
import { useDebounce } from '@/hooks/useDebounce';
import { useDeckAddCatalog } from '@/hooks/useDeckAddCatalog';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import { CATALOG_TOOLBAR_DESKTOP_ROW_CLASS } from '@/constants/catalogToolbar';
import { CATALOG_END_REACHED_THRESHOLD } from '@/lib/catalog-page-size';
import {
  defaultDeckAddCatalogFilters,
  defaultDeckAddSearch,
} from '@/lib/deck-add-catalog';
import { publishDeckBuilderMobileFilterChrome } from '@/lib/deckBuilderMobileFilterChrome';
import { isCardTournamentIllegal } from '@/lib/card-legality';
import { addCardToDeck, changeDeckCardQty } from '@/lib/deck-card';
import { isCardEligibleForSection } from '@/lib/deck-eligibility';
import {
  deckMembershipRevision,
  getDeckCandidateCount,
  listDeckSectionCards,
} from '@/lib/deck-membership';
import type { DeckCard, DeckState } from '@/lib/deck-types';
import { ownedCountForCardName } from '@/lib/deck-validation';
import { openCard } from '@/utils/cardNavigation';

type BuilderCatalogSection = 'mainDeck' | 'sideboard';

interface DeckBuilderCatalogPanelProps {
  deck: DeckState;
  readOnly?: boolean;
  collectionByName?: ReadonlyMap<string, number>;
  onPersist: (
    deck: DeckState | ((previous: DeckState) => DeckState),
    options?: { immediate?: boolean }
  ) => void;
  section?: BuilderCatalogSection;
  onSectionChange?: (section: BuilderCatalogSection) => void;
  paddingBottom?: number;
}

const CatalogTile = memo(function CatalogTile({
  tileWidth,
  candidate,
  count,
  owned = null,
  blocked,
  blockedLabel = 'Unavailable',
  illegal = false,
  readOnly,
  onAdd,
  onRemove,
  onOpenCard,
}: {
  tileWidth: number;
  candidate: DeckCard;
  count: number;
  owned?: number | null;
  blocked?: boolean;
  blockedLabel?: string;
  illegal?: boolean;
  readOnly?: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onOpenCard: () => void;
}) {
  return (
    <DeckCatalogGridTile
      tileWidth={tileWidth}
      candidate={candidate}
      count={count}
      owned={owned}
      blocked={blocked}
      blockedLabel={blockedLabel}
      illegal={illegal}
      readOnly={readOnly}
      onAdd={onAdd}
      onRemove={onRemove}
      onOpenCard={onOpenCard}
    />
  );
});

const CatalogGridRow = memo(function CatalogGridRow({
  item,
  deck,
  section,
  tileWidth,
  gridCellStyle,
  readOnly,
  collectionByName,
  onAddOne,
  onRemoveOne,
  onOpenCard,
}: {
  item: DeckCard;
  deck: DeckState;
  section: BuilderCatalogSection;
  tileWidth: number;
  gridCellStyle: { paddingHorizontal: number; marginBottom: number };
  readOnly: boolean;
  collectionByName?: ReadonlyMap<string, number>;
  onAddOne: (candidate: DeckCard) => void;
  onRemoveOne: (candidate: DeckCard) => void;
  onOpenCard: (variantNumber: string) => void;
}) {
  const count = getDeckCandidateCount(deck, section, item);
  const eligibility = isCardEligibleForSection({
    deck,
    section,
    candidateCard: item,
  });
  const blocked = !readOnly && !eligibility.eligible && count === 0;
  const blockedLabel = eligibility.reason?.includes('copy')
    ? 'Max copies'
    : 'Unavailable';
  const illegal = isCardTournamentIllegal(item, deck);
  const owned =
    count > 0 && collectionByName
      ? ownedCountForCardName(item.name, collectionByName)
      : null;
  const handleAdd = useCallback(() => onAddOne(item), [onAddOne, item]);
  const handleRemove = useCallback(() => onRemoveOne(item), [onRemoveOne, item]);
  const handleOpen = useCallback(
    () => onOpenCard(item.variantNumber),
    [onOpenCard, item.variantNumber]
  );

  return (
    <View style={gridCellStyle} collapsable={false}>
      <CatalogTile
        tileWidth={tileWidth}
        candidate={item}
        count={count}
        owned={owned}
        blocked={blocked}
        blockedLabel={blockedLabel}
        illegal={illegal}
        readOnly={readOnly}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onOpenCard={handleOpen}
      />
    </View>
  );
});

export function DeckBuilderCatalogPanel({
  deck,
  readOnly = false,
  collectionByName,
  onPersist,
  section: controlledSection = 'mainDeck',
  onSectionChange: _onSectionChange,
  paddingBottom = 0,
}: DeckBuilderCatalogPanelProps) {
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const legendKey = deck.legend?.variantNumber ?? '';

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0) setMeasuredWidth((prev) => (prev === next ? prev : next));
  }, []);

  useEffect(() => () => publishDeckBuilderMobileFilterChrome(null), []);

  return (
    <View className="min-h-0 flex-1" onLayout={onLayout}>
      <DeckBuilderCatalogBrowse
        key={`${controlledSection}-${legendKey}`}
        deck={deck}
        readOnly={readOnly}
        collectionByName={collectionByName}
        onPersist={onPersist}
        section={controlledSection}
        measuredWidth={measuredWidth}
        paddingBottom={paddingBottom}
      />
    </View>
  );
}

function DeckBuilderCatalogBrowse({
  deck,
  readOnly,
  collectionByName,
  onPersist,
  section,
  measuredWidth,
  paddingBottom,
}: {
  deck: DeckState;
  readOnly: boolean;
  collectionByName?: ReadonlyMap<string, number>;
  onPersist: (
    deck: DeckState | ((previous: DeckState) => DeckState),
    options?: { immediate?: boolean }
  ) => void;
  section: BuilderCatalogSection;
  measuredWidth: number | null;
  paddingBottom: number;
}) {
  const router = useRouter();
  const isMobile = useMobileLayout();
  const { tileWidth, gap, numColumns } = useResponsiveColumns('grid', {
    measuredWidth,
    fillAvailable: true,
  });

  const [query, setQuery] = useState(() => defaultDeckAddSearch(section, deck));
  const debouncedQuery = useDebounce(query.trim(), 300);
  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(() =>
    defaultDeckAddCatalogFilters(section, deck)
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const applyCatalogFilters = useCallback((next: CatalogFilters) => {
    setCatalogFilters(sanitizeCatalogFilters(next));
  }, []);

  const openFilterSheet = useCallback(() => {
    setFilterSheetOpen(true);
  }, []);

  const mobileFilterChrome = useMemo(
    () =>
      readOnly || !isMobile
        ? null
        : { filters: catalogFilters, onOpen: openFilterSheet },
    [catalogFilters, isMobile, openFilterSheet, readOnly]
  );

  useEffect(() => {
    publishDeckBuilderMobileFilterChrome(mobileFilterChrome);
  }, [mobileFilterChrome]);

  const catalog = useDeckAddCatalog(deck, section, debouncedQuery, catalogFilters, {
    enabled: !readOnly,
  });
  const membershipRevision = deckMembershipRevision(deck);
  const filterActive = !readOnly && catalogFiltersActive(catalogFilters);

  const browseCards = useMemo(() => {
    if (!readOnly) return [] as DeckCard[];
    const cards = listDeckSectionCards(deck, section);
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (card) =>
        card.name.toLowerCase().includes(q) ||
        card.variantNumber.toLowerCase().includes(q)
    );
  }, [debouncedQuery, deck, readOnly, section]);

  const displayCards = readOnly ? browseCards : catalog.cards;
  const searchPlaceholder = readOnly
    ? section === 'sideboard'
      ? 'Search sideboard'
      : 'Search this deck'
    : catalog.sectionMeta.placeholder;
  const contextLine = readOnly ? null : catalog.sectionMeta.contextLine;

  const { drawDistance, viewabilityConfig, handleViewableItemsChanged, handleScroll } =
    useCatalogArtLookahead({
      items: displayCards,
      numColumns,
      layout: 'grid',
      tileWidth,
    });

  const requestNextPage = useCallback(() => {
    if (readOnly) return;
    if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
      catalog.fetchNextPage();
    }
  }, [catalog, readOnly]);

  const handleAddOne = useCallback(
    (candidate: DeckCard) => {
      if (readOnly) return;
      const eligibility = isCardEligibleForSection({
        deck,
        section,
        candidateCard: candidate,
      });
      if (!eligibility.eligible) return;
      onPersist((prev) => addCardToDeck(prev, candidate, { section }), {
        immediate: true,
      });
    },
    [deck, onPersist, readOnly, section]
  );

  const handleRemoveOne = useCallback(
    (candidate: DeckCard) => {
      if (readOnly) return;
      const entry = getDeckCandidateCount(deck, section, candidate);
      if (entry <= 0) return;
      onPersist((prev) => changeDeckCardQty(prev, section, candidate.name, -1), {
        immediate: true,
      });
    },
    [deck, onPersist, readOnly, section]
  );

  const handleOpenCard = useCallback(
    (variantNumber: string) => {
      openCard(router, variantNumber, 'modal');
    },
    [router]
  );

  const gridCellStyle = useMemo(
    () => ({ paddingHorizontal: gap / 2, marginBottom: gap }),
    [gap]
  );
  const listStyle = useMemo(
    () => ({ flex: 1, minHeight: 0, marginHorizontal: -gap / 2 }),
    [gap]
  );

  const renderItem = useCallback<ListRenderItem<DeckCard>>(
    ({ item }) => (
      <CatalogGridRow
        item={item}
        deck={deck}
        section={section}
        tileWidth={tileWidth}
        gridCellStyle={gridCellStyle}
        readOnly={readOnly}
        collectionByName={collectionByName}
        onAddOne={handleAddOne}
        onRemoveOne={handleRemoveOne}
        onOpenCard={handleOpenCard}
      />
    ),
    [
      collectionByName,
      deck,
      gridCellStyle,
      handleAddOne,
      handleOpenCard,
      handleRemoveOne,
      readOnly,
      section,
      tileWidth,
    ]
  );

  const showBlockingLoader =
    !readOnly && catalog.isLoading && catalog.cards.length === 0;

  const emptyState = (
    <Empty className="border border-dashed border-border py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="mb-1 size-14">
          <ThemedIcon icon={LibraryIcon} size={28} color="ring" />
        </EmptyMedia>
        <EmptyTitle>
          {readOnly
            ? debouncedQuery
              ? 'No matching cards'
              : section === 'sideboard'
                ? 'Empty sideboard'
                : 'Empty main deck'
            : catalog.emptyState.title}
        </EmptyTitle>
        <EmptyDescription>
          {readOnly
            ? debouncedQuery
              ? 'Try a different search.'
              : section === 'sideboard'
                ? 'This deck has no sideboard cards.'
                : 'This deck has no main deck cards.'
            : catalog.emptyState.description}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <View className="min-h-0 flex-1">
      <View className="shrink-0 gap-1.5 pb-2">
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
        />

        {!readOnly && isMobile ? (
          <CatalogCollectionPillNav
            value={catalogFilters.collection}
            onChange={(collection) =>
              applyCatalogFilters({ ...catalogFilters, collection })
            }
          />
        ) : null}

        {!readOnly && !isMobile ? (
          <View className={CATALOG_TOOLBAR_DESKTOP_ROW_CLASS}>
            <View className="min-w-0 flex-1">
              <CatalogDesktopFilterBar
                filters={catalogFilters}
                onFiltersChange={applyCatalogFilters}
              />
            </View>
            <CatalogCollectionPillNav
              value={catalogFilters.collection}
              onChange={(collection) =>
                applyCatalogFilters({ ...catalogFilters, collection })
              }
            />
          </View>
        ) : null}

        {filterActive && !isMobile ? (
          <CatalogActiveFilterChips
            filters={catalogFilters}
            onFiltersChange={applyCatalogFilters}
          />
        ) : null}

        {contextLine ? (
          <Text className="text-[12px] text-muted-foreground">{contextLine}</Text>
        ) : null}
      </View>

      <View className="relative min-h-0 flex-1">
        <FlashList
          data={displayCards}
          key={`${section}-${numColumns}-${readOnly ? 'browse' : 'add'}`}
          keyExtractor={(item) => item.variantNumber}
          numColumns={numColumns}
          renderItem={renderItem}
          extraData={membershipRevision}
          ListEmptyComponent={showBlockingLoader ? null : emptyState}
          ListFooterComponent={
            <>
              {!readOnly && catalog.isFetchingNextPage ? (
                <View className="items-center py-4">
                  <AppLoader size="sm" />
                </View>
              ) : null}
              <ListBottomSpacer height={paddingBottom} />
            </>
          }
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={requestNextPage}
          onEndReachedThreshold={CATALOG_END_REACHED_THRESHOLD}
          drawDistance={drawDistance}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: displayCards.length === 0 ? 1 : undefined,
          }}
          keyboardShouldPersistTaps="handled"
          style={listStyle}
        />

        {showBlockingLoader ? (
          <View className="absolute inset-0 items-center justify-center">
            <AppLoader size="md" />
          </View>
        ) : null}
      </View>

      {!readOnly ? (
        <CatalogFilterSheet
          visible={filterSheetOpen}
          filters={catalogFilters}
          onClose={() => setFilterSheetOpen(false)}
          onFiltersChange={applyCatalogFilters}
        />
      ) : null}
    </View>
  );
}
