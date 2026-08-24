import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { DeckBrowseFilterSegmentPanel } from '@/components/deck/DeckBrowseFilterPanels';
import {
  FilterClearButton,
  FilterPopoverBar,
} from '@/components/filters/FilterPrimitives';
import {
  DEFAULT_DECK_BROWSE_FILTERS,
  deckBrowseFiltersActive,
  type DeckBrowseFilters,
} from '@/constants/deckBrowse';
import {
  DECK_BROWSE_FILTER_SEGMENTS,
  deckBrowseFilterSegmentActive,
  type DeckBrowseFilterSegment,
} from '@/lib/deck-browse';

interface DeckBrowseDesktopFilterBarProps {
  filters: DeckBrowseFilters;
  onFiltersChange: (filters: DeckBrowseFilters) => void;
}

export function DeckBrowseDesktopFilterBar({
  filters,
  onFiltersChange,
}: DeckBrowseDesktopFilterBarProps) {
  const [openSegment, setOpenSegment] = useState<DeckBrowseFilterSegment | null>(null);

  const segments = useMemo(
    () =>
      DECK_BROWSE_FILTER_SEGMENTS.map((segment) => ({
        id: segment.id,
        label: segment.label,
        hasValue: deckBrowseFilterSegmentActive(segment.id, filters),
        contentClassName: segment.id === 'legends' ? 'w-[300px]' : undefined,
        maxHeight: segment.id === 'legends' ? 360 : 280,
        children: (
          <DeckBrowseFilterSegmentPanel
            segment={segment.id}
            filters={filters}
            onFiltersChange={onFiltersChange}
            enabled={openSegment === segment.id}
            compact
          />
        ),
      })),
    [filters, onFiltersChange, openSegment]
  );

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <FilterPopoverBar
        portalName="deck-browse-filter-bar"
        openId={openSegment}
        onOpenIdChange={setOpenSegment}
        segments={segments}
      />

      {deckBrowseFiltersActive(filters) ? (
        <FilterClearButton
          onPress={() => onFiltersChange(DEFAULT_DECK_BROWSE_FILTERS)}
        />
      ) : null}
    </View>
  );
}
