import { LightningIcon, SlidersHorizontalIcon, ThemedIcon } from '@/components/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
  CatalogToolbarBadgeDot,
  CatalogToolbarButton,
} from '@/components/catalog/CatalogToolbarButton';
import { CatalogFilterSegmentPanel } from '@/components/catalog/CatalogFilterPanels';
import { FilterToggleRow } from '@/components/filters/FilterPrimitives';
import {
  FilterAccordionGroup,
  FilterAccordionSection,
  MobileFilterSheet,
} from '@/components/filters/MobileFilterSheet';
import { Text } from '@/components/ui/text';
import {
  CATALOG_FILTER_SEGMENTS,
  catalogFilterSegmentActive,
  catalogFilterSegmentSummary,
  catalogFiltersActive,
  catalogFiltersHaveClearableExtras,
  clearCatalogFilters,
  countCatalogFilters,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { prefetchCatalogFilters } from '@/hooks/useFiltersData';
import { mapFilter } from '@/lib/iteration';
import { cn } from '@/lib/utils';

export { CatalogActiveFilterChips } from '@/components/catalog/CatalogActiveFilterChips';

interface CatalogFilterSheetProps {
  visible: boolean;
  filters: CatalogFilters;
  onClose: () => void;
  onFiltersChange: (filters: CatalogFilters) => void;
  preserveColorsAndTokens?: boolean;
}

const MOBILE_FILTER_SEGMENTS = CATALOG_FILTER_SEGMENTS;

function defaultOpenSegments(filters: CatalogFilters): string[] {
  const active = mapFilter(
    MOBILE_FILTER_SEGMENTS,
    (segment) => catalogFilterSegmentActive(segment.id, filters),
    (segment) => segment.id
  );

  if (active.length > 0) return active;
  return ['collection'];
}

export function CatalogFilterSheet({
  visible,
  filters,
  onClose,
  onFiltersChange,
  preserveColorsAndTokens = false,
}: CatalogFilterSheetProps) {
  const queryClient = useQueryClient();
  const activeCount = countCatalogFilters(filters);
  const accordionKey = visible ? 'open' : 'closed';
  const defaultOpen = useMemo(
    () => defaultOpenSegments(filters),
    [filters, accordionKey]
  );

  useEffect(() => {
    if (!visible) return;
    void prefetchCatalogFilters(queryClient);
  }, [visible, queryClient]);

  return (
    <MobileFilterSheet
      visible={visible}
      onClose={onClose}
      activeCount={activeCount}
      hasActiveFilters={catalogFiltersActive(filters)}
      showClear={catalogFiltersHaveClearableExtras(filters, {
        preserveColorsAndTokens,
      })}
      onClear={() =>
        onFiltersChange(clearCatalogFilters(filters, { preserveColorsAndTokens }))
      }
      portalName="catalog-filter-sheet"
      stickyHeader={
        <FilterToggleRow
          label="Quick add"
          subtitle="Skip foil choice and add the standard printing"
          active={filters.simpleAdd}
          compact
          leading={
            <ThemedIcon
              icon={LightningIcon}
              size={16}
              color={filters.simpleAdd ? 'foreground' : 'muted-foreground'}
            />
          }
          onPress={() =>
            onFiltersChange({ ...filters, simpleAdd: !filters.simpleAdd })
          }
        />
      }
    >
      <FilterAccordionGroup key={accordionKey} defaultOpen={defaultOpen}>
        {MOBILE_FILTER_SEGMENTS.map((segment) => (
          <FilterAccordionSection
            key={segment.id}
            value={segment.id}
            label={segment.label}
            summary={catalogFilterSegmentSummary(segment.id, filters)}
            active={catalogFilterSegmentActive(segment.id, filters)}
          >
            <CatalogFilterSegmentPanel
              segment={segment.id}
              filters={filters}
              onFiltersChange={onFiltersChange}
              presentation="mobile"
            />
          </FilterAccordionSection>
        ))}
      </FilterAccordionGroup>
    </MobileFilterSheet>
  );
}

export function CatalogFilterTrigger({
  filters,
  onPress,
  compact = false,
  mobile = false,
}: {
  filters: CatalogFilters;
  onPress: () => void;
  compact?: boolean;
  mobile?: boolean;
}) {
  const activeCount = countCatalogFilters(filters);
  const filterActive = activeCount > 0;

  return (
    <CatalogToolbarButton
      icon={SlidersHorizontalIcon}
      onPress={onPress}
      accessibilityLabel="Open filters"
      active={filterActive}
      mobile={mobile}
      label={compact ? undefined : 'Filters'}
      badge={
        filterActive ? (
          activeCount === 1 ? (
            <CatalogToolbarBadgeDot />
          ) : (
            <View
              className={cn(
                'size-5 items-center justify-center border border-border bg-card-panel',
                FACTORY_RADIUS_CONTROL_CLASS,
                // Icon-only buttons center children in a column — pin the count to the corner.
                compact && 'absolute -right-1.5 -top-1.5'
              )}
            >
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
