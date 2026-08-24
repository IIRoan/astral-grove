import type { CatalogFilters } from '@/constants/catalogFilters';

export type CatalogFilterPresentation = 'list' | 'mobile';

export function toggleCatalogFilterValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

export interface CatalogFilterSegmentCommonProps {
  filters: CatalogFilters;
  compact?: boolean;
  presentation?: CatalogFilterPresentation;
  onUpdate: (patch: Partial<CatalogFilters>) => void;
}
