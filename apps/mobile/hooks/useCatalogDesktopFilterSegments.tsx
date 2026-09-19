import { useMemo, useState } from 'react';
import type { CatalogFilterSegment, CatalogFilters } from '@/constants/catalogFilters';
import {
  CATALOG_FILTER_SEGMENTS,
  catalogFilterSegmentActive,
} from '@/constants/catalogFilters';
import { CatalogFilterSegmentPanel } from '@/components/catalog/CatalogFilterPanels';

export function useCatalogDesktopFilterSegments(
  filters: CatalogFilters,
  onFiltersChange: (filters: CatalogFilters) => void
) {
  return useMemo(
    () =>
      CATALOG_FILTER_SEGMENTS.filter((segment) => segment.id !== 'collection').map(
        (segment) => ({
          id: segment.id,
          label: segment.label,
          hasValue: catalogFilterSegmentActive(segment.id, filters),
          width: segment.id === 'stats' ? 320 : undefined,
          maxHeight: segment.id === 'stats' ? 480 : 420,
          children: (
            <CatalogFilterSegmentPanel
              segment={segment.id}
              filters={filters}
              onFiltersChange={onFiltersChange}
              compact
            />
          ),
        })
      ),
    [filters, onFiltersChange]
  );
}

export function useCatalogDesktopFilterPopoverState() {
  return useState<CatalogFilterSegment | null>(null);
}
