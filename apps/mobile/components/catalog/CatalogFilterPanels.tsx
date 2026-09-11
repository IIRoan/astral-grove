import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { AppLoader } from '@/components/ui/app-loader';
import { RarityIcon } from '@/components/riftbound/CardIcons';
import {
  FilterChipGrid,
  FilterOptionChip,
} from '@/components/filters/MobileFilterSheet';
import { FilterToggleRow } from '@/components/filters/FilterPrimitives';
import { Text } from '@/components/ui/text';
import { CatalogFilterCollectionPanel } from '@/components/catalog/CatalogFilterCollectionPanel';
import { CatalogFilterColorsPanel } from '@/components/catalog/CatalogFilterColorsPanel';
import { CatalogFilterSetsPanel } from '@/components/catalog/CatalogFilterSetsPanel';
import { CatalogFilterStatsPanel } from '@/components/catalog/CatalogFilterStatsPanel';
import {
  CatalogFilterNamedChipPanel,
  CatalogFilterTypesPanel,
} from '@/components/catalog/CatalogFilterTypesPanel';
import {
  toggleCatalogFilterValue,
  type CatalogFilterPresentation,
  type CatalogFilterUpdate,
} from '@/components/catalog/catalogFilterPanels.shared';
import {
  isCatalogBrowsableType,
  sanitizeCatalogFilters,
  type CatalogFilterSegment,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import {
  filtersQueryUiState,
  prefetchCatalogFilters,
  useFiltersData,
} from '@/hooks/useFiltersData';
import { mapFilter, toMembershipSet } from '@/lib/iteration';

export function useCatalogFilterOptions() {
  const queryClient = useQueryClient();
  const filtersQuery = useFiltersData();

  useEffect(() => {
    void prefetchCatalogFilters(queryClient);
  }, [queryClient]);

  const snapshot = filtersQuery.data;
  const { isLoading, isError } = filtersQueryUiState(filtersQuery);

  const colorOptions = useMemo(
    () =>
      (snapshot?.colors ?? []).map((entry) => ({
        id: entry.id,
        name: entry.name,
        count: entry.count,
        imageUrl: entry.imageUrl,
      })),
    [snapshot?.colors]
  );

  const setOptions = useMemo(
    () =>
      mapFilter(
        snapshot?.sets ?? [],
        (entry) => (entry.printCount ?? entry.count) > 0,
        (entry) => ({
          code: entry.code ?? entry.id.toUpperCase(),
          name: entry.name,
          count: entry.printCount ?? entry.count,
        })
      ),
    [snapshot?.sets]
  );

  const typeOptions = useMemo(
    () => (snapshot?.types ?? []).filter((entry) => isCatalogBrowsableType(entry.name)),
    [snapshot?.types]
  );

  return {
    isLoading,
    isError,
    refetch: filtersQuery.refetch,
    colorOptions,
    setOptions,
    typeOptions,
    supertypeOptions: snapshot?.supertypes ?? [],
    variantOptions: snapshot?.variants ?? [],
    rarityOptions: snapshot?.rarities ?? [],
  };
}

interface CatalogFilterSegmentPanelProps {
  segment: CatalogFilterSegment;
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  compact?: boolean;
  presentation?: CatalogFilterPresentation;
}

export function CatalogFilterSegmentPanel({
  segment,
  filters,
  onFiltersChange,
  compact = false,
  presentation = 'list',
}: CatalogFilterSegmentPanelProps) {
  const {
    isLoading,
    isError,
    refetch,
    colorOptions,
    setOptions,
    typeOptions,
    supertypeOptions,
    variantOptions,
    rarityOptions,
  } = useCatalogFilterOptions();

  const selectedColors = useMemo(
    () => toMembershipSet(filters.colors),
    [filters.colors]
  );
  const selectedSets = useMemo(() => toMembershipSet(filters.sets), [filters.sets]);
  const selectedTypes = useMemo(() => toMembershipSet(filters.types), [filters.types]);
  const selectedSupertypes = useMemo(
    () => toMembershipSet(filters.supertypes),
    [filters.supertypes]
  );
  const selectedVariants = useMemo(
    () => toMembershipSet(filters.variants),
    [filters.variants]
  );
  const selectedRarities = useMemo(
    () => toMembershipSet(filters.rarities),
    [filters.rarities]
  );

  const update = (patch: CatalogFilterUpdate) => {
    const next = typeof patch === 'function' ? patch(filters) : { ...filters, ...patch };
    onFiltersChange(sanitizeCatalogFilters(next));
  };

  const commonProps = {
    filters,
    compact,
    presentation,
    onUpdate: update,
  };

  if (isLoading) {
    return (
      <View className="items-center py-8">
        <AppLoader size="md" />
        <Text className="mt-3 text-sm text-archive-subtle">
          Loading filter options…
        </Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View className="items-center gap-3 py-8">
        <Text className="text-center text-sm text-archive-subtle">
          Could not load filter options.
        </Text>
        <Text
          className="text-sm font-normal text-foreground"
          accessibilityRole="button"
          onPress={() => void refetch()}
        >
          Retry
        </Text>
      </View>
    );
  }

  switch (segment) {
    case 'collection':
      return <CatalogFilterCollectionPanel {...commonProps} />;

    case 'colors':
      return (
        <CatalogFilterColorsPanel
          {...commonProps}
          colorOptions={colorOptions}
          selectedColors={selectedColors}
        />
      );

    case 'sets':
      return (
        <CatalogFilterSetsPanel
          {...commonProps}
          setOptions={setOptions}
          selectedSets={selectedSets}
        />
      );

    case 'types':
      return (
        <CatalogFilterTypesPanel
          {...commonProps}
          typeOptions={typeOptions}
          selectedTypes={selectedTypes}
        />
      );

    case 'supertypes':
      return (
        <CatalogFilterNamedChipPanel
          {...commonProps}
          options={supertypeOptions}
          selected={selectedSupertypes}
          filterKey="supertypes"
          emptyMessage="No supertype filters available."
          listSubtitle={(count) => `${count.toLocaleString()} cards`}
        />
      );

    case 'variants':
      return (
        <CatalogFilterNamedChipPanel
          {...commonProps}
          options={variantOptions}
          selected={selectedVariants}
          filterKey="variants"
          listSubtitle={(count) => `${count.toLocaleString()} printings`}
        />
      );

    case 'rarities':
      if (presentation === 'mobile') {
        return (
          <FilterChipGrid>
            {rarityOptions.map((entry) => (
              <FilterOptionChip
                key={entry.id}
                label={entry.name}
                active={selectedRarities.has(entry.name)}
                onPress={() =>
                  update({
                    rarities: toggleCatalogFilterValue(filters.rarities, entry.name),
                  })
                }
                leading={<RarityIcon rarity={entry.name} size={16} />}
              />
            ))}
          </FilterChipGrid>
        );
      }
      return (
        <View className="gap-0.5">
          {rarityOptions.map((entry) => (
            <FilterToggleRow
              key={entry.id}
              label={entry.name}
              subtitle={`${entry.count.toLocaleString()} printings`}
              active={selectedRarities.has(entry.name)}
              onPress={() =>
                update({
                  rarities: toggleCatalogFilterValue(filters.rarities, entry.name),
                })
              }
              leading={<RarityIcon rarity={entry.name} size={18} />}
              compact={compact}
            />
          ))}
        </View>
      );

    case 'stats':
      return <CatalogFilterStatsPanel {...commonProps} />;

    default:
      return null;
  }
}
