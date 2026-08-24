import { describe, expect, test } from 'bun:test';
import {
  formatListPrice,
  formatPrintingPrice,
  getSearchGroupKey,
  getSearchGroupVariants,
  getVariantFamiliesFromPrintings,
  getVariantMarketPriceDisplays,
  getPrintingsInSearchGroup,
  groupCardListItems,
  pickVariantDisplayPrice,
  totalOwnedForCard,
  ownedQuantityForPrinting,
  expandVariantFinishPrintings,
} from '@/utils/variants';
import type { CardListItem } from '@riftbound/contracts';

function listCard(
  partial: Partial<CardListItem> & Pick<CardListItem, 'variantNumber' | 'printings'>
): CardListItem {
  return {
    cardId: 'c1',
    name: 'Test',
    type: 'Unit',
    energy: 1,
    might: 1,
    power: 0,
    rarity: 'Common',
    setCode: 'OGN',
    colors: ['Body'],
    imageUrl: '',
    cardmarketId: 1,
    priceEur: null,
    isBanned: false,
    ...partial,
  };
}

describe('getSearchGroupVariants', () => {
  const dariusVariants = [
    { variantNumber: 'OGN-253', variantLabel: 'Standard', variantType: 'standard' },
    { variantNumber: 'OGN-253-Foil', variantLabel: 'Standard', variantType: 'foil' },
    {
      variantNumber: 'OGN-253-Release',
      variantLabel: 'Release Event Promo',
      variantType: 'promo',
    },
    {
      variantNumber: 'OGN-302',
      variantLabel: 'Overnumbered',
      variantType: 'overnumbered',
    },
    {
      variantNumber: 'OGN-302*',
      variantLabel: 'Overnumbered Signed',
      variantType: 'signed',
    },
  ];

  test('standard Darius detail shows only foil and non-foil standard printings', () => {
    const anchor = dariusVariants[0]!;
    const group = getSearchGroupVariants(dariusVariants, anchor);

    expect(group.map((v) => v.variantNumber)).toEqual(['OGN-253', 'OGN-253-Foil']);
  });

  test('release promo detail excludes other variant types', () => {
    const anchor = dariusVariants[2]!;
    const group = getSearchGroupVariants(dariusVariants, anchor);

    expect(group.map((v) => v.variantNumber)).toEqual(['OGN-253-Release']);
  });

  test('overnumbered detail excludes standard and signed rows', () => {
    const anchor = dariusVariants[3]!;
    const group = getSearchGroupVariants(dariusVariants, anchor);

    expect(group.map((v) => v.variantNumber)).toEqual(['OGN-302']);
  });

  test('getSearchGroupKey treats foil suffix as same group as standard', () => {
    expect(getSearchGroupKey('OGN-253', 'Standard')).toBe('OGN-253');
    expect(getSearchGroupKey('OGN-253-Foil', 'Standard', 'foil')).toBe('OGN-253');
    expect(getSearchGroupKey('OGN-253-Release', 'Release Event Promo')).toBe(
      'OGN-253-Release'
    );
  });

  test('getSearchGroupKey groups rune-style foil siblings with their base printing', () => {
    expect(getSearchGroupKey('SFD-R05', 'Standard')).toBe('SFD-R05');
    expect(getSearchGroupKey('SFD-R05a', 'Foil')).toBe('SFD-R05');
  });
});

describe('pickVariantDisplayPrice', () => {
  test('falls back to foil guide for foil-only signed printings', () => {
    const row = pickVariantDisplayPrice(
      [{ market: 2547.93, low: 2499.95, isFoil: true }],
      {
        variantNumber: 'SFD-227*',
        variantLabel: 'Showcase',
        variantType: 'Overnumbered Signed',
      }
    );
    expect(row?.market).toBe(2547.93);
  });
});

describe('getVariantMarketPriceDisplays', () => {
  test('shows only the non-foil price for a single-finish showcase printing', () => {
    const rows = getVariantMarketPriceDisplays({
      variantNumber: 'OGN-302*',
      variantLabel: 'Overnumbered Signed',
      variantType: 'signed',
      prices: [
        { market: 325, low: 300, isFoil: false },
        { market: 378.34, low: 350, isFoil: true },
      ],
    });

    expect(rows).toEqual([{ label: 'Overnumbered Signed', price: '€325.00' }]);
  });

  test('shows only the foil price for a foil-only promo', () => {
    const rows = getVariantMarketPriceDisplays({
      variantNumber: 'ARC-002',
      variantLabel: 'Arcane Box Promo Foil',
      variantType: 'foil',
      prices: [
        { market: 45.43, low: 40, isFoil: true },
        { market: 30, low: 28, isFoil: false },
      ],
    });

    expect(rows).toEqual([{ label: 'Arcane Box Promo Foil', price: '€45.43' }]);
  });
});

describe('groupCardListItems', () => {
  test('merges foil and non-foil search rows', () => {
    expect(
      groupCardListItems([
        {
          cardId: 'c1',
          variantNumber: 'OGN-253',
          name: 'Darius',
          type: 'Unit',
          energy: 5,
          might: 5,
          power: 0,
          rarity: 'Rare',
          setCode: 'OGN',
          colors: ['Body'],
          imageUrl: '',
          cardmarketId: 1,
          priceEur: null,
          printings: [
            {
              variantNumber: 'OGN-253',
              variantLabel: 'Standard',
              isFoil: false,
              priceEur: null,
            },
          ],
          isBanned: false,
        },
        {
          cardId: 'c1',
          variantNumber: 'OGN-253-Foil',
          name: 'Darius',
          type: 'Unit',
          energy: 5,
          might: 5,
          power: 0,
          rarity: 'Rare',
          setCode: 'OGN',
          colors: ['Body'],
          imageUrl: '',
          cardmarketId: 1,
          priceEur: null,
          printings: [
            {
              variantNumber: 'OGN-253-Foil',
              variantLabel: 'Standard',
              isFoil: true,
              priceEur: null,
            },
          ],
          isBanned: false,
        },
      ])
    ).toHaveLength(1);
  });

  test('splits a catalog-grouped card so alternate printings are separate rows', () => {
    const grouped = groupCardListItems([
      {
        cardId: 'c1',
        variantNumber: 'OGN-253',
        name: 'Darius',
        type: 'Unit',
        energy: 5,
        might: 5,
        power: 0,
        rarity: 'Rare',
        setCode: 'OGN',
        colors: ['Body'],
        imageUrl: '',
        cardmarketId: 1,
        priceEur: { currency: 'EUR', low: 1, market: 2, avg7d: 2, isFoil: false },
        printings: [
          {
            variantNumber: 'OGN-253',
            variantLabel: 'Standard',
            isFoil: false,
            priceEur: { currency: 'EUR', low: 1, market: 2, avg7d: 2, isFoil: false },
          },
          {
            variantNumber: 'OGN-253-Foil',
            variantLabel: 'Standard',
            isFoil: true,
            priceEur: { currency: 'EUR', low: 3, market: 4, avg7d: 4, isFoil: true },
          },
          {
            variantNumber: 'OGN-253-Release',
            variantLabel: 'Release Event Promo',
            isFoil: false,
            priceEur: { currency: 'EUR', low: 5, market: 6, avg7d: 6, isFoil: false },
          },
          {
            variantNumber: 'OGN-302',
            variantLabel: 'Overnumbered',
            isFoil: false,
            priceEur: {
              currency: 'EUR',
              low: 10,
              market: 12,
              avg7d: 12,
              isFoil: false,
            },
          },
        ],
        isBanned: false,
      },
    ]);

    expect(grouped.map((row) => row.variantNumber).sort()).toEqual([
      'OGN-253',
      'OGN-253-Release',
      'OGN-302',
    ]);
    expect(
      grouped.find((row) => row.variantNumber === 'OGN-253')?.printings
    ).toHaveLength(2);
  });
});

describe('getVariantFamiliesFromPrintings', () => {
  const daringPoroPrintings = [
    {
      variantNumber: 'OGN-210',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
    {
      variantNumber: 'OGN-210-Foil',
      variantLabel: 'Standard',
      isFoil: true,
      priceEur: null,
    },
    {
      variantNumber: 'OGN-210-Nexus',
      variantLabel: 'Nexus Night Promo',
      isFoil: false,
      priceEur: null,
    },
    {
      variantNumber: 'OGN-210-ON',
      variantLabel: 'Overnumbered',
      isFoil: false,
      priceEur: null,
    },
  ];

  test('groups catalog printings into std/foil families', () => {
    const families = getVariantFamiliesFromPrintings(daringPoroPrintings);

    expect(families.map((family) => family.label)).toEqual([
      'Standard',
      'Nexus Night Promo',
      'Overnumbered',
    ]);
    expect(families[0]?.variants.map((p) => p.variantNumber)).toEqual([
      'OGN-210',
      'OGN-210-Foil',
    ]);
  });

  test('getPrintingsInSearchGroup returns only the active family', () => {
    const scoped = getPrintingsInSearchGroup(daringPoroPrintings, 'OGN-210-ON');

    expect(scoped.map((p) => p.variantNumber)).toEqual(['OGN-210-ON']);
  });
});

describe('formatListPrice / totalOwnedForCard', () => {
  const stdFoilCard = listCard({
    variantNumber: 'OGN-015',
    priceEur: { currency: 'EUR', low: 0.05, market: 0.1, avg7d: 0.1, isFoil: false },
    printings: [
      {
        variantNumber: 'OGN-015',
        variantLabel: 'Standard',
        isFoil: false,
        priceEur: {
          currency: 'EUR',
          low: 0.05,
          market: 0.1,
          avg7d: 0.1,
          isFoil: false,
        },
      },
      {
        variantNumber: 'OGN-015-Foil',
        variantLabel: 'Standard',
        isFoil: true,
        priceEur: { currency: 'EUR', low: 0.2, market: 0.4, avg7d: 0.4, isFoil: true },
      },
    ],
  });

  test('formatListPrice ranges std and foil finishes only', () => {
    expect(formatListPrice(stdFoilCard)).toBe('€0.10–0.40');
  });

  test('formatListPrice ignores alternate-art printings not on the row', () => {
    const standardOnly = listCard({
      variantNumber: 'OGN-253',
      priceEur: { currency: 'EUR', low: 1, market: 2, avg7d: 2, isFoil: false },
      printings: [
        {
          variantNumber: 'OGN-253',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: { currency: 'EUR', low: 1, market: 2, avg7d: 2, isFoil: false },
        },
      ],
    });
    expect(formatListPrice(standardOnly)).toBe('€2.00');
    expect(formatPrintingPrice(standardOnly.printings[0]?.priceEur ?? null)).toBe(
      '€2.00'
    );
  });

  test('totalOwnedForCard sums only printings on the scoped row', () => {
    const ownership = new Map([
      ['OGN-015', { quantity: 2 }],
      ['OGN-015-Foil', { quantity: 1 }],
      ['OGN-999', { quantity: 9 }],
    ]);
    expect(totalOwnedForCard(stdFoilCard, ownership)).toBe(3);
  });

  test('totalOwnedForCard uses finish keys without double-counting aggregate VN totals', () => {
    const bothCard = listCard({
      variantNumber: 'VEN-074',
      printings: [
        {
          variantNumber: 'VEN-074',
          variantLabel: 'Standard',
          isFoil: false,
          foilMode: 'both',
          priceEur: null,
        },
        {
          variantNumber: 'VEN-074',
          variantLabel: 'Foil',
          isFoil: true,
          foilMode: 'both',
          priceEur: null,
        },
      ],
    });
    const ownership = new Map([
      ['VEN-074::std', { quantity: 2 }],
      ['VEN-074', { quantity: 2 }],
    ]);
    expect(ownedQuantityForPrinting(ownership, bothCard.printings[0]!)).toBe(2);
    expect(ownedQuantityForPrinting(ownership, bothCard.printings[1]!)).toBe(0);
    expect(totalOwnedForCard(bothCard, ownership)).toBe(2);
  });

  test('totalOwnedForCard is zero when ownership map is missing', () => {
    expect(totalOwnedForCard(stdFoilCard)).toBe(0);
  });
});

describe('expandVariantFinishPrintings', () => {
  test('expands foilMode=both into standard and foil finishes', () => {
    const printings = expandVariantFinishPrintings([
      {
        variantNumber: 'VEN-074',
        variantLabel: 'Standard',
        variantType: 'Standard',
        foilMode: 'both',
      },
    ]);
    expect(printings.map((p) => ({ vn: p.variantNumber, foil: p.isFoil }))).toEqual([
      { vn: 'VEN-074', foil: false },
      { vn: 'VEN-074', foil: true },
    ]);
  });

  test('marks foil_only as a single foil printing', () => {
    const printings = expandVariantFinishPrintings([
      {
        variantNumber: 'OGN-025',
        variantLabel: 'Standard',
        variantType: 'Standard',
        foilMode: 'foil_only',
      },
    ]);
    expect(printings).toHaveLength(1);
    expect(printings[0]?.isFoil).toBe(true);
    expect(printings[0]?.variantLabel).toBe('Foil');
  });

  test('keeps distinct foil sibling instead of synthesizing a same-VN foil', () => {
    const printings = expandVariantFinishPrintings([
      {
        variantNumber: 'OGN-015',
        variantLabel: 'Standard',
        variantType: 'Standard',
        foilMode: 'both',
      },
      {
        variantNumber: 'OGN-015-Foil',
        variantLabel: 'Foil',
        variantType: 'Standard',
        foilMode: 'both',
      },
    ]);
    expect(printings.map((p) => p.variantNumber)).toEqual(['OGN-015', 'OGN-015-Foil']);
    expect(printings.every((p) => p.variantNumber !== 'OGN-015' || !p.isFoil)).toBe(
      true
    );
  });
});

describe('pickVariantDisplayPrice foil/showcase rules', () => {
  test('prefers matching non-foil guide when both finishes exist', () => {
    const row = pickVariantDisplayPrice(
      [
        { market: 2, low: 1, isFoil: false },
        { market: 8, low: 7, isFoil: true },
      ],
      { variantNumber: 'OGN-015', variantLabel: 'Standard', variantType: 'Standard' }
    );
    expect(row?.market).toBe(2);
    expect(row?.isFoil).toBe(false);
  });

  test('prefers matching foil guide for foil printings', () => {
    const row = pickVariantDisplayPrice(
      [
        { market: 2, low: 1, isFoil: false },
        { market: 8, low: 7, isFoil: true },
      ],
      { variantNumber: 'OGN-015-Foil', variantLabel: 'Foil', variantType: 'Standard' }
    );
    expect(row?.market).toBe(8);
    expect(row?.isFoil).toBe(true);
  });

  test('ignores zero-market plain rows when foil has the real trend', () => {
    const row = pickVariantDisplayPrice(
      [
        { market: 0, low: 0.01, isFoil: false },
        { market: 12.5, low: 10, isFoil: true },
      ],
      { variantNumber: 'OGN-302*', variantLabel: 'Showcase', variantType: 'signed' }
    );
    expect(row?.market).toBe(12.5);
  });
});
