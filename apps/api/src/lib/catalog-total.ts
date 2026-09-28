import type { FilterSnapshot } from '@riftbound/contracts';

export type SetPrintShortfall = {
  code: string;
  expected: number;
  actual: number;
};

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

/** Sets whose local collectible printings are below the upstream/probed expectation. */
export function findSetPrintShortfalls(
  snapshot: Pick<FilterSnapshot, 'sets'>,
  localByCode: Record<string, number>
): SetPrintShortfall[] {
  const shortfalls: SetPrintShortfall[] = [];
  for (const set of snapshot.sets ?? []) {
    const code = (set.code ?? set.id).trim().toUpperCase();
    if (!code) continue;
    const expected = set.printCount ?? set.count;
    if (expected <= 0) continue;
    const actual = localByCode[code] ?? 0;
    if (actual < expected) {
      shortfalls.push({ code, expected, actual });
    }
  }
  return shortfalls;
}
