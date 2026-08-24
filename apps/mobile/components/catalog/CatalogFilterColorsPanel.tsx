import { View } from 'react-native';
import { DomainIcon } from '@/components/riftbound/CardIcons';
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

type ColorOption = {
  id: string;
  name: string;
  count: number;
  imageUrl?: string;
};

export function CatalogFilterColorsPanel({
  filters,
  compact,
  presentation,
  onUpdate,
  colorOptions,
  selectedColors,
}: CatalogFilterSegmentCommonProps & {
  colorOptions: ColorOption[];
  selectedColors: Set<string>;
}) {
  if (colorOptions.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-archive-subtle">
        No color filters available.
      </Text>
    );
  }

  if (presentation === 'mobile') {
    return (
      <FilterChipGrid>
        {colorOptions.map((color) => (
          <FilterOptionChip
            key={color.id}
            label={color.name}
            active={selectedColors.has(color.name)}
            onPress={() =>
              onUpdate({ colors: toggleCatalogFilterValue(filters.colors, color.name) })
            }
            leading={
              <DomainIcon name={color.name} imageUrl={color.imageUrl} size={18} />
            }
          />
        ))}
      </FilterChipGrid>
    );
  }

  return (
    <View className="gap-0.5">
      {colorOptions.map((color) => (
        <FilterToggleRow
          key={color.id}
          label={color.name}
          subtitle={`${color.count.toLocaleString()} cards`}
          active={selectedColors.has(color.name)}
          onPress={() =>
            onUpdate({ colors: toggleCatalogFilterValue(filters.colors, color.name) })
          }
          leading={<DomainIcon name={color.name} imageUrl={color.imageUrl} size={20} />}
          compact={compact}
        />
      ))}
    </View>
  );
}
