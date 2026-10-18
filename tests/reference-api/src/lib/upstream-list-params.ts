import type { CardsListQuery } from '@riftbound/contracts';

export type UpstreamReconcileMode = 'sync' | 'skip';

/** Hard cap so a broken upstream total cannot loop forever. */
export const UPSTREAM_BACKFILL_PAGE_CAP = 100;

export function buildUpstreamListParams(
  query: CardsListQuery
): Record<string, string | number | undefined> {
  const params: Record<string, string | number | undefined> = {
    page: query.page,
    limit: Math.min(query.limit, 100),
    sortBy: query.sortBy,
    dir: query.dir,
  };

  const q = query.q?.trim();
  if (q) params.q = q;
  if (query.types) params.types = query.types;
  if (query.super) params.supertypes = query.super;
  if (query.variants) params.variants = query.variants;
  if (query.sets) params.sets = query.sets;
  // PA has no colorMode=within; omit colors for within or PA's "contains all" under-backfills identity pools.
  if (query.colors && query.colorMode !== 'within') {
    params.colors = query.colors;
  }
  if (query.rarities) params.rarities = query.rarities;
  if (query.energyMin != null) params.energyMin = query.energyMin;
  if (query.energyMax != null) params.energyMax = query.energyMax;
  if (query.powerMin != null) params.powerMin = query.powerMin;
  if (query.powerMax != null) params.powerMax = query.powerMax;
  if (query.mightMin != null) params.mightMin = query.mightMin;
  if (query.mightMax != null) params.mightMax = query.mightMax;

  return params;
}

export function upstreamCheckKey(query: CardsListQuery): string {
  return JSON.stringify({
    q: query.q?.trim().toLowerCase() ?? '',
    types: query.types ?? '',
    super: query.super ?? '',
    variants: query.variants ?? '',
    sets: query.sets ?? '',
    colors: query.colors ?? '',
    colorMode: query.colorMode ?? 'all',
    rarities: query.rarities ?? '',
    limit: query.limit,
    page: query.page,
    sortBy: query.sortBy,
    dir: query.dir,
  });
}

/** Upstream pages to walk while local lags; text search still multi-pages so later alt arts are not missed. */
export function maxUpstreamBackfillPages(query: CardsListQuery): number {
  const q = query.q?.trim();
  if (q && q.length >= 2) return 20;
  return UPSTREAM_BACKFILL_PAGE_CAP;
}

/** Local filters out cards PA still counts — totals cannot be compared directly. */
export function upstreamTotalsBroaderThanLocal(query: CardsListQuery): boolean {
  // PA has no colorMode=within; we omit colors so identity pools are not under-backfilled.
  if (query.colorMode === 'within' && Boolean(query.colors)) return true;
  // Local energy sort/filters drop Legend/Battlefield; PA does not.
  return (
    query.sortBy === 'energy' ||
    query.energyMin !== undefined ||
    query.energyMax !== undefined
  );
}

export function resolveUpstreamReconcileMode(
  query: CardsListQuery,
  localResult: { items: unknown[]; total: number },
  alreadyChecked: boolean
): UpstreamReconcileMode {
  if (query.refresh) return 'sync';

  const q = query.q?.trim();
  const hasSearchQuery = Boolean(q && q.length >= 2);
  const localEmpty = localResult.total === 0 || localResult.items.length === 0;

  // Empty local results must always re-verify — never trust a prior miss.
  if (localEmpty) return 'sync';

  if (alreadyChecked) return 'skip';

  // Text search with local hits still reconciles once for upstream-only backfill; short-circuits when local >= upstream.
  if (hasSearchQuery) return 'sync';

  // First browse/deck-builder page reconciles once when local has hits; short-circuits when local is ahead.
  if (query.page === 1) return 'sync';

  return 'skip';
}
