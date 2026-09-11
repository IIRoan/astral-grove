import type { CatalogFilters } from '@/constants/catalogFilters';

export type CatalogFilterPresentation = 'list' | 'mobile';

export type CatalogStatFilterKey = 'energy' | 'power' | 'might';

export function toggleCatalogFilterValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

/** Toggle a discrete energy/power/might chip; pressing the active value clears it. */
export function toggleCatalogStatFilter(
  filters: CatalogFilters,
  key: CatalogStatFilterKey,
  value: number
): CatalogFilters {
  const next = { ...filters };
  if (next[key] === value) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

export type CatalogFilterUpdate =
  | Partial<CatalogFilters>
  | ((current: CatalogFilters) => CatalogFilters);

export interface CatalogFilterSegmentCommonProps {
  filters: CatalogFilters;
  compact?: boolean;
  presentation?: CatalogFilterPresentation;
  onUpdate: (patch: CatalogFilterUpdate) => void;
}
