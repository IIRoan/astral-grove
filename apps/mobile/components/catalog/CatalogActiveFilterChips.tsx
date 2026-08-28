import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { CatalogActiveFilterChip } from '@/components/catalog/CatalogActiveFilterChip';
import { useCatalogFilterOptions } from '@/components/catalog/CatalogFilterPanels';
import {
  catalogFilterChips,
  catalogFiltersActive,
  type CatalogFilterChip,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import { CATALOG_TOOLBAR_DESKTOP_CHIP_TRAY_CLASS } from '@/constants/catalogToolbar';

interface CatalogActiveFilterChipsProps {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
}

export function CatalogActiveFilterChips({
  filters,
  onFiltersChange,
}: CatalogActiveFilterChipsProps) {
  const { colorOptions } = useCatalogFilterOptions();
  const colorByName = useMemo(
    () => new Map(colorOptions.map((color) => [color.name, color])),
    [colorOptions]
  );
  const chips = useMemo(
    () => (catalogFiltersActive(filters) ? catalogFilterChips(filters) : []),
    [filters]
  );

  const chipProps = useCallback(
    (chip: CatalogFilterChip) => ({
      chip,
      colorImageByName: colorByName,
      onClear: () => onFiltersChange(chip.clear()),
      onRemoveColor: (name: string) =>
        onFiltersChange({
          ...filters,
          colors: filters.colors.filter((color) => color !== name),
        }),
    }),
    [colorByName, filters, onFiltersChange]
  );

  if (chips.length === 0) return null;

  return (
    <View className={CATALOG_TOOLBAR_DESKTOP_CHIP_TRAY_CLASS}>
      {chips.map((chip) => (
        <CatalogActiveFilterChip key={chip.id} {...chipProps(chip)} />
      ))}
    </View>
  );
}
