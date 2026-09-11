import { describe, expect, test } from 'bun:test';
import type { CardListItem } from '@riftbound/contracts';
import { DEFAULT_CATALOG_SORT } from '@/constants/catalogSort';
import {
  featuredCatalogItems,
  searchCatalogItems,
  sortCatalogItems,
  tokenizeSearchQuery,
} from '@/utils/catalogSearch';

const vi = {
  cardId: '00000000-0000-0000-0000-000000000001',
  variantNumber: 'OGN-001',
  name: 'Vi Destructive',
  type: 'Unit',
  energy: 2,
  might: 2,
  power: 2,
  rarity: 'Rare',
  setCode: 'OGN',
  colors: ['Body'],
  imageUrl: 'https://example.com/vi.jpg',
  cardmarketId: null,
  priceEur: { currency: 'EUR' as const, low: 1, market: 2, avg7d: null, isFoil: false },
  printings: [
    {
      variantNumber: 'OGN-001',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: {
        currency: 'EUR' as const,
        low: 1,
        market: 2,
        avg7d: null,
        isFoil: false,
      },
    },
  ],
  isBanned: false,
} satisfies CardListItem;

const jinx = {
  ...vi,
  cardId: '00000000-0000-0000-0000-000000000002',
  variantNumber: 'OGN-002',
  name: 'Jinx Rebel',
  energy: 4,
  priceEur: {
    currency: 'EUR' as const,
    low: 5,
    market: 10,
    avg7d: null,
    isFoil: false,
  },
  printings: [
    {
      variantNumber: 'OGN-002',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: {
        currency: 'EUR' as const,
        low: 5,
        market: 10,
        avg7d: null,
        isFoil: false,
      },
    },
  ],
} satisfies CardListItem;

const ekko = {
  ...vi,
  cardId: '00000000-0000-0000-0000-000000000003',
  variantNumber: 'SFD-010',
  name: 'Ekko Recurve',
  setCode: 'SFD',
  colors: ['Mind'],
  priceEur: null,
  printings: [
    {
      variantNumber: 'SFD-010',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
  ],
} satisfies CardListItem;

const catalog = [vi, jinx, ekko];

const ambessaLegend = {
  ...vi,
  cardId: '00000000-0000-0000-0000-000000000153',
  variantNumber: 'VEN-153',
  name: 'Ambessa, Matriarch of War',
  type: 'Legend',
  setCode: 'VEN',
  printings: [
    {
      variantNumber: 'VEN-153',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
  ],
} satisfies CardListItem;

const ambessaChampion = {
  ...ambessaLegend,
  cardId: '00000000-0000-0000-0000-000000000084',
  variantNumber: 'VEN-084',
  name: 'Ambessa, The Wolf',
  type: 'Unit',
  super: 'Champion',
  printings: [
    {
      variantNumber: 'VEN-084',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
  ],
} satisfies CardListItem;

const hungryWolf = {
  ...ambessaLegend,
  cardId: '00000000-0000-0000-0000-000000000125',
  variantNumber: 'VEN-125',
  name: 'Hungry Wolf',
  type: 'Unit',
  printings: [
    {
      variantNumber: 'VEN-125',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
  ],
} satisfies CardListItem;

describe('catalogSearch', () => {
  test('tokenizeSearchQuery splits on whitespace', () => {
    expect(tokenizeSearchQuery('  vi   destruct  ')).toEqual(['vi', 'destruct']);
  });

  test('tokenizeSearchQuery returns empty for blank input', () => {
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });

  test('searchCatalogItems ranks Stagazer first for the query stargazer', () => {
    const fallingStar = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000029',
      variantNumber: 'OGN-029',
      name: 'Falling Star',
      type: 'Spell',
    } satisfies CardListItem;
    const stagazer = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000098',
      variantNumber: 'VEN-098',
      name: 'Stagazer',
      type: 'Unit',
    } satisfies CardListItem;
    const results = searchCatalogItems(
      [fallingStar, stagazer],
      'stargazer',
      DEFAULT_CATALOG_SORT,
      10
    );
    expect(results[0]?.name).toBe('Stagazer');
    expect(results.map((card) => card.name)).toEqual(['Stagazer']);
  });

  test('searchCatalogItems matches the Ambessa legend from the typo embessa', () => {
    const results = searchCatalogItems(
      [hungryWolf, ambessaChampion, ambessaLegend],
      'embessa',
      DEFAULT_CATALOG_SORT,
      10
    );
    expect(results[0]?.variantNumber).toBe('VEN-153');
    expect(results.map((card) => card.name)).toEqual(
      expect.arrayContaining(['Ambessa, Matriarch of War'])
    );
  });

  test('searchCatalogItems ranks Ambessa legend ahead of the champion unit', () => {
    const results = searchCatalogItems(
      [hungryWolf, ambessaChampion, ambessaLegend],
      'ambessa',
      DEFAULT_CATALOG_SORT,
      10
    );
    expect(results.map((card) => card.variantNumber)).toEqual(['VEN-153', 'VEN-084']);
  });

  test('searchCatalogItems matches a second title word and type intent', () => {
    const pool = [hungryWolf, ambessaChampion, ambessaLegend];
    expect(
      searchCatalogItems(pool, 'matriarch', DEFAULT_CATALOG_SORT, 10).map(
        (card) => card.variantNumber
      )
    ).toEqual(['VEN-153']);
    expect(
      searchCatalogItems(pool, 'ambessa matriarch', DEFAULT_CATALOG_SORT, 10).map(
        (card) => card.variantNumber
      )
    ).toEqual(['VEN-153']);
    expect(
      searchCatalogItems(pool, 'ambessa legend', DEFAULT_CATALOG_SORT, 10).map(
        (card) => card.variantNumber
      )
    ).toEqual(['VEN-153']);
  });

  test('searchCatalogItems matches spinner as the second word of Soul Spinner', () => {
    const spinner = {
      ...vi,
      name: 'Soul Spinner',
      variantNumber: 'OGN-010',
    } satisfies CardListItem;
    expect(
      searchCatalogItems([spinner, jinx], 'spinner', DEFAULT_CATALOG_SORT, 10).map(
        (card) => card.name
      )
    ).toEqual(['Soul Spinner']);
    expect(
      searchCatalogItems([spinner], 'soulspinner', DEFAULT_CATALOG_SORT, 10)
    ).toHaveLength(1);
  });

  test('searchCatalogItems prefers prefix name matches', () => {
    const results = searchCatalogItems(catalog, 'vi', DEFAULT_CATALOG_SORT, 10);
    expect(results.map((card) => card.name)).toEqual(['Vi Destructive']);
  });

  test('searchCatalogItems ranks Vi ahead of Viktor and Sivir', () => {
    const viktor = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000265',
      variantNumber: 'OGN-265',
      name: 'Viktor, Herald of the Arcane',
      type: 'Legend',
    } satisfies CardListItem;
    const sivir = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000200',
      variantNumber: 'OGN-200',
      name: 'Sivir, the Battle Mistress',
      type: 'Legend',
    } satisfies CardListItem;
    expect(
      searchCatalogItems([sivir, viktor, vi], 'vi', DEFAULT_CATALOG_SORT, 10).map(
        (card) => card.name
      )
    ).toEqual([
      'Vi Destructive',
      'Viktor, Herald of the Arcane',
      'Sivir, the Battle Mistress',
    ]);
  });

  test('searchCatalogItems keeps plate name hits and drops letter-scrap noise', () => {
    const platewyrm = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000075',
      variantNumber: 'VEN-075',
      name: 'Platewyrm Egg',
      type: 'Gear',
    } satisfies CardListItem;
    const hexplate = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000073',
      variantNumber: 'SFD-073',
      name: 'Experimental Hexplate',
      type: 'Gear',
    } satisfies CardListItem;
    const poro = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000024',
      variantNumber: 'VEN-024',
      name: 'Affectionate Poro',
      type: 'Unit',
    } satisfies CardListItem;
    expect(
      searchCatalogItems(
        [poro, hexplate, platewyrm],
        'plate',
        DEFAULT_CATALOG_SORT,
        10
      ).map((card) => card.name)
    ).toEqual(['Platewyrm Egg', 'Experimental Hexplate']);
  });

  test('searchCatalogItems matches variant numbers and set codes', () => {
    expect(
      searchCatalogItems(catalog, 'ogn-001', DEFAULT_CATALOG_SORT, 10)
    ).toHaveLength(1);
    expect(searchCatalogItems(catalog, 'sfd', DEFAULT_CATALOG_SORT, 10)).toHaveLength(
      1
    );
  });

  test('searchCatalogItems requires all tokens', () => {
    expect(searchCatalogItems(catalog, 'vi rebel', DEFAULT_CATALOG_SORT, 10)).toEqual(
      []
    );
    expect(
      searchCatalogItems(catalog, 'jinx rebel', DEFAULT_CATALOG_SORT, 10)
    ).toHaveLength(1);
  });

  test('searchCatalogItems respects limit', () => {
    expect(searchCatalogItems(catalog, 'o', DEFAULT_CATALOG_SORT, 2)).toHaveLength(2);
  });

  test('searchCatalogItems sorts by energy when requested', () => {
    const results = searchCatalogItems(
      catalog,
      'o',
      { sortBy: 'energy', dir: 'desc' },
      10
    );
    expect(results.map((card) => card.name)).toEqual([
      'Jinx Rebel',
      'Vi Destructive',
      'Ekko Recurve',
    ]);
  });

  test('searchCatalogItems matches color names', () => {
    expect(searchCatalogItems(catalog, 'mind', DEFAULT_CATALOG_SORT, 10)).toHaveLength(
      1
    );
    expect(searchCatalogItems(catalog, 'mind', DEFAULT_CATALOG_SORT, 10)[0]?.name).toBe(
      'Ekko Recurve'
    );
  });

  test('searchCatalogItems matches Overnumbered Signed labels', () => {
    const signedAkali = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000099',
      variantNumber: 'VEN-189*',
      name: 'Akali, Rogue Assassin',
      variantType: 'Overnumbered',
      printings: [
        {
          variantNumber: 'VEN-189*',
          variantLabel: 'Overnumbered Signed',
          isFoil: true,
          priceEur: null,
        },
      ],
    } satisfies CardListItem;

    const results = searchCatalogItems(
      [...catalog, signedAkali],
      'signed',
      DEFAULT_CATALOG_SORT,
      10
    );
    expect(results.map((card) => card.variantNumber)).toEqual(['VEN-189*']);
  });

  test('searchCatalogItems returns empty for blank query', () => {
    expect(searchCatalogItems(catalog, '   ', DEFAULT_CATALOG_SORT, 10)).toEqual([]);
  });

  test('featuredCatalogItems sorts by market price', () => {
    expect(featuredCatalogItems(catalog).map((card) => card.name)).toEqual([
      'Jinx Rebel',
      'Vi Destructive',
      'Ekko Recurve',
    ]);
  });

  test('featuredCatalogItems ranks by the highest printing price on a card', () => {
    const ahri = {
      ...vi,
      name: 'Ahri, Inquisitive',
      variantNumber: 'OGN-119',
      priceEur: {
        currency: 'EUR' as const,
        low: 1,
        market: 5,
        avg7d: null,
        isFoil: false,
      },
      printings: [
        {
          variantNumber: 'OGN-119',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: {
            currency: 'EUR' as const,
            low: 1,
            market: 5,
            avg7d: null,
            isFoil: false,
          },
        },
        {
          variantNumber: 'SFD-227*',
          variantLabel: 'Showcase',
          isFoil: false,
          priceEur: {
            currency: 'EUR' as const,
            low: 2499.95,
            market: 2547.93,
            avg7d: null,
            isFoil: true,
          },
        },
      ],
    } satisfies CardListItem;

    expect(featuredCatalogItems([vi, jinx, ahri]).map((card) => card.name)).toEqual([
      'Ahri, Inquisitive',
      'Jinx Rebel',
      'Vi Destructive',
    ]);
  });

  test('featuredCatalogItems respects limit', () => {
    expect(featuredCatalogItems(catalog, 2)).toHaveLength(2);
  });

  test('sortCatalogItems orders the full catalog by price high to low', () => {
    const alpha = {
      ...vi,
      name: 'Alpha Cheap',
      variantNumber: 'OGN-100',
      priceEur: {
        currency: 'EUR' as const,
        low: 0.1,
        market: 0.2,
        avg7d: null,
        isFoil: false,
      },
      printings: [
        {
          variantNumber: 'OGN-100',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: {
            currency: 'EUR' as const,
            low: 0.1,
            market: 0.2,
            avg7d: null,
            isFoil: false,
          },
        },
      ],
    } satisfies CardListItem;

    const zeta = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000010',
      name: 'Zeta Pricey',
      variantNumber: 'OGN-999',
      priceEur: {
        currency: 'EUR' as const,
        low: 90,
        market: 100,
        avg7d: null,
        isFoil: false,
      },
      printings: [
        {
          variantNumber: 'OGN-999',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: {
            currency: 'EUR' as const,
            low: 90,
            market: 100,
            avg7d: null,
            isFoil: false,
          },
        },
      ],
    } satisfies CardListItem;

    const mixed = [alpha, zeta, jinx, ekko];
    expect(
      sortCatalogItems(mixed, { sortBy: 'price', dir: 'desc' }).map((card) => card.name)
    ).toEqual(['Zeta Pricey', 'Jinx Rebel', 'Alpha Cheap', 'Ekko Recurve']);
  });

  test('sortCatalogItems price order differs from alphabetical first page', () => {
    const alpha = {
      ...vi,
      name: 'Alpha Cheap',
      variantNumber: 'OGN-100',
      priceEur: {
        currency: 'EUR' as const,
        low: 0.1,
        market: 0.2,
        avg7d: null,
        isFoil: false,
      },
      printings: [
        {
          variantNumber: 'OGN-100',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: {
            currency: 'EUR' as const,
            low: 0.1,
            market: 0.2,
            avg7d: null,
            isFoil: false,
          },
        },
      ],
    } satisfies CardListItem;

    const zeta = {
      ...vi,
      cardId: '00000000-0000-0000-0000-000000000010',
      name: 'Zeta Pricey',
      variantNumber: 'OGN-999',
      priceEur: {
        currency: 'EUR' as const,
        low: 90,
        market: 100,
        avg7d: null,
        isFoil: false,
      },
      printings: [
        {
          variantNumber: 'OGN-999',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: {
            currency: 'EUR' as const,
            low: 90,
            market: 100,
            avg7d: null,
            isFoil: false,
          },
        },
      ],
    } satisfies CardListItem;

    const mixed = [alpha, zeta, jinx];
    expect(
      sortCatalogItems(mixed, DEFAULT_CATALOG_SORT, 2).map((card) => card.name)
    ).toEqual(['Alpha Cheap', 'Jinx Rebel']);
    expect(
      sortCatalogItems(mixed, { sortBy: 'price', dir: 'desc' }, 2).map(
        (card) => card.name
      )
    ).toEqual(['Zeta Pricey', 'Jinx Rebel']);
  });

  test('sortCatalogItems orders by price low to high', () => {
    expect(
      sortCatalogItems(catalog, { sortBy: 'price', dir: 'asc' }).map(
        (card) => card.name
      )
    ).toEqual(['Ekko Recurve', 'Vi Destructive', 'Jinx Rebel']);
  });

  test('searchCatalogItems sorts matches by price across the full result set', () => {
    const results = searchCatalogItems(catalog, 'o', { sortBy: 'price', dir: 'desc' });
    expect(results.map((card) => card.name)).toEqual([
      'Jinx Rebel',
      'Vi Destructive',
      'Ekko Recurve',
    ]);
  });

  test('searchCatalogItems scans a large pool within a tight latency budget', () => {
    const pool: CardListItem[] = [];
    for (let i = 0; i < 2500; i++) {
      pool.push({
        ...vi,
        cardId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
        variantNumber: `OGN-${String(i).padStart(3, '0')}`,
        name: i % 17 === 0 ? 'Stagazer' : `Card ${i}`,
      });
    }
    const start = performance.now();
    const results = searchCatalogItems(pool, 'stargazer', DEFAULT_CATALOG_SORT, 20);
    const elapsed = performance.now() - start;
    expect(results[0]?.name).toBe('Stagazer');
    expect(elapsed).toBeLessThan(250);
  });
});
