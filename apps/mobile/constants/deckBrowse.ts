import type {
  DeckSortField,
  DecksListQuery,
  FilterSnapshot,
} from '@riftbound/contracts';

export type DeckBrowseSort = {
  sort: DeckSortField;
  dir: 'asc' | 'desc';
};

export const DEFAULT_DECK_BROWSE_SORT: DeckBrowseSort = {
  sort: 'trending',
  dir: 'desc',
};

export const DECK_BROWSE_SORT_OPTIONS: {
  sort: DeckSortField;
  dir: 'asc' | 'desc';
  label: string;
}[] = [
  { sort: 'trending', dir: 'desc', label: 'Trending' },
  { sort: 'likes', dir: 'desc', label: 'Most liked' },
  { sort: 'views', dir: 'desc', label: 'Most viewed' },
  { sort: 'createdAt', dir: 'desc', label: 'Newest' },
  { sort: 'createdAt', dir: 'asc', label: 'Oldest' },
  { sort: 'editedAt', dir: 'desc', label: 'Recently edited' },
];

export function deckBrowseSortKey(sort: DeckBrowseSort): string {
  return `${sort.sort}:${sort.dir}`;
}

export function findDeckBrowseSortOption(sort: DeckBrowseSort) {
  return (
    DECK_BROWSE_SORT_OPTIONS.find(
      (option) => option.sort === sort.sort && option.dir === sort.dir
    ) ?? DECK_BROWSE_SORT_OPTIONS[0]
  );
}

export type DeckBrowseFilters = {
  legend?: string;
  sets: string[];
  isLegal?: boolean;
  hasGuide: boolean;
  hasVideo: boolean;
  hasMatchups: boolean;
};

export const DEFAULT_DECK_BROWSE_FILTERS: DeckBrowseFilters = {
  sets: [],
  hasGuide: false,
  hasVideo: false,
  hasMatchups: false,
};

export function deckBrowseFiltersActive(filters: DeckBrowseFilters): boolean {
  return Boolean(
    filters.legend ||
    filters.sets.length > 0 ||
    filters.isLegal !== undefined ||
    filters.hasGuide ||
    filters.hasVideo ||
    filters.hasMatchups
  );
}

export function countDeckBrowseFilters(filters: DeckBrowseFilters): number {
  let count = 0;
  if (filters.legend) count += 1;
  if (filters.sets.length > 0) count += 1;
  if (filters.isLegal !== undefined) count += 1;
  if (filters.hasGuide) count += 1;
  if (filters.hasVideo) count += 1;
  if (filters.hasMatchups) count += 1;
  return count;
}

export type DeckBrowseSetOption = {
  code: string;
  name: string;
  count: number;
};

/** Live set list for deck browse filters — synced from `/api/v1/filters` (Piltover Archive). */
export function deckBrowseSetOptionsFromFilters(
  sets: FilterSnapshot['sets'] | undefined
): DeckBrowseSetOption[] {
  return (sets ?? [])
    .filter((entry) => (entry.printCount ?? entry.count) > 0)
    .map((entry) => ({
      code: (entry.code ?? entry.id).toUpperCase(),
      name: entry.name,
      count: entry.printCount ?? entry.count,
    }));
}

export function deckBrowseSetNameLookup(
  options: readonly DeckBrowseSetOption[]
): Map<string, string> {
  return new Map(options.map((option) => [option.code.toUpperCase(), option.name]));
}

export function formatDeckBrowseSetSelection(
  codes: readonly string[],
  lookup: ReadonlyMap<string, string> = new Map()
): string {
  if (codes.length === 0) return '';
  return codes.map((code) => lookup.get(code.toUpperCase()) ?? code).join(', ');
}

/** Drop set codes that are no longer in the upstream catalog snapshot. */
export function sanitizeDeckBrowseFilters(
  filters: DeckBrowseFilters,
  availableSetCodes: readonly string[]
): DeckBrowseFilters {
  if (filters.sets.length === 0) return filters;

  const allowed = new Set(availableSetCodes.map((code) => code.toUpperCase()));
  const sets = filters.sets.filter((code) => allowed.has(code.toUpperCase()));
  if (sets.length === filters.sets.length) return filters;
  return { ...filters, sets };
}

export type DeckBrowseFilterChipDescriptor = {
  key: string;
  label: string;
  applyClear: (filters: DeckBrowseFilters) => DeckBrowseFilters;
};

export function buildDeckBrowseFilterChips(
  filters: DeckBrowseFilters,
  setNameByCode: ReadonlyMap<string, string> = new Map()
): DeckBrowseFilterChipDescriptor[] {
  const chips: DeckBrowseFilterChipDescriptor[] = [];

  if (filters.legend) {
    chips.push({
      key: 'legend',
      label: filters.legend,
      applyClear: (current) => ({ ...current, legend: undefined }),
    });
  }
  if (filters.sets.length > 0) {
    chips.push({
      key: 'sets',
      label: `Sets: ${formatDeckBrowseSetSelection(filters.sets, setNameByCode)}`,
      applyClear: (current) => ({ ...current, sets: [] }),
    });
  }
  if (filters.isLegal === true) {
    chips.push({
      key: 'legal',
      label: 'Legal',
      applyClear: (current) => ({ ...current, isLegal: undefined }),
    });
  }
  if (filters.isLegal === false) {
    chips.push({
      key: 'not-legal',
      label: 'Not legal',
      applyClear: (current) => ({ ...current, isLegal: undefined }),
    });
  }
  if (filters.hasGuide) {
    chips.push({
      key: 'guide',
      label: 'Has guide',
      applyClear: (current) => ({ ...current, hasGuide: false }),
    });
  }
  if (filters.hasVideo) {
    chips.push({
      key: 'video',
      label: 'Has video',
      applyClear: (current) => ({ ...current, hasVideo: false }),
    });
  }
  if (filters.hasMatchups) {
    chips.push({
      key: 'matchups',
      label: 'Has matchups',
      applyClear: (current) => ({ ...current, hasMatchups: false }),
    });
  }

  return chips;
}

export function deckBrowseFiltersToQuery(
  filters: DeckBrowseFilters
): Pick<
  DecksListQuery,
  'legend' | 'sets' | 'isLegal' | 'hasGuide' | 'hasVideo' | 'hasMatchups'
> {
  return {
    ...(filters.legend ? { legend: filters.legend } : {}),
    ...(filters.sets.length > 0 ? { sets: filters.sets.join(',') } : {}),
    ...(filters.isLegal !== undefined ? { isLegal: filters.isLegal } : {}),
    ...(filters.hasGuide ? { hasGuide: true } : {}),
    ...(filters.hasVideo ? { hasVideo: true } : {}),
    ...(filters.hasMatchups ? { hasMatchups: true } : {}),
  };
}
