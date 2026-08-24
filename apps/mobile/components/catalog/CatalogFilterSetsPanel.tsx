import { View } from 'react-native';
import {
  FilterChipGrid,
  FilterOptionChip,
} from '@/components/filters/MobileFilterSheet';
import { FilterToggleRow } from '@/components/filters/FilterPrimitives';
import { Text } from '@/components/ui/text';
import {
  toggleCatalogFilterValue,
  type CatalogFilterSegmentCommonProps,
} from '@/components/catalog/catalogFilterPanels.shared';

type SetOption = {
  code: string;
  name: string;
  count: number;
};

export function CatalogFilterSetsPanel({
  filters,
  compact,
  presentation,
  onUpdate,
  setOptions,
  selectedSets,
}: CatalogFilterSegmentCommonProps & {
  setOptions: SetOption[];
  selectedSets: Set<string>;
}) {
  if (setOptions.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-archive-subtle">
        No set filters available.
      </Text>
    );
  }

  if (presentation === 'mobile') {
    return (
      <FilterChipGrid>
        {setOptions.map((set) => (
          <FilterOptionChip
            key={set.code}
            label={set.code}
            active={selectedSets.has(set.code)}
            onPress={() =>
              onUpdate({ sets: toggleCatalogFilterValue(filters.sets, set.code) })
            }
            accessibilityLabel={`${set.name} (${set.code})`}
          />
        ))}
      </FilterChipGrid>
    );
  }

  return (
    <View className="gap-0.5">
      {setOptions.map((set) => (
        <FilterToggleRow
          key={set.code}
          label={set.name}
          subtitle={`${set.code} · ${set.count.toLocaleString()} printings`}
          active={selectedSets.has(set.code)}
          onPress={() =>
            onUpdate({ sets: toggleCatalogFilterValue(filters.sets, set.code) })
          }
          compact={compact}
        />
      ))}
    </View>
  );
}
