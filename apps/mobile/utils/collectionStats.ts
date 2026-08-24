import type { ImageSourcePropType } from 'react-native';
import type { CollectionEntry } from '@/services/collectionService';
import { mapFilter } from '@/lib/iteration';

export type ApiSetRow = {
  code: string;
  name: string;
  count: number;
  /** Foil printings in the set when known from filters; defaults to `count`. */
  foilCount?: number;
};

export type SetCatalogOverlay = {
  name?: string;
  released?: string;
  art?: ImageSourcePropType;
  logo?: ImageSourcePropType;
};

export type MergedSetStat = {
  code: string;
  name: string;
  released: string;
  art?: ImageSourcePropType;
  logo?: ImageSourcePropType;
  total: number;
  /** Unique printings owned (foil + non-foil). */
  owned: number;
  /** Unique non-foil printings owned. */
  nonFoilOwned: number;
  /** Unique foil printings owned. */
  foilOwned: number;
  /** Non-foil printings available in the set. */
  nonFoilTotal: number;
  /** Foil printings available in the set. */
  foilTotal: number;
};

export type CollectionBreakdownRow = {
  name: string;
  owned: number;
  total: number;
};

/** Sum of copy quantities across all collection rows. */
export function sumCollectionCopies(collection: CollectionEntry[]): number {
  return collection.reduce((sum, entry) => sum + entry.quantity, 0);
}

/** Unique logical cards (by name), matching Piltover Archive "Cards Collected". */
export function countUniqueCardNames(collection: CollectionEntry[]): number {
  const names = new Set<string>();
  for (const entry of collection) {
    if (entry.quantity > 0 && entry.name) {
      names.add(entry.name);
    }
  }
  return names.size;
}

/** Unique printings (by variant number) owned with quantity > 0. */
export function countUniqueVariants(collection: CollectionEntry[]): number {
  const variants = new Set<string>();
  for (const entry of collection) {
    if (entry.quantity > 0) {
      variants.add(entry.variantNumber);
    }
  }
  return variants.size;
}

/** Catalog size for completion: sum of logical card counts per type. */
export function catalogCardTotalFromTypes(
  types: { name: string; count: number }[]
): number {
  return types
    .filter((type) => type.name !== 'Card')
    .reduce((sum, type) => sum + type.count, 0);
}

export function computeTypeBreakdown(
  collection: CollectionEntry[],
  apiTypes: { name: string; count: number }[]
): CollectionBreakdownRow[] {
  const namesByType = new Map<string, Set<string>>();

  for (const entry of collection) {
    if (!entry.type || entry.quantity <= 0) continue;
    const names = namesByType.get(entry.type) ?? new Set<string>();
    names.add(entry.name);
    namesByType.set(entry.type, names);
  }

  return mapFilter(
    apiTypes,
    (type) => type.name !== 'Card',
    (type) => ({
      name: type.name,
      owned: namesByType.get(type.name)?.size ?? 0,
      total: type.count,
    })
  );
}

export function computeRarityBreakdown(
  collection: CollectionEntry[],
  apiRarities: { name: string; count: number }[]
): CollectionBreakdownRow[] {
  const namesByRarity = new Map<string, Set<string>>();

  for (const entry of collection) {
    if (entry.quantity <= 0) continue;
    const rarity = entry.rarity || 'Unknown';
    const names = namesByRarity.get(rarity) ?? new Set<string>();
    names.add(entry.name);
    namesByRarity.set(rarity, names);
  }

  return apiRarities.map((rarity) => ({
    name: rarity.name,
    owned: namesByRarity.get(rarity.name)?.size ?? 0,
    total: rarity.count,
  }));
}

/** Merge live PA set list with collection ownership and optional local artwork. */
export function mergeSetStats(
  collection: CollectionEntry[],
  apiSets: ApiSetRow[],
  resolveCatalogEntry: (code: string) => SetCatalogOverlay | undefined = () => undefined
): MergedSetStat[] {
  const ownedBySet = new Map<
    string,
    { variants: Set<string>; nonFoilVariants: Set<string>; foilVariants: Set<string> }
  >();

  for (const entry of collection) {
    if (entry.quantity <= 0) continue;
    const code = entry.setCode || entry.variantNumber.split('-')[0] || 'UNK';
    const current = ownedBySet.get(code) ?? {
      variants: new Set<string>(),
      nonFoilVariants: new Set<string>(),
      foilVariants: new Set<string>(),
    };
    current.variants.add(entry.variantNumber);
    if (entry.isFoil) {
      current.foilVariants.add(entry.variantNumber);
    } else {
      current.nonFoilVariants.add(entry.variantNumber);
    }
    ownedBySet.set(code, current);
  }

  const seen = new Set<string>();
  const merged: MergedSetStat[] = [];

  const pushSet = (code: string, name: string, total: number, foilCount?: number) => {
    const catalog = resolveCatalogEntry(code);
    const stats = ownedBySet.get(code);
    const owned = stats?.variants.size ?? 0;
    const nonFoilOwned = stats?.nonFoilVariants.size ?? 0;
    const foilOwned = stats?.foilVariants.size ?? 0;
    const resolvedTotal = Math.max(total, owned);
    const foilTotal =
      foilCount != null ? Math.max(foilCount, foilOwned) : Math.max(foilOwned, 0);
    // When foil totals are unknown, keep a single shared denominator so bars stay comparable.
    const knownSplit = foilCount != null;
    const nonFoilTotal = knownSplit
      ? Math.max(resolvedTotal - foilTotal, nonFoilOwned)
      : resolvedTotal;
    const foilDenominator = knownSplit ? foilTotal : resolvedTotal;

    merged.push({
      code,
      name: catalog?.name ?? name,
      released: catalog?.released ?? '',
      ...(catalog?.art ? { art: catalog.art } : {}),
      ...(catalog?.logo ? { logo: catalog.logo } : {}),
      total: resolvedTotal,
      owned,
      nonFoilOwned,
      foilOwned,
      nonFoilTotal,
      foilTotal: foilDenominator,
    });
  };

  for (const apiSet of apiSets) {
    seen.add(apiSet.code);
    pushSet(apiSet.code, apiSet.name, apiSet.count, apiSet.foilCount);
  }

  for (const [code, stats] of ownedBySet) {
    if (seen.has(code)) continue;
    pushSet(code, code, stats.variants.size);
  }

  return merged;
}
