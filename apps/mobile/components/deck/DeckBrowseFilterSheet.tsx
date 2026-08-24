import { SlidersHorizontalIcon } from '@/components/icons';
import { useCallback, useMemo } from 'react';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Pressable, View } from 'react-native';
import {
  CatalogToolbarBadgeDot,
  CatalogToolbarButton,
} from '@/components/catalog/CatalogToolbarButton';
import { DeckBrowseFilterSegmentPanel } from '@/components/deck/DeckBrowseFilterPanels';
import {
  FilterAccordionGroup,
  FilterAccordionSection,
  MobileFilterSheet,
} from '@/components/filters/MobileFilterSheet';
import { FilterKeywordChip } from '@/components/riftbound/RiftboundBadges';
import { Text } from '@/components/ui/text';
import {
  buildDeckBrowseFilterChips,
  countDeckBrowseFilters,
  deckBrowseFiltersActive,
  DEFAULT_DECK_BROWSE_FILTERS,
  type DeckBrowseFilterChipDescriptor,
  type DeckBrowseFilters,
} from '@/constants/deckBrowse';
import { useDeckBrowseFilterOptions } from '@/hooks/useDeckBrowseFilters';
import {
  DECK_BROWSE_FILTER_SEGMENTS,
  deckBrowseFilterSegmentActive,
  deckBrowseFilterSegmentSummary,
} from '@/lib/deck-browse';
import { mapFilter } from '@/lib/iteration';

interface DeckBrowseFilterSheetProps {
  visible: boolean;
  filters: DeckBrowseFilters;
  onClose: () => void;
  onFiltersChange: (filters: DeckBrowseFilters) => void;
}

function defaultOpenSegments(filters: DeckBrowseFilters): string[] {
  const active = mapFilter(
    DECK_BROWSE_FILTER_SEGMENTS,
    (segment) => deckBrowseFilterSegmentActive(segment.id, filters),
    (segment) => segment.id
  );

  if (active.length > 0) return active;
  return ['legends'];
}

export function DeckBrowseFilterSheet({
  visible,
  filters,
  onClose,
  onFiltersChange,
}: DeckBrowseFilterSheetProps) {
  const activeCount = countDeckBrowseFilters(filters);
  const { setNameByCode } = useDeckBrowseFilterOptions();
  const accordionKey = visible ? 'open' : 'closed';
  const defaultOpen = useMemo(
    () => defaultOpenSegments(filters),
    [filters, accordionKey]
  );

  return (
    <MobileFilterSheet
      visible={visible}
      onClose={onClose}
      activeCount={activeCount}
      hasActiveFilters={deckBrowseFiltersActive(filters)}
      onClear={() => onFiltersChange(DEFAULT_DECK_BROWSE_FILTERS)}
      doneLabel="Show decks"
      portalName="deck-browse-filter-sheet"
    >
      <FilterAccordionGroup key={accordionKey} defaultOpen={defaultOpen}>
        {DECK_BROWSE_FILTER_SEGMENTS.map((segment) => (
          <FilterAccordionSection
            key={segment.id}
            value={segment.id}
            label={segment.label}
            summary={deckBrowseFilterSegmentSummary(segment.id, filters, setNameByCode)}
            active={deckBrowseFilterSegmentActive(segment.id, filters)}
          >
            <DeckBrowseFilterSegmentPanel
              segment={segment.id}
              filters={filters}
              onFiltersChange={onFiltersChange}
              enabled={visible}
              presentation="mobile"
            />
          </FilterAccordionSection>
        ))}
      </FilterAccordionGroup>
    </MobileFilterSheet>
  );
}

export function DeckBrowseFilterTrigger({
  filters,
  onPress,
}: {
  filters: DeckBrowseFilters;
  onPress: () => void;
}) {
  const activeCount = countDeckBrowseFilters(filters);
  const active = activeCount > 0;

  return (
    <CatalogToolbarButton
      icon={SlidersHorizontalIcon}
      onPress={onPress}
      accessibilityLabel="Open filters"
      active={active}
      mobile
      label="Filters"
      badge={
        active ? (
          activeCount === 1 ? (
            <CatalogToolbarBadgeDot />
          ) : (
            <View className="size-5 items-center justify-center rounded-[3px] border border-border bg-card-panel">
              <Text className="font-mono text-[11px] font-normal text-foreground">
                {activeCount}
              </Text>
            </View>
          )
        ) : null
      }
    />
  );
}

export function DeckBrowseActiveFilterChips({
  filters,
  onFiltersChange,
}: {
  filters: DeckBrowseFilters;
  onFiltersChange: (filters: DeckBrowseFilters) => void;
}) {
  const { setNameByCode } = useDeckBrowseFilterOptions();
  const chips = useMemo(
    () => buildDeckBrowseFilterChips(filters, setNameByCode),
    [filters, setNameByCode]
  );

  const renderChip = useCallback<ListRenderItem<DeckBrowseFilterChipDescriptor>>(
    ({ item: chip }) => {
      const keywordBase =
        chip.key === 'legal'
          ? 'ACCELERATE'
          : chip.key === 'not-legal'
            ? 'ASSAULT'
            : chip.key === 'video'
              ? 'REACTION'
              : chip.key === 'guide'
                ? 'VISION'
                : chip.key === 'matchups'
                  ? 'DEATHKNELL'
                  : 'DEFAULT';

      const keywordLabel =
        chip.key === 'legal'
          ? 'LEGAL'
          : chip.key === 'not-legal'
            ? 'ILLEGAL'
            : chip.key === 'video'
              ? 'VIDEO'
              : chip.key === 'guide'
                ? 'GUIDE'
                : chip.key === 'matchups'
                  ? 'MATCHUPS'
                  : chip.label.toUpperCase();

      if (chip.key === 'legend' || chip.key === 'sets') {
        return (
          <Pressable
            className="h-9 flex-row items-center gap-1.5 rounded-[3px] border border-border bg-card-panel px-3 active:opacity-80"
            onPress={() => onFiltersChange(chip.applyClear(filters))}
            accessibilityLabel={`Clear ${chip.label} filter`}
          >
            <Text className="text-sm font-normal text-foreground">{chip.label}</Text>
            <Text className="text-muted-foreground">×</Text>
          </Pressable>
        );
      }

      return (
        <FilterKeywordChip
          label={keywordLabel}
          keywordBase={keywordBase}
          onClear={() => onFiltersChange(chip.applyClear(filters))}
        />
      );
    },
    [filters, onFiltersChange]
  );

  if (chips.length === 0) return null;

  return (
    <FlashList
      horizontal
      data={chips}
      keyExtractor={(chip) => chip.key}
      getItemType={(chip) => chip.key}
      renderItem={renderChip}
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 pr-1"
    />
  );
}
