import type { CardsListQuery } from '@riftbound/contracts';

export type SearchBenchmarkCase = {
  id: string;
  query: CardsListQuery;
};

function baseQuery(overrides: Partial<CardsListQuery> = {}): CardsListQuery {
  return {
    page: 1,
    limit: 20,
    sortBy: 'name',
    dir: 'asc',
    colorMode: 'all',
    ...overrides,
  };
}

export const SEARCH_BENCHMARK_CASES: readonly SearchBenchmarkCase[] = [
  { id: 'name-jinx', query: baseQuery({ q: 'jinx' }) },
  { id: 'name-ambessa', query: baseQuery({ q: 'ambessa' }) },
  { id: 'name-matriarch', query: baseQuery({ q: 'matriarch' }) },
  { id: 'name-vi', query: baseQuery({ q: 'vi' }) },
  { id: 'accent-ambessa-precomposed', query: baseQuery({ q: 'Ambéssa' }) },
  { id: 'accent-ambessa-decomposed', query: baseQuery({ q: 'Ambe\u0301ssa' }) },
  { id: 'accent-ambessa-spaced', query: baseQuery({ q: 'AM BÉSSA' }) },
  { id: 'accent-matriarch', query: baseQuery({ q: 'Matriarch' }) },
  { id: 'compact-soul-spinner', query: baseQuery({ q: 'soul spinner' }) },
  { id: 'compact-soulspinner', query: baseQuery({ q: 'soulspinner' }) },
  { id: 'typo-embessa', query: baseQuery({ q: 'embessa' }) },
  { id: 'typo-stargazer', query: baseQuery({ q: 'stargazer' }) },
  { id: 'false-positive-plate', query: baseQuery({ q: 'plate' }) },
  { id: 'printing-ogn-prefix', query: baseQuery({ q: 'OGN-' }) },
  { id: 'printing-ogn-253', query: baseQuery({ q: 'OGN-253' }) },
  { id: 'printing-signed', query: baseQuery({ q: 'signed' }) },
  { id: 'printing-artist-kudos', query: baseQuery({ q: 'kudos' }) },
  { id: 'printing-set-origins', query: baseQuery({ q: 'origins' }) },
  { id: 'mixed-unit-fury', query: baseQuery({ q: 'unit fury' }) },
  { id: 'mixed-ambessa-legend', query: baseQuery({ q: 'ambessa legend' }) },
  { id: 'mixed-jinx-signed', query: baseQuery({ q: 'jinx signed' }) },
  { id: 'filter-unit-gear', query: baseQuery({ q: 'spinner', types: 'Unit,Gear' }) },
  { id: 'filter-champion', query: baseQuery({ q: 'vi', super: 'Champion' }) },
  {
    id: 'filter-set-rarity',
    query: baseQuery({ q: 'vi', sets: 'OGN', rarities: 'Rare' }),
  },
  {
    id: 'filter-variant-type',
    query: baseQuery({ q: 'vi', variants: 'Standard' }),
  },
  {
    id: 'filter-energy-might-power',
    query: baseQuery({
      q: 'vi',
      energyMin: 1,
      energyMax: 4,
      mightMin: 1,
      mightMax: 6,
      powerMin: 0,
      powerMax: 3,
    }),
  },
  {
    id: 'filter-color-all',
    query: baseQuery({ q: 'vi', colors: 'Body', colorMode: 'all' }),
  },
  {
    id: 'filter-color-within',
    query: baseQuery({ q: 'vi', colors: 'Body,Mind', colorMode: 'within' }),
  },
  { id: 'filter-exclude-tokens', query: baseQuery({ q: 'vi', excludeTokens: true }) },
  { id: 'page-first', query: baseQuery({ q: 'a', page: 1, limit: 20 }) },
  { id: 'page-later', query: baseQuery({ q: 'a', page: 3, limit: 20 }) },
  { id: 'page-beyond-former-cap', query: baseQuery({ q: 'unit', page: 1, limit: 40 }) },
  { id: 'page-out-of-range', query: baseQuery({ q: 'jinx', page: 99, limit: 20 }) },
];
