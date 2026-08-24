import type { FilterSnapshot } from '@riftbound/contracts';

export function sumVariantTypeCounts(
  snapshot: Pick<FilterSnapshot, 'variants'>
): number {
  return (snapshot.variants ?? []).reduce((sum, entry) => sum + entry.count, 0);
}

export function sumSetPrintCounts(snapshot: Pick<FilterSnapshot, 'sets'>): number {
  return (snapshot.sets ?? []).reduce(
    (sum, set) => sum + (set.printCount ?? set.count),
    0
  );
}

/** Prefer expanded per-set print counts for catalog total (matches PA collectible printings). */
export function computeCatalogTotal(
  snapshot: Pick<FilterSnapshot, 'variants' | 'sets'>,
  syncedPrintTotal = 0
): number {
  const fromSetPrints = sumSetPrintCounts(snapshot);
  if (fromSetPrints > 0 && snapshot.sets.some((set) => set.printCount != null)) {
    return Math.max(fromSetPrints, syncedPrintTotal);
  }

  const fromVariantTypes = sumVariantTypeCounts(snapshot);
  if (fromVariantTypes > 0) {
    return Math.max(fromVariantTypes, syncedPrintTotal);
  }

  return Math.max(fromSetPrints, syncedPrintTotal);
}
