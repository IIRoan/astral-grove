import { View } from 'react-native';
import { TypeIcon } from '@/components/riftbound/CardIcons';
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

type NamedFilterOption = { id: string; name: string; count: number };

export function CatalogFilterTypesPanel({
  filters,
  compact,
  presentation,
  onUpdate,
  typeOptions,
  selectedTypes,
}: CatalogFilterSegmentCommonProps & {
  typeOptions: NamedFilterOption[];
  selectedTypes: Set<string>;
}) {
  if (presentation === 'mobile') {
    return (
      <FilterChipGrid>
        {typeOptions.map((type) => (
          <FilterOptionChip
            key={type.id}
            label={type.name}
            active={selectedTypes.has(type.name)}
            onPress={() =>
              onUpdate({ types: toggleCatalogFilterValue(filters.types, type.name) })
            }
            leading={<TypeIcon type={type.name} size={16} tone="foreground" />}
          />
        ))}
      </FilterChipGrid>
    );
  }

  return (
    <View className="gap-0.5">
      {typeOptions.map((type) => (
        <FilterToggleRow
          key={type.id}
          label={type.name}
          subtitle={`${type.count.toLocaleString()} cards`}
          active={selectedTypes.has(type.name)}
          onPress={() =>
            onUpdate({ types: toggleCatalogFilterValue(filters.types, type.name) })
          }
          leading={<TypeIcon type={type.name} size={20} tone="foreground" />}
          compact={compact}
        />
      ))}
    </View>
  );
}

export function CatalogFilterNamedChipPanel({
  filters,
  compact,
  presentation,
  onUpdate,
  options,
  selected,
  filterKey,
  emptyMessage,
  listSubtitle,
}: CatalogFilterSegmentCommonProps & {
  options: NamedFilterOption[];
  selected: Set<string>;
  filterKey: 'supertypes' | 'variants' | 'rarities';
  emptyMessage?: string;
  listSubtitle: (count: number) => string;
  renderLeading?: (name: string) => React.ReactNode;
}) {
  if (options.length === 0 && emptyMessage) {
    return (
      <Text className="py-6 text-center text-sm text-archive-subtle">
        {emptyMessage}
      </Text>
    );
  }

  const values = filters[filterKey];

  if (presentation === 'mobile') {
    return (
      <FilterChipGrid>
        {options.map((entry) => (
          <FilterOptionChip
            key={entry.id}
            label={entry.name}
            active={selected.has(entry.name)}
            onPress={() =>
              onUpdate({ [filterKey]: toggleCatalogFilterValue(values, entry.name) })
            }
          />
        ))}
      </FilterChipGrid>
    );
  }

  return (
    <View className="gap-0.5">
      {options.map((entry) => (
        <FilterToggleRow
          key={entry.id}
          label={entry.name}
          subtitle={listSubtitle(entry.count)}
          active={selected.has(entry.name)}
          onPress={() =>
            onUpdate({ [filterKey]: toggleCatalogFilterValue(values, entry.name) })
          }
          compact={compact}
        />
      ))}
    </View>
  );
}
