import type { FilterSnapshot, PaLogicalCard } from '@riftbound/contracts';
import { isVariantFoil } from '@riftbound/contracts';
import type { PaClient } from '../upstream/pa-client.js';

export type ExpandedCatalogProbe = {
  catalogPrintTotal: number;
  logicalCardCount: number;
  setPrintTotals: Record<string, number>;
  setFoilPrintTotals: Record<string, number>;
};

export function isProbeVariantFoil(variant: {
  foilMode?: string;
  variantNumber?: string;
  variantLabel?: string;
  variantType?: string;
}): boolean {
  return isVariantFoil(
    variant.foilMode,
    variant.variantNumber ?? '',
    variant.variantLabel,
    variant.variantType
  );
}

export function accumulatePrintCounts(
  card: PaLogicalCard,
  setPrintTotals: Map<string, number>,
  setFoilPrintTotals?: Map<string, number>
): number {
  let added = 0;
  for (const variant of card.variants) {
    if (!variant.isCollectible) continue;
    added += 1;
    const code = variant.set.prefix;
    setPrintTotals.set(code, (setPrintTotals.get(code) ?? 0) + 1);
    if (setFoilPrintTotals && isProbeVariantFoil(variant)) {
      setFoilPrintTotals.set(code, (setFoilPrintTotals.get(code) ?? 0) + 1);
    }
  }
  return added;
}

/** Count every collectible printing upstream (Standard/Alt/Overnumbered/Foil) to match PA totals. */
export async function probeExpandedCatalog(
  pa: PaClient
): Promise<ExpandedCatalogProbe> {
  const seenCardIds = new Set<string>();
  const setPrintTotals = new Map<string, number>();
  const setFoilPrintTotals = new Map<string, number>();
  let catalogPrintTotal = 0;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await pa.listCards({ limit: 100, page });

    for (const item of res.data) {
      const logical = await pa.getCard(item.variantNumber);
      if (seenCardIds.has(logical.id)) continue;
      seenCardIds.add(logical.id);
      catalogPrintTotal += accumulatePrintCounts(
        logical,
        setPrintTotals,
        setFoilPrintTotals
      );
    }

    // Keep paging even when a page only repeats already-seen logical cards.
    hasMore = Boolean(res.pagination.hasNext);
    page += 1;
  }

  return {
    catalogPrintTotal,
    logicalCardCount: seenCardIds.size,
    setPrintTotals: Object.fromEntries(setPrintTotals),
    setFoilPrintTotals: Object.fromEntries(setFoilPrintTotals),
  };
}

export function enrichFilterSnapshotWithPrintCounts(
  snapshot: FilterSnapshot,
  setPrintTotals: Record<string, number>,
  setFoilPrintTotals: Record<string, number> = {}
): FilterSnapshot {
  return {
    ...snapshot,
    sets: snapshot.sets.map((set) => {
      const key = set.code ?? set.id;
      const printCount = setPrintTotals[key] ?? set.count;
      const foilPrintCount = setFoilPrintTotals[key] ?? set.foilPrintCount ?? 0;
      return {
        ...set,
        printCount,
        foilPrintCount,
      };
    }),
  };
}

export function snapshotHasPrintCounts(snapshot: FilterSnapshot): boolean {
  return snapshot.sets.some((set) => (set.printCount ?? 0) > 0);
}
