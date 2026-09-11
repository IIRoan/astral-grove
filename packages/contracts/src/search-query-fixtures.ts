import type { SearchRankCard } from './search-query.js';

export type SearchNormalizationCase = {
  raw: string;
  normalized: string;
};

export type SearchHaystackCase = {
  haystack: string;
  query: string;
  expectMatch: boolean;
};

export type SearchRankCase = {
  query: string;
  orderedNames: string[];
  cards: SearchRankCard[];
};

export const SEARCH_NORMALIZATION_CASES: readonly SearchNormalizationCase[] = [
  { raw: 'Ambessa, Matriarch of War', normalized: 'ambessa matriarch of war' },
  { raw: 'Ambessa - Matriarch of War', normalized: 'ambessa matriarch of war' },
  { raw: 'Ambéssa', normalized: 'ambessa' },
  { raw: 'AMBÉSSA', normalized: 'ambessa' },
  { raw: 'Ambe\u0301ssa', normalized: 'ambessa' },
  { raw: 'AM BÉSSA', normalized: 'am bessa' },
  { raw: 'AM BE\u0301SSA', normalized: 'am bessa' },
  { raw: 'Æther', normalized: 'aether' },
  { raw: 'œuf', normalized: 'oeuf' },
  { raw: 'Straße', normalized: 'strasse' },
  { raw: 'Ørn', normalized: 'orn' },
  { raw: '  Vi   Destruct  ', normalized: 'vi destruct' },
  { raw: 'ogn-253', normalized: 'ogn 253' },
  { raw: 'a+b', normalized: 'a b' },
  { raw: '100%', normalized: '100' },
  { raw: '', normalized: '' },
  { raw: '   ', normalized: '' },
  { raw: 'the', normalized: 'the' },
  { raw: 'Vi', normalized: 'vi' },
  {
    raw: `${'x'.repeat(80)} ${'y'.repeat(80)}`,
    normalized: `${'x'.repeat(80)} ${'y'.repeat(80)}`,
  },
];

export const SEARCH_HAYSTACK_CASES: readonly SearchHaystackCase[] = [
  { haystack: 'Ambessa, Matriarch of War', query: 'matriarch', expectMatch: true },
  {
    haystack: 'Ambessa, Matriarch of War',
    query: 'ambessa matriarch',
    expectMatch: true,
  },
  { haystack: 'Soul Spinner', query: 'soul spinner', expectMatch: true },
  { haystack: 'Soul Spinner', query: 'soulspinner', expectMatch: true },
  { haystack: 'Soul Spinner', query: 'spinner', expectMatch: true },
  { haystack: 'Soulspinner', query: 'soul spinner', expectMatch: true },
  { haystack: 'Vi Destructive', query: '', expectMatch: true },
  { haystack: 'Vi Destructive', query: 'the of a', expectMatch: false },
  { haystack: 'Ambessa, Matriarch of War', query: 'embessa', expectMatch: true },
  { haystack: 'Vi Destructive', query: 'embessa', expectMatch: false },
  { haystack: 'Affectionate Poro', query: 'plate', expectMatch: false },
  { haystack: 'Platewyrm Egg', query: 'plate', expectMatch: true },
  { haystack: 'Stagazer', query: 'stargazer', expectMatch: true },
  { haystack: 'Falling Star', query: 'stargazer', expectMatch: false },
  { haystack: 'OGN-001 Vi Destructive', query: 'ogn-001', expectMatch: true },
  { haystack: 'Overnumbered Signed', query: 'signed', expectMatch: true },
  { haystack: 'War of the Worlds', query: 'war worlds', expectMatch: true },
  { haystack: 'War of the Worlds', query: 'worlds war', expectMatch: true },
  { haystack: 'Ambéssa, Matriarch of War', query: 'ambessa', expectMatch: true },
  { haystack: 'Ambessa, Matriarch of War', query: 'Ambéssa', expectMatch: true },
  { haystack: 'Ambessa, Matriarch of War', query: 'Ambe\u0301ssa', expectMatch: true },
];

export const AMBESSA_LEGEND: SearchRankCard = {
  name: 'Ambessa, Matriarch of War',
  type: 'Legend',
  super: null,
  tags: ['Ambessa'],
  variantNumber: 'VEN-153',
};

export const AMBESSA_CHAMPION: SearchRankCard = {
  name: 'Ambessa, The Wolf',
  type: 'Unit',
  super: 'Champion',
  tags: ['Ambessa'],
  variantNumber: 'VEN-084',
};

export const SEARCH_RANK_CASES: readonly SearchRankCase[] = [
  {
    query: 'ambessa',
    cards: [AMBESSA_CHAMPION, AMBESSA_LEGEND],
    orderedNames: ['Ambessa, Matriarch of War', 'Ambessa, The Wolf'],
  },
  {
    query: 'stargazer',
    cards: [
      {
        name: 'Falling Star',
        type: 'Spell',
        super: null,
        tags: [],
        variantNumber: 'OGN-029',
      },
      {
        name: 'Stagazer',
        type: 'Unit',
        super: null,
        tags: [],
        variantNumber: 'VEN-098',
      },
    ],
    orderedNames: ['Stagazer', 'Falling Star'],
  },
  {
    query: 'vi',
    cards: [
      {
        name: 'Sivir, the Battle Mistress',
        type: 'Legend',
        super: null,
        tags: ['Sivir'],
        variantNumber: 'OGN-200',
      },
      {
        name: 'Viktor, Herald of the Arcane',
        type: 'Legend',
        super: null,
        tags: ['Viktor'],
        variantNumber: 'OGN-265',
      },
      {
        name: 'Vi Destructive',
        type: 'Unit',
        super: null,
        tags: ['Vi'],
        variantNumber: 'OGN-001',
      },
    ],
    orderedNames: [
      'Vi Destructive',
      'Viktor, Herald of the Arcane',
      'Sivir, the Battle Mistress',
    ],
  },
];
