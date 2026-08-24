import { SlidersHorizontalIcon } from '@/components/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import {
  CatalogToolbarBadgeDot,
  CatalogToolbarButton,
} from '@/components/catalog/CatalogToolbarButton';
import { CatalogFilterSegmentPanel } from '@/components/catalog/CatalogFilterPanels';
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
  countCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
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
}

const MOBILE_FILTER_SEGMENTS = CATALOG_FILTER_SEGMENTS.filter(
  (segment) => segment.id !== 'collection'
);

function defaultOpenSegments(filters: CatalogFilters): string[] {
  const active = mapFilter(
    MOBILE_FILTER_SEGMENTS,
    (segment) => catalogFilterSegmentActive(segment.id, filters),
    (segment) => segment.id
  );

  if (active.length > 0) return active;
  return ['colors'];
}

export function CatalogFilterSheet({
  visible,
  filters,
  onClose,
  onFiltersChange,
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
      onClear={() =>
        onFiltersChange({ ...DEFAULT_CATALOG_FILTERS, simpleAdd: filters.simpleAdd })
      }
      portalName="catalog-filter-sheet"
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
                FACTORY_RADIUS_CONTROL_CLASS
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
