import { View } from 'react-native';
import {
  FilterChipGrid,
  FilterOptionChip,
} from '@/components/filters/MobileFilterSheet';
import { FilterStatChip, FilterToggleRow } from '@/components/filters/FilterPrimitives';
import { Text } from '@/components/ui/text';
import {
  toggleCatalogStatFilter,
  type CatalogFilterSegmentCommonProps,
  type CatalogStatFilterKey,
} from '@/components/catalog/catalogFilterPanels.shared';
import {
  CATALOG_ENERGY_VALUES,
  CATALOG_MIGHT_VALUES,
  CATALOG_POWER_VALUES,
} from '@/constants/catalogFilters';

function StatChipRow({
  label,
  values,
  statKey,
  selected,
  onUpdate,
}: {
  label: string;
  values: readonly number[];
  statKey: CatalogStatFilterKey;
  selected: number | undefined;
  onUpdate: CatalogFilterSegmentCommonProps['onUpdate'];
}) {
  return (
    <View>
      <Text className="mb-2 font-mono text-[12px] font-normal uppercase tracking-[-0.24px] text-muted-foreground">
        {label}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {values.map((value) => (
          <FilterStatChip
            key={`${statKey}-${value}`}
            label={String(value)}
            active={selected === value}
            onPress={() => onUpdate((current) => toggleCatalogStatFilter(current, statKey, value))}
          />
        ))}
      </View>
    </View>
  );
}

export function CatalogFilterStatsPanel({
  filters,
  compact,
  presentation,
  onUpdate,
}: CatalogFilterSegmentCommonProps) {
  return (
    <View className="gap-4">
      <StatChipRow
        label="Energy"
        values={CATALOG_ENERGY_VALUES}
        statKey="energy"
        selected={filters.energy}
        onUpdate={onUpdate}
      />
      <StatChipRow
        label="Power"
        values={CATALOG_POWER_VALUES}
        statKey="power"
        selected={filters.power}
        onUpdate={onUpdate}
      />
      <StatChipRow
        label="Might"
        values={CATALOG_MIGHT_VALUES}
        statKey="might"
        selected={filters.might}
        onUpdate={onUpdate}
      />
      {presentation === 'mobile' ? (
        <FilterChipGrid>
          <FilterOptionChip
            label="Hide tokens"
            active={filters.excludeTokens}
            onPress={() => onUpdate({ excludeTokens: !filters.excludeTokens })}
          />
          <FilterOptionChip
            label="Tokens only"
            active={filters.tokensOnly}
            onPress={() => onUpdate({ tokensOnly: !filters.tokensOnly })}
          />
        </FilterChipGrid>
      ) : (
        <>
          <FilterToggleRow
            label="Hide tokens"
            subtitle="Remove token markers from results"
            active={filters.excludeTokens}
            onPress={() => onUpdate({ excludeTokens: !filters.excludeTokens })}
            compact={compact}
          />
          <FilterToggleRow
            label="Tokens only"
            subtitle="Show only token markers (Buff, XP Tracker, etc.)"
            active={filters.tokensOnly}
            onPress={() => onUpdate({ tokensOnly: !filters.tokensOnly })}
            compact={compact}
          />
        </>
      )}
    </View>
  );
}
