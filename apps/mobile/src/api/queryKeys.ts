import type { CatalogFilters } from '@/constants/catalogFilters';
import { catalogFiltersQueryKey } from '@/constants/catalogFilters';
import type { DeckBrowseFilters, DeckBrowseSort } from '@/constants/deckBrowse';

export const catalogQueryKeys = {
  meta: ['catalog', 'meta'] as const,
  index: ['catalog', 'index'] as const,
  filters: ['filters'] as const,
};

export const cardQueryKeys = {
  search: (q: string, limit = 40, sortBy = 'name', dir = 'asc') =>
    ['cards', 'search', q.toLowerCase(), limit, sortBy, dir] as const,
  browse: (filters?: CatalogFilters, sortBy = 'name', dir = 'asc') =>
    ['cards', 'browse', catalogFiltersQueryKey(filters), sortBy, dir] as const,
  searchInfinite: (q: string, sortBy: string, dir: string, filters?: CatalogFilters) =>
    [
      'cards',
      'search',
      'infinite',
      q.toLowerCase(),
      sortBy,
      dir,
      catalogFiltersQueryKey(filters),
    ] as const,
  detail: (variantNumber: string) => ['cards', 'detail', variantNumber] as const,
  banDates: (variantKey: string) => ['cards', 'ban-dates', variantKey] as const,
};

export const collectionQueryKeys = {
  all: ['collection'] as const,
  entry: (variantNumber: string) => ['collection', variantNumber] as const,
  ownership: (variantNumbers: string[]) =>
    ['collection', 'ownership', [...variantNumbers].sort().join(',')] as const,
  ownershipRoot: ['collection', 'ownership'] as const,
  recentAdds: (variantNumbers: string[]) =>
    ['collection', 'recent-adds', [...variantNumbers].sort().join(',')] as const,
  recentAddsRoot: ['collection', 'recent-adds'] as const,
  activityHistory: (variantNumbers: readonly string[]) =>
    [
      'collection',
      'recent-adds',
      [...variantNumbers].sort().join(','),
      'history',
    ] as const,
  share: ['collection', 'share'] as const,
};

/** Shared by collection mutations so live sync can detect in-flight edits. */
export const collectionMutationKey = ['collection', 'mutation'] as const;

export const wishlistQueryKeys = {
  all: ['wishlist'] as const,
  prices: ['wishlist', 'prices', '30d'] as const,
};

export const priceQueryKeys = {
  stats: (variantNumber: string, isFoil: boolean, days: number) =>
    ['prices', 'stats', variantNumber, isFoil, days] as const,
};

export const deckQueryKeys = {
  all: ['decks'] as const,
  list: (source: 'owned' | 'imported', q?: string) =>
    ['decks', 'list', source, q ?? ''] as const,
  browse: (input: { q?: string; sort: DeckBrowseSort; filters: DeckBrowseFilters }) =>
    [
      'decks',
      'browse',
      input.q ?? '',
      input.sort.sort,
      input.sort.dir,
      input.filters.legend ?? '',
      input.filters.sets.join(','),
      input.filters.isLegal ?? 'all',
      input.filters.hasGuide,
      input.filters.hasVideo,
      input.filters.hasMatchups,
    ] as const,
  detail: (id: string) => ['decks', id] as const,
};
