import { ThemedIcon, LibraryIcon } from '@/components/icons';
import { DeckCatalogGridTile } from '@/components/deck/DeckCatalogGridTile';
import { DeckAddScreenHeader } from '@/components/deck/DeckAddScreenHeader';
import {
  CatalogActiveFilterChips,
  CatalogFilterSheet,
  CatalogFilterTrigger,
} from '@/components/catalog/FilterSheet';
import { CatalogDesktopFilterBar } from '@/components/catalog/CatalogDesktopFilterBar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppLoader, AppLoadingScreen } from '@/components/ui/app-loader';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { memo, useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { SearchInput } from '@/components/ui/search-input';
import { ScreenLayout } from '@/components/shell/ScreenLayout';
import { Text } from '@/components/ui/text';
import {
  DECK_SECTIONS,
  type DeckCard,
  type DeckSectionKey,
  type DeckState,
} from '@/lib/deck-types';
import { DeckSectionTabs } from '@/components/deck/DeckSectionList';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useScreenLayout } from '@/components/shell/ScreenLayout';
import { useResponsiveColumns } from '@/hooks/useResponsiveColumns';
import { useCatalogArtLookahead } from '@/hooks/useCatalogArtLookahead';
import { useDeckAddCatalog } from '@/hooks/useDeckAddCatalog';
import { useDeckAutoSave } from '@/hooks/useDeckAutoSave';
import { useDeckDetail } from '@/hooks/useDeckDetail';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import {
  defaultDeckAddCatalogFilters,
  defaultDeckAddSearch,
} from '@/lib/deck-add-catalog';
import { CATALOG_END_REACHED_THRESHOLD } from '@/lib/catalog-page-size';
import {
  catalogFiltersActive,
  sanitizeCatalogFilters,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import { addCardToDeck, changeDeckCardQty, removeDeckCard } from '@/lib/deck-card';
import { leaveDeckAddScreen } from '@/lib/deck-navigation';
import { isCardEligibleForSection } from '@/lib/deck-eligibility';
import { battlefieldsAtCapacity } from '@/lib/deck-limits';
import {
  deckAddUsesSingleSelectUi,
  deckMembershipRevision,
  getDeckCandidateCount,
} from '@/lib/deck-membership';
import { useDebounce } from '@/hooks/useDebounce';
import { openCard } from '@/utils/cardNavigation';
import { cn } from '@/lib/utils';

function normalizeSectionParam(value: string | undefined): DeckSectionKey {
  if (!value) return 'mainDeck';
  const found = DECK_SECTIONS.find((s) => s.key === value);
  return found?.key ?? 'mainDeck';
}

const AddOneTile = memo(function AddOneTile({
  tileWidth,
  candidate,
  count,
  onAdd,
  onRemove,
  onOpenCard,
  showSelected,
  selected,
  blocked,
  blockedLabel = 'Slots full',
  horizontal = false,
}: {
  tileWidth: number;
  candidate: DeckCard;
  count: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpenCard: () => void;
  showSelected: boolean;
  selected: boolean;
  blocked?: boolean;
  blockedLabel?: string;
  horizontal?: boolean;
}) {
  const canAdd = !blocked && !(showSelected && selected);

  return (
    <DeckCatalogGridTile
      tileWidth={tileWidth}
      candidate={candidate}
      count={count}
      blocked={blocked}
      blockedLabel={blockedLabel}
      selected={selected}
      horizontal={horizontal}
      canAdd={canAdd}
      canRemove={count > 0}
      onAdd={onAdd}
      onRemove={onRemove}
      onOpenCard={onOpenCard}
    />
  );
});

const DeckAddGridRow = memo(function DeckAddGridRow({
  item,
  deck,
  activeSection,
  tileWidth,
  gridCellStyle,
  isBattlefieldSection,
  sectionFull,
  usesSingleSelectUi,
  onAddOne,
  onRemoveOne,
  onOpenCard,
}: {
  item: DeckCard;
  deck: DeckState;
  activeSection: DeckSectionKey;
  tileWidth: number;
  gridCellStyle: { paddingHorizontal: number; marginBottom: number };
  isBattlefieldSection: boolean;
  sectionFull: boolean;
  usesSingleSelectUi: boolean;
  onAddOne: (candidate: DeckCard) => void;
  onRemoveOne: (candidate: DeckCard) => void;
  onOpenCard: (variantNumber: string) => void;
}) {
  const count = getDeckCandidateCount(deck, activeSection, item);
  const inDeck = count > 0;
  const selected = usesSingleSelectUi && inDeck;
  const eligibility = isCardEligibleForSection({
    deck,
    section: activeSection,
    candidateCard: item,
  });
  const blocked = !eligibility.eligible && !selected;
  const blockedLabel =
    activeSection === 'battlefields' && sectionFull && !inDeck
      ? 'Slots full'
      : eligibility.reason?.includes('copy')
        ? 'Max copies'
        : 'Unavailable';
  const handleAdd = useCallback(() => onAddOne(item), [onAddOne, item]);
  const handleRemove = useCallback(() => onRemoveOne(item), [onRemoveOne, item]);
  const handleOpen = useCallback(
    () => onOpenCard(item.variantNumber),
    [onOpenCard, item.variantNumber]
  );

  return (
    <View style={gridCellStyle} collapsable={false}>
      <AddOneTile
        tileWidth={tileWidth}
        candidate={item}
        count={count}
        selected={selected}
        showSelected={usesSingleSelectUi}
        blocked={blocked}
        blockedLabel={blockedLabel}
        horizontal={isBattlefieldSection}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onOpenCard={handleOpen}
      />
    </View>
  );
});

export default function DeckAddScreen() {
  const { id, section: sectionParam } = useLocalSearchParams<{
    id: string;
    section?: string;
  }>();
  const { deck, isLoading, persist, flushSave } = useDeckDetail(id);

  if (isLoading || !deck) {
    return (
      <ScreenLayout mode="flex">
        <AppLoadingScreen size="md" className="bg-transparent" />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout mode="flex" contentClassName="min-h-0 flex-1">
      <DeckAddScreenBody
        deckId={id}
        deck={deck}
        sectionParam={sectionParam}
        onPersist={persist}
        onFlushSave={flushSave}
      />
    </ScreenLayout>
  );
}

function DeckAddScreenBody({
  deckId,
  deck,
  sectionParam,
  onPersist,
  onFlushSave,
}: {
  deckId: string;
  deck: DeckState;
  sectionParam?: string;
  onPersist: (
    deck: DeckState | ((previous: DeckState) => DeckState),
    options?: { immediate?: boolean }
  ) => void;
  onFlushSave: () => Promise<DeckState | null>;
}) {
  const router = useRouter();
  const section = normalizeSectionParam(sectionParam);
  const lockedSection = Boolean(sectionParam);
  const [tabSection, setTabSection] = useState<DeckSectionKey>(section);
  const activeSection = lockedSection ? section : tabSection;

  useDeckAutoSave(deck);

  const handleBack = useCallback(async () => {
    try {
      await onFlushSave();
    } finally {
      leaveDeckAddScreen(router, deckId);
    }
  }, [deckId, onFlushSave, router]);

  return (
    <View className="min-h-0 flex-1">
      <View className="shrink-0 pb-2">
        <DeckAddScreenHeader
          deck={deck}
          section={activeSection}
          onBack={() => void handleBack()}
        />
      </View>
      <View className="min-h-0 flex-1">
        <DeckAddCatalogWorkspace
          deck={deck}
          activeSection={activeSection}
          lockedSection={lockedSection}
          onSectionChange={setTabSection}
          onPersist={onPersist}
        />
      </View>
    </View>
  );
}

function DeckAddCatalogWorkspace(props: {
  deck: DeckState;
  activeSection: DeckSectionKey;
  lockedSection: boolean;
  onSectionChange: (section: DeckSectionKey) => void;
  onPersist: (
    deck: DeckState | ((previous: DeckState) => DeckState),
    options?: { immediate?: boolean }
  ) => void;
}) {
  return <DeckAddCatalogBrowse key={props.activeSection} {...props} />;
}

function DeckAddCatalogBrowse({
  deck,
  activeSection,
  lockedSection,
  onSectionChange,
  onPersist,
}: {
  deck: DeckState;
  activeSection: DeckSectionKey;
  lockedSection: boolean;
  onSectionChange: (section: DeckSectionKey) => void;
  onPersist: (
    deck: DeckState | ((previous: DeckState) => DeckState),
    options?: { immediate?: boolean }
  ) => void;
}) {
  const router = useRouter();
  const isMobile = useMobileLayout();
  const legendKey = deck.legend?.variantNumber ?? '';
  const { paddingBottomInline, contentWidth } = useScreenLayout();
  const grid = useResponsiveColumns('grid', {
    measuredWidth: contentWidth,
  });
  const isBattlefieldSection = activeSection === 'battlefields';
  /** Wider tiles so landscape battlefield art matches the builder slots. */
  const { tileWidth, gap, numColumns } = useMemo(() => {
    if (!isBattlefieldSection) return grid;
    const columns = Math.max(2, Math.min(isMobile ? 2 : 4, grid.numColumns));
    const width = (contentWidth - grid.gap * (columns - 1)) / columns;
    return {
      numColumns: columns,
      tileWidth: Math.max(120, width),
      gap: grid.gap,
    };
  }, [contentWidth, grid, isBattlefieldSection, isMobile]);

  const [query, setQuery] = useState(() => defaultDeckAddSearch(activeSection, deck));
  const debouncedQuery = useDebounce(query.trim(), 300);

  const [catalogFilters, setCatalogFilters] = useState<CatalogFilters>(() =>
    defaultDeckAddCatalogFilters(activeSection, deck)
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const applyCatalogFilters = useCallback((next: CatalogFilters) => {
    setCatalogFilters(sanitizeCatalogFilters(next));
  }, []);

  const legendColorsKey = deck.legend?.colors
    ? [...deck.legend.colors].sort().join('\0')
    : '';
  const filterDeckKey = `${deck.format}:${legendKey}:${legendColorsKey}`;
  const [prevFilterDeckKey, setPrevFilterDeckKey] = useState(filterDeckKey);
  if (filterDeckKey !== prevFilterDeckKey) {
    setPrevFilterDeckKey(filterDeckKey);
    setCatalogFilters(defaultDeckAddCatalogFilters(activeSection, deck));
  }

  const [prevChampionLegendKey, setPrevChampionLegendKey] = useState(legendKey);
  if (
    activeSection === 'champion' &&
    legendKey &&
    legendKey !== prevChampionLegendKey
  ) {
    setPrevChampionLegendKey(legendKey);
    setQuery(defaultDeckAddSearch('champion', deck));
  }

  const catalog = useDeckAddCatalog(
    deck,
    activeSection,
    debouncedQuery,
    catalogFilters
  );

  const handleAddOne = useCallback(
    (candidate: DeckCard) => {
      const eligibility = isCardEligibleForSection({
        deck,
        section: activeSection,
        candidateCard: candidate,
      });
      if (!eligibility.eligible) return;
      onPersist((prev) => addCardToDeck(prev, candidate, { section: activeSection }), {
        immediate: true,
      });
    },
    [deck, onPersist, activeSection]
  );

  const handleRemoveOne = useCallback(
    (candidate: DeckCard) => {
      if (activeSection === 'legend' || activeSection === 'champion') {
        onPersist((prev) => removeDeckCard(prev, activeSection), { immediate: true });
        return;
      }

      const entry = getDeckCandidateCount(deck, activeSection, candidate);
      if (entry <= 0) return;

      onPersist((prev) => changeDeckCardQty(prev, activeSection, candidate.name, -1), {
        immediate: true,
      });
    },
    [activeSection, deck, onPersist]
  );

  const handleOpenCard = useCallback(
    (variantNumber: string) => {
      openCard(router, variantNumber, 'modal');
    },
    [router]
  );

  const usesSingleSelectUi = deckAddUsesSingleSelectUi(activeSection);
  const membershipRevision = deckMembershipRevision(deck);
  const sectionFull = activeSection === 'battlefields' && battlefieldsAtCapacity(deck);

  const { drawDistance, viewabilityConfig, handleViewableItemsChanged, handleScroll } =
    useCatalogArtLookahead({
      items: catalog.cards,
      numColumns,
      layout: 'grid',
      tileWidth,
    });

  const requestNextPage = useCallback(() => {
    if (catalog.hasNextPage && !catalog.isFetchingNextPage) {
      catalog.fetchNextPage();
    }
  }, [catalog]);

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
      <DeckAddGridRow
        item={item}
        deck={deck}
        activeSection={activeSection}
        tileWidth={tileWidth}
        gridCellStyle={gridCellStyle}
        isBattlefieldSection={isBattlefieldSection}
        sectionFull={sectionFull}
        usesSingleSelectUi={usesSingleSelectUi}
        onAddOne={handleAddOne}
        onRemoveOne={handleRemoveOne}
        onOpenCard={handleOpenCard}
      />
    ),
    [
      activeSection,
      deck,
      gridCellStyle,
      handleAddOne,
      handleOpenCard,
      handleRemoveOne,
      isBattlefieldSection,
      sectionFull,
      tileWidth,
      usesSingleSelectUi,
    ]
  );

  const listFooter = useMemo(
    () => (
      <>
        {catalog.isFetchingNextPage ? (
          <View className="items-center py-4">
            <AppLoader size="sm" />
          </View>
        ) : null}
        <ListBottomSpacer height={paddingBottomInline} />
      </>
    ),
    [catalog.isFetchingNextPage, paddingBottomInline]
  );

  const showBlockingLoader = catalog.isLoading && catalog.cards.length === 0;

  const emptyState = (
    <Empty className="border border-dashed border-border py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="mb-1 size-14">
          <ThemedIcon icon={LibraryIcon} size={28} color="ring" />
        </EmptyMedia>
        <EmptyTitle>{catalog.emptyState.title}</EmptyTitle>
        <EmptyDescription>{catalog.emptyState.description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  const filterActive = catalogFiltersActive(catalogFilters);

  return (
    <View className="min-h-0 flex-1">
      <View className="shrink-0 gap-1.5 pb-2">
        <View className={cn('gap-2', !isMobile && 'flex-row items-center gap-3')}>
          <View className={cn('min-w-0 flex-1', !isMobile && 'flex-1')}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder={catalog.sectionMeta.placeholder}
              autoFocus
            />
          </View>
          {isMobile ? (
            <CatalogFilterTrigger
              filters={catalogFilters}
              onPress={() => setFilterSheetOpen(true)}
              compact
              mobile
            />
          ) : null}
        </View>

        {!isMobile ? (
          <CatalogDesktopFilterBar
            filters={catalogFilters}
            onFiltersChange={applyCatalogFilters}
          />
        ) : null}

        {filterActive && !isMobile ? (
          <CatalogActiveFilterChips
            filters={catalogFilters}
            onFiltersChange={applyCatalogFilters}
            preserveColorsAndTokens
          />
        ) : null}

        {catalog.sectionMeta.contextLine ? (
          <Text className="text-[12px] text-muted-foreground">
            {catalog.sectionMeta.contextLine}
          </Text>
        ) : null}

        {!lockedSection ? (
          <DeckSectionTabs
            deck={deck}
            activeSection={activeSection}
            onSectionChange={onSectionChange}
          />
        ) : null}
      </View>

      <View className="relative min-h-0 flex-1">
        <FlashList
          data={catalog.cards}
          key={`${activeSection}-${numColumns}`}
          keyExtractor={(item) => item.variantNumber}
          numColumns={numColumns}
          renderItem={renderItem}
          extraData={membershipRevision}
          ListEmptyComponent={showBlockingLoader ? null : emptyState}
          ListFooterComponent={listFooter}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onEndReached={requestNextPage}
          onEndReachedThreshold={CATALOG_END_REACHED_THRESHOLD}
          drawDistance={drawDistance}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: catalog.cards.length === 0 ? 1 : undefined,
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

      <CatalogFilterSheet
        visible={filterSheetOpen}
        filters={catalogFilters}
        onClose={() => setFilterSheetOpen(false)}
        onFiltersChange={applyCatalogFilters}
        preserveColorsAndTokens
      />
    </View>
  );
}
