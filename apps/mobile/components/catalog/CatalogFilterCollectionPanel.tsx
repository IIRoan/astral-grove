import { View } from 'react-native';
import { FilterToggleRow } from '@/components/filters/FilterPrimitives';
import type { CatalogFilterSegmentCommonProps } from '@/components/catalog/catalogFilterPanels.shared';

export function CatalogFilterCollectionPanel({
  filters,
  compact,
  onUpdate,
}: CatalogFilterSegmentCommonProps) {
  return (
    <View className="gap-0.5">
      <FilterToggleRow
        label="All cards"
        subtitle="No collection filter"
        active={filters.collection === 'all' || filters.collection === 'missing'}
        onPress={() => onUpdate({ collection: 'all' })}
        compact={compact}
      />
      <FilterToggleRow
        label="Owned"
        subtitle="Cards in your collection"
        active={filters.collection === 'owned'}
        onPress={() =>
          onUpdate({
            collection: filters.collection === 'owned' ? 'all' : 'owned',
          })
        }
        compact={compact}
      />
    </View>
  );
}
