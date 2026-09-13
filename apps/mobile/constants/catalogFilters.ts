import type { CardListItem, CardsListQuery } from '@riftbound/contracts';
import { compactMap } from '@/lib/iteration';
import { getCardPrintings, ownedQuantityForPrinting } from '@/utils/variants';

/** Matches Piltover Archive card library stat chips. */
export const CATALOG_ENERGY_VALUES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const;
export const CATALOG_POWER_VALUES = [0, 1, 2, 3, 4] as const;
export const CATALOG_MIGHT_VALUES = [0, 2, 3, 5, 7, 8, 10] as const;

export type CatalogCollectionFilter = 'all' | 'owned';

/** Upstream "Card" type is token markers — not a real browse type. */
export const CATALOG_HIDDEN_TYPE_FILTERS = new Set(['card']);

export type CatalogFilters = {
  collection: CatalogCollectionFilter;
  /** Skip foil/non-foil picker on quick-add; inserts the default (non-foil) finish. */
  simpleAdd: boolean;
  colors: string[];
  sets: string[];
  types: string[];
  supertypes: string[];
  variants: string[];
  rarities: string[];
  energy?: number;
  power?: number;
  might?: number;
  excludeTokens: boolean;
  tokensOnly: boolean;
};

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  collection: 'all',
  simpleAdd: false,
  colors: [],
  sets: [],
  types: [],
  supertypes: [],
  variants: [],
  rarities: [],
  excludeTokens: false,
  tokensOnly: false,
};

export function isCatalogBrowsableType(typeName: string): boolean {
  return !CATALOG_HIDDEN_TYPE_FILTERS.has(typeName.trim().toLowerCase());
}

export function sanitizeCatalogFilters(filters: CatalogFilters): CatalogFilters {
  const collection = filters.collection === 'owned' ? 'owned' : 'all';

  return {
    ...filters,
    collection,
    simpleAdd: Boolean(filters.simpleAdd),
    types: filters.types.filter((type) => isCatalogBrowsableType(type)),
    variants: [],
    excludeTokens: filters.tokensOnly ? false : filters.excludeTokens,
    tokensOnly: filters.excludeTokens ? false : filters.tokensOnly,
  };
}

export type CatalogFilterSegment =
  | 'collection'
  | 'colors'
  | 'sets'
  | 'types'
  | 'supertypes'
  | 'variants'
  | 'rarities'
  | 'stats';

export const CATALOG_FILTER_SEGMENTS: { id: CatalogFilterSegment; label: string }[] = [
  { id: 'collection', label: 'Collection' },
  { id: 'colors', label: 'Colors' },
  { id: 'sets', label: 'Sets' },
  { id: 'types', label: 'Type' },
  { id: 'supertypes', label: 'Supertype' },
  { id: 'rarities', label: 'Rarity' },
  { id: 'stats', label: 'Stats' },
];

export function catalogFiltersActive(filters: CatalogFilters): boolean {
  return (
    filters.collection !== 'all' ||
    filters.colors.length > 0 ||
    filters.sets.length > 0 ||
    filters.types.length > 0 ||
    filters.supertypes.length > 0 ||
    filters.variants.length > 0 ||
    filters.rarities.length > 0 ||
    filters.energy !== undefined ||
    filters.power !== undefined ||
    filters.might !== undefined ||
    filters.excludeTokens ||
    filters.tokensOnly
  );
}

export function clearCatalogFilters(
  filters: CatalogFilters,
  options?: { preserveColorsAndTokens?: boolean }
): CatalogFilters {
  return sanitizeCatalogFilters({
    ...DEFAULT_CATALOG_FILTERS,
    simpleAdd: filters.simpleAdd,
    ...(options?.preserveColorsAndTokens
      ? { colors: filters.colors, excludeTokens: filters.excludeTokens }
      : {}),
  });
}

export function catalogFiltersHaveClearableExtras(
  filters: CatalogFilters,
  options?: { preserveColorsAndTokens?: boolean }
): boolean {
  if (!options?.preserveColorsAndTokens) {
    return catalogFiltersActive(filters);
  }
  return catalogFiltersActive({
    ...filters,
    colors: [],
    excludeTokens: false,
  });
}

export function countCatalogFilters(filters: CatalogFilters): number {
  let count = 0;
  if (filters.collection !== 'all') count += 1;
  count += filters.colors.length;
  count += filters.sets.length;
  count += filters.types.length;
  count += filters.supertypes.length;
  count += filters.variants.length;
  count += filters.rarities.length;
  if (filters.energy !== undefined) count += 1;
  if (filters.power !== undefined) count += 1;
  if (filters.might !== undefined) count += 1;
  if (filters.excludeTokens) count += 1;
  if (filters.tokensOnly) count += 1;
  return count;
}

export function catalogFilterSegmentActive(
  segment: CatalogFilterSegment,
  filters: CatalogFilters
): boolean {
  switch (segment) {
    case 'collection':
      return filters.collection !== 'all';
    case 'colors':
      return filters.colors.length > 0;
    case 'sets':
      return filters.sets.length > 0;
    case 'types':
      return filters.types.length > 0;
    case 'supertypes':
      return filters.supertypes.length > 0;
    case 'variants':
      return filters.variants.length > 0;
    case 'rarities':
      return filters.rarities.length > 0;
    case 'stats':
      return (
        filters.energy !== undefined ||
        filters.power !== undefined ||
        filters.might !== undefined ||
        filters.excludeTokens ||
        filters.tokensOnly
      );
    default:
      return false;
  }
}

/** Short label for mobile accordion headers and quick-filter pills. */
export function catalogFilterSegmentSummary(
  segment: CatalogFilterSegment,
  filters: CatalogFilters
): string | undefined {
  switch (segment) {
    case 'collection':
      if (filters.collection === 'owned') return 'Owned';
      return undefined;
    case 'colors':
      return filters.colors.length > 0 ? filters.colors.join(', ') : undefined;
    case 'sets':
      return filters.sets.length > 0 ? filters.sets.join(', ') : undefined;
    case 'types':
      return filters.types.length > 0 ? filters.types.join(', ') : undefined;
    case 'supertypes':
      return filters.supertypes.length > 0 ? filters.supertypes.join(', ') : undefined;
    case 'variants':
      return filters.variants.length > 0 ? filters.variants.join(', ') : undefined;
    case 'rarities':
      return filters.rarities.length > 0 ? filters.rarities.join(', ') : undefined;
    case 'stats': {
      const parts: string[] = [];
      if (filters.energy !== undefined) parts.push(`E${filters.energy}`);
      if (filters.power !== undefined) parts.push(`P${filters.power}`);
      if (filters.might !== undefined) parts.push(`M${filters.might}`);
      if (filters.excludeTokens) parts.push('No tokens');
      if (filters.tokensOnly) parts.push('Tokens');
      return parts.length > 0 ? parts.join(' · ') : undefined;
    }
    default:
      return undefined;
  }
}

function joinFilterValues(values: string[]): string | undefined {
  const normalized = compactMap(values, (value) => {
    const trimmed = value.trim();
    return trimmed || null;
  });
  return normalized.length > 0 ? normalized.join(',') : undefined;
}

export function catalogFiltersToQuery(
  filters: CatalogFilters
): Partial<CardsListQuery> {
  const query: Partial<CardsListQuery> = {};

  const colors = joinFilterValues(filters.colors);
  if (colors) query.colors = colors;

  const sets = joinFilterValues(filters.sets);
  if (sets) query.sets = sets;

  if (filters.tokensOnly) {
    query.types = 'Card';
  } else {
    const types = joinFilterValues(
      filters.types.filter((type) => isCatalogBrowsableType(type))
    );
    if (types) query.types = types;
  }

  const supertypes = joinFilterValues(filters.supertypes);
  if (supertypes) query.super = supertypes;

  const variants = joinFilterValues(filters.variants);
  if (variants) query.variants = variants;

  const rarities = joinFilterValues(filters.rarities);
  if (rarities) query.rarities = rarities;

  if (filters.energy !== undefined) {
    query.energyMin = filters.energy;
    query.energyMax = filters.energy;
  }
  if (filters.power !== undefined) {
    query.powerMin = filters.power;
    query.powerMax = filters.power;
  }
  if (filters.might !== undefined) {
    query.mightMin = filters.might;
    query.mightMax = filters.might;
  }
  if (filters.excludeTokens) {
    query.excludeTokens = true;
  }

  return query;
}

/** Card must include every selected color; extra domains are allowed. */
function cardMatchesColorFilter(cardColors: string[], selected: string[]): boolean {
  if (selected.length === 0) return true;
  const cardSet = new Set(cardColors.map((color) => color.toLowerCase()));
  return selected.every((color) => cardSet.has(color.toLowerCase()));
}

/** Domain identity: every card color ∈ selected set; colorless matches; Mind-only matches Mind+Order. */
export function cardMatchesColorIdentity(
  cardColors: string[],
  allowed: string[]
): boolean {
  if (allowed.length === 0) return true;
  if (cardColors.length === 0) return true;
  const allowedSet = new Set(allowed.map((color) => color.toLowerCase()));
  return cardColors.every((color) => allowedSet.has(color.toLowerCase()));
}

function isTokenCard(card: CardListItem): boolean {
  return (
    card.type.trim().toLowerCase() === 'card' || /-T\d+$/i.test(card.variantNumber)
  );
}

function cardMatchesVariantFilter(card: CardListItem, variants: string[]): boolean {
  if (variants.length === 0) return true;
  const allowed = new Set(variants.map((value) => value.toLowerCase()));
  if (card.variantType && allowed.has(card.variantType.toLowerCase())) return true;
  return card.printings.some((printing) =>
    allowed.has(printing.variantLabel.trim().toLowerCase())
  );
}

export function cardOwnedQuantity(
  card: CardListItem,
  collectionByVariant: ReadonlyMap<string, { quantity: number }>
): number {
  return getCardPrintings(card).reduce(
    (sum, printing) => sum + ownedQuantityForPrinting(collectionByVariant, printing),
    0
  );
}

export function matchesCatalogFilters(
  card: CardListItem,
  filters: CatalogFilters,
  collectionByVariant: ReadonlyMap<string, { quantity: number }>,
  options?: { colorMode?: 'all' | 'within' }
): boolean {
  if (!catalogFiltersActive(filters)) return true;

  if (
    filters.collection === 'owned' &&
    cardOwnedQuantity(card, collectionByVariant) <= 0
  ) {
    return false;
  }

  if (filters.tokensOnly && !isTokenCard(card)) {
    return false;
  }

  if (filters.colors.length > 0) {
    const colorOk =
      options?.colorMode === 'within'
        ? cardMatchesColorIdentity(card.colors, filters.colors)
        : cardMatchesColorFilter(card.colors, filters.colors);
    if (!colorOk) return false;
  }

  if (filters.sets.length > 0) {
    const allowedSets = new Set(filters.sets.map((code) => code.toUpperCase()));
    if (!allowedSets.has(card.setCode.toUpperCase())) return false;
  }

  if (filters.types.length > 0) {
    const allowedTypes = new Set(filters.types.map((type) => type.toLowerCase()));
    if (!allowedTypes.has(card.type.toLowerCase())) return false;
  }

  if (filters.supertypes.length > 0) {
    const supertype = card.super?.trim().toLowerCase();
    const allowed = new Set(filters.supertypes.map((value) => value.toLowerCase()));
    if (!supertype || !allowed.has(supertype)) return false;
  }

  if (filters.rarities.length > 0) {
    const allowed = new Set(filters.rarities.map((value) => value.toLowerCase()));
    if (!allowed.has(card.rarity.toLowerCase())) return false;
  }

  if (!cardMatchesVariantFilter(card, filters.variants)) return false;

  if (filters.energy !== undefined && card.energy !== filters.energy) return false;
  if (filters.power !== undefined && card.power !== filters.power) return false;
  if (filters.might !== undefined && card.might !== filters.might) return false;

  if (filters.excludeTokens && isTokenCard(card)) return false;

  return true;
}

export type CatalogFilterChip = {
  id: string;
  label: string;
  keywordBase: string;
  /** When set, active chip UI shows a domain icon beside each color name. */
  colorNames?: string[];
  clear: () => CatalogFilters;
};

export function catalogFilterChips(filters: CatalogFilters): CatalogFilterChip[] {
  const chips: CatalogFilterChip[] = [];

  if (filters.colors.length > 0) {
    chips.push({
      id: 'colors',
      label: 'Colors',
      keywordBase: 'REACTION',
      colorNames: [...filters.colors],
      clear: () => ({ ...filters, colors: [] }),
    });
  }
  if (filters.sets.length > 0) {
    chips.push({
      id: 'sets',
      label: `Sets: ${filters.sets.join(', ')}`,
      keywordBase: 'VISION',
      clear: () => ({ ...filters, sets: [] }),
    });
  }
  if (filters.types.length > 0) {
    chips.push({
      id: 'types',
      label: `Type: ${filters.types.join(', ')}`,
      keywordBase: 'COMBAT',
      clear: () => ({ ...filters, types: [] }),
    });
  }
  if (filters.supertypes.length > 0) {
    chips.push({
      id: 'supertypes',
      label: `Supertype: ${filters.supertypes.join(', ')}`,
      keywordBase: 'ASSAULT',
      clear: () => ({ ...filters, supertypes: [] }),
    });
  }
  if (filters.variants.length > 0) {
    chips.push({
      id: 'variants',
      label: `Variant: ${filters.variants.join(', ')}`,
      keywordBase: 'DEATHKNELL',
      clear: () => ({ ...filters, variants: [] }),
    });
  }
  if (filters.rarities.length > 0) {
    chips.push({
      id: 'rarities',
      label: `Rarity: ${filters.rarities.join(', ')}`,
      keywordBase: 'GANKING',
      clear: () => ({ ...filters, rarities: [] }),
    });
  }
  if (filters.energy !== undefined) {
    chips.push({
      id: 'energy',
      label: `Energy ${filters.energy}`,
      keywordBase: 'ACCELERATE',
      clear: () => {
        const next = { ...filters };
        delete next.energy;
        return next;
      },
    });
  }
  if (filters.power !== undefined) {
    chips.push({
      id: 'power',
      label: `Power ${filters.power}`,
      keywordBase: 'COMBAT',
      clear: () => {
        const next = { ...filters };
        delete next.power;
        return next;
      },
    });
  }
  if (filters.might !== undefined) {
    chips.push({
      id: 'might',
      label: `Might ${filters.might}`,
      keywordBase: 'ASSAULT',
      clear: () => {
        const next = { ...filters };
        delete next.might;
        return next;
      },
    });
  }
  if (filters.excludeTokens) {
    chips.push({
      id: 'exclude-tokens',
      label: 'Hide tokens',
      keywordBase: 'DEATHKNELL',
      clear: () => ({ ...filters, excludeTokens: false }),
    });
  }
  if (filters.tokensOnly) {
    chips.push({
      id: 'tokens-only',
      label: 'Tokens only',
      keywordBase: 'VISION',
      clear: () => ({ ...filters, tokensOnly: false }),
    });
  }

  return chips;
}

/** Query/cache key — omits preference-only fields that do not change result sets. */
export function catalogFiltersQueryKey(filters?: CatalogFilters): string {
  if (!filters) return 'default';
  const { simpleAdd: _simpleAdd, ...queryRelevant } = filters;
  return JSON.stringify(queryRelevant);
}
