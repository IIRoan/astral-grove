import type { ReactNode } from 'react';
import { FilterPopoverBar } from '@/components/filters/FilterPrimitives';
import type { CatalogFilters } from '@/constants/catalogFilters';
import {
  useCatalogDesktopFilterPopoverState,
  useCatalogDesktopFilterSegments,
} from '@/hooks/useCatalogDesktopFilterSegments';

interface CatalogDesktopFilterBarProps {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  leading?: ReactNode;
}

export function CatalogDesktopFilterBar({
  filters,
  onFiltersChange,
  leading,
}: CatalogDesktopFilterBarProps) {
  const [openSegment, setOpenSegment] = useCatalogDesktopFilterPopoverState();
  const segments = useCatalogDesktopFilterSegments(filters, onFiltersChange);

  return (
    <FilterPopoverBar
      portalName="catalog-filter-bar"
      openId={openSegment}
      onOpenIdChange={setOpenSegment}
      segments={segments}
      leading={leading}
    />
  );
}
