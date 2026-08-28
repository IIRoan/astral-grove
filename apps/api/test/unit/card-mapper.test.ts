import { describe, expect, test } from 'bun:test';
import { PaLogicalCard } from '@riftbound/contracts';
import {
  getSearchGroupKey,
  groupCardListItems,
  mapCardDetail,
  mapListItem,
  mapListItemFromDbRow,
  mapPriceRows,
  paCardHash,
  paVariantHash,
} from '../../src/services/card-mapper.js';

const CARD_ID = '7596dc74-82bc-41ac-a25f-83f4b98ffb72';
const SET_ID = '4583bc2e-da65-492f-97dc-4876988048d7';
const VARIANT_STANDARD_ID = '0cd819d5-a03f-45d2-9e65-aec8ddae735e';
const VARIANT_FOIL_ID = '1cd819d5-a03f-45d2-9e65-aec8ddae735f';
const VARIANT_ALT_ID = '2cd819d5-a03f-45d2-9e65-aec8ddae7360';

function variant(
  id: string,
  variantNumber: string,
  variantLabel: string,
  variantType: string,
  cardmarketId: number
) {
  return {
    id,
    variantNumber,
    rarity: 'Rare',
    variantType,
    variantLabel,
    foilMode: 'None',
    variantTypes: [variantType],
    imageUrl: `https://example.com/${variantNumber}.webp`,
    showInLibrary: true,
    isCollectible: true,
    cardmarketId,
    set: { id: SET_ID, name: 'Origins', prefix: 'OGN' },
  };
}

const logical = PaLogicalCard.parse({
  id: CARD_ID,
  name: 'Vi Destructive',
  type: 'Unit',
  super: null,
  description: 'Test',
  energy: 2,
  might: 2,
  power: 2,
  tags: ['Piltover'],
  colors: [{ id: SET_ID, name: 'Body' }],
  banEffectiveDate: null,
  variants: [
    variant(VARIANT_STANDARD_ID, 'OGN-001', 'Standard', 'Standard', 100),
    variant(VARIANT_FOIL_ID, 'OGN-001-Foil', 'Foil', 'Standard', 100),
    variant(VARIANT_ALT_ID, 'OGN-001a', 'Alt Art', 'Alternate Art', 101),
  ],
});

const priceRows = [
  {
    cardmarketId: 100,
    isFoil: false,
    marketPrice: '1.25',
    lowPrice: '0.80',
    avg7Day: '1.10',
    lastUpdated: '2026-01-01',
  },
  {
    cardmarketId: 100,
    isFoil: true,
    marketPrice: '4.50',
    lowPrice: '3.00',
    avg7Day: '4.00',
    lastUpdated: '2026-01-01',
  },
];

describe('mapPriceRows', () => {
  test('filters by cardmarket id and parses decimals', () => {
    const rows = mapPriceRows(priceRows, 100);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.market).toBe(1.25);
    expect(rows[1]?.isFoil).toBe(true);
  });
});

describe('mapCardDetail', () => {
  test('maps logical card with per-variant prices', () => {
    const detail = mapCardDetail(logical, priceRows);
    expect(detail.name).toBe('Vi Destructive');
    expect(detail.variants).toHaveLength(3);
    expect(detail.variants[0]?.prices).toHaveLength(2);
    expect(detail.variants[2]?.prices).toHaveLength(0);
  });

  test('inherits cardmarket id + prices onto a -Foil SKU missing its own id', () => {
    const foilMissingId = {
      ...logical,
      variants: [
        variant(VARIANT_STANDARD_ID, 'SFD-001', 'Standard', 'Standard', 866723),
        {
          ...variant(VARIANT_FOIL_ID, 'SFD-001-Foil', 'Foil', 'Standard', 0),
          cardmarketId: null,
          foilMode: 'both',
        },
      ],
    };
    const detail = mapCardDetail(PaLogicalCard.parse(foilMissingId), [
      {
        cardmarketId: 866723,
        isFoil: false,
        marketPrice: '0.07',
        lowPrice: '0.02',
        avg7Day: '0.07',
        lastUpdated: '2026-01-01',
      },
      {
        cardmarketId: 866723,
        isFoil: true,
        marketPrice: '0.22',
        lowPrice: '0.02',
        avg7Day: '0.31',
        lastUpdated: '2026-01-01',
      },
    ]);
    const foil = detail.variants.find((v) => v.variantNumber === 'SFD-001-Foil');
    expect(foil?.cardmarketId).toBe(866723);
    expect(foil?.prices).toHaveLength(2);
    expect(foil?.prices.find((p) => p.isFoil)?.market).toBe(0.22);
  });
});

describe('mapListItemFromDbRow', () => {
  test('matches mapListItem for the same variant row', () => {
    const primary = logical.variants[0]!;
    const fromLogical = mapListItem(logical, primary, priceRows);
    const fromDb = mapListItemFromDbRow(
      {
        cardId: CARD_ID,
        name: logical.name,
        type: logical.type,
        super: logical.super ?? null,
        energy: logical.energy,
        might: logical.might,
        power: logical.power,
        banEffectiveDate: null,
        variantId: primary.id,
        variantNumber: primary.variantNumber,
        rarity: primary.rarity,
        variantType: primary.variantType,
        foilMode: primary.foilMode,
        variantLabel: primary.variantLabel,
        imageUrl: primary.imageUrl,
        cardmarketId: primary.cardmarketId ?? null,
        tcgplayerId: null,
        setCode: primary.set.prefix,
      },
      ['Body'],
      priceRows,
      (url) => url
    );
    expect(fromDb).toEqual(fromLogical);
  });
});

describe('mapListItem', () => {
  test('picks foil-aware display price for primary variant', () => {
    const standard = mapListItem(logical, logical.variants[0]!, priceRows);
    const foil = mapListItem(logical, logical.variants[1]!, priceRows);
    expect(standard.priceEur?.market).toBe(1.25);
    expect(foil.priceEur?.market).toBe(4.5);
    expect(standard.printings[0]?.isFoil).toBe(false);
    expect(foil.printings[0]?.isFoil).toBe(true);
  });

  test('synthesizes std + foil printings for foilMode=both without a sibling', () => {
    const bothOnly = variant(
      VARIANT_STANDARD_ID,
      'VEN-074',
      'Standard',
      'Standard',
      200
    );
    bothOnly.foilMode = 'both';
    const item = mapListItem({ ...logical, variants: [bothOnly] }, bothOnly, [
      {
        cardmarketId: 200,
        isFoil: false,
        marketPrice: '1.00',
        lowPrice: '0.50',
        avg7Day: '0.90',
        lastUpdated: '2026-01-01',
      },
      {
        cardmarketId: 200,
        isFoil: true,
        marketPrice: '3.00',
        lowPrice: '2.00',
        avg7Day: '2.80',
        lastUpdated: '2026-01-01',
      },
    ]);
    expect(item.printings).toHaveLength(2);
    expect(item.printings.map((p) => p.isFoil)).toEqual([false, true]);
    expect(item.printings[0]?.priceEur?.market).toBe(1);
    expect(item.printings[1]?.priceEur?.market).toBe(3);
  });

  test('marks foil_only printings as foil even when labeled Standard', () => {
    const foilOnly = variant(
      VARIANT_STANDARD_ID,
      'OGN-025',
      'Standard',
      'Standard',
      201
    );
    foilOnly.foilMode = 'foil_only';
    const item = mapListItem({ ...logical, variants: [foilOnly] }, foilOnly, []);
    expect(item.printings).toHaveLength(1);
    expect(item.printings[0]?.isFoil).toBe(true);
    expect(item.printings[0]?.variantLabel).toBe('Foil');
  });

  test('ignores zero-trend plain rows when foil guide has the real price', () => {
    const showcase = variant(
      VARIANT_ALT_ID,
      'SFD-227*',
      'Overnumbered Signed',
      'Overnumbered',
      867005
    );
    const showcaseRows = [
      {
        cardmarketId: 867005,
        isFoil: false,
        marketPrice: '0',
        lowPrice: '2499.95',
        avg7Day: null,
        lastUpdated: '2026-01-01',
      },
      {
        cardmarketId: 867005,
        isFoil: true,
        marketPrice: '2547.93',
        lowPrice: '2499.95',
        avg7Day: '2720.50',
        lastUpdated: '2026-01-01',
      },
    ];
    const item = mapListItem(
      { ...logical, variants: [showcase] },
      showcase,
      showcaseRows
    );
    expect(item.priceEur?.market).toBe(2547.93);
    expect(item.priceEur?.isFoil).toBe(true);
  });
});

describe('getSearchGroupKey', () => {
  test('groups foil with standard but keeps alternate art separate', () => {
    expect(getSearchGroupKey('OGN-001', 'Standard')).toBe('OGN-001');
    expect(getSearchGroupKey('OGN-001-Foil', 'Foil')).toBe('OGN-001');
    expect(getSearchGroupKey('SFD-R05a', 'Foil')).toBe('SFD-R05');
    expect(getSearchGroupKey('OGN-001a', 'Alt Art', 'Alternate Art')).toBe('OGN-001a');
  });
});

describe('groupCardListItems', () => {
  test('merges foil and non-foil search rows', () => {
    const standard = mapListItem(logical, logical.variants[0]!, priceRows);
    const foil = mapListItem(logical, logical.variants[1]!, priceRows);
    const grouped = groupCardListItems([standard, foil]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.printings).toHaveLength(2);
    expect(grouped[0]?.variantNumber).toBe('OGN-001');
  });

  test('splits promo and overnumbered while merging foil with standard', () => {
    const rows = logical.variants.map((entry) =>
      mapListItem(logical, entry, priceRows)
    );
    const grouped = groupCardListItems(rows);
    expect(grouped.length).toBeGreaterThan(1);
    for (const row of grouped) {
      const labels = new Set(row.printings.map((printing) => printing.variantLabel));
      const hasStandardFamily = [...labels].some(
        (label) => label === 'Standard' || /foil/i.test(label)
      );
      if (hasStandardFamily) {
        expect(
          row.printings.every(
            (printing) =>
              printing.variantLabel === 'Standard' ||
              /foil/i.test(printing.variantLabel)
          )
        ).toBe(true);
      }
    }
  });

  test('drops synthetic same-VN foil when a real -Foil sibling is present', () => {
    const std = { ...logical.variants[0]!, foilMode: 'both' };
    const foil = { ...logical.variants[1]!, foilMode: 'both' };
    const stdItem = mapListItem({ ...logical, variants: [std, foil] }, std, priceRows);
    const foilItem = mapListItem(
      { ...logical, variants: [std, foil] },
      foil,
      priceRows
    );
    expect(stdItem.printings).toHaveLength(2);

    const grouped = groupCardListItems([stdItem, foilItem]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.printings.map((p) => p.variantNumber)).toEqual([
      'OGN-001',
      'OGN-001-Foil',
    ]);
    expect(grouped[0]?.printings.filter((p) => p.isFoil)).toHaveLength(1);
  });
});

describe('entity hashes', () => {
  test('hashes upstream card and variant payloads', () => {
    expect(paCardHash(logical)).toHaveLength(64);
    expect(paVariantHash(logical.variants[0]!)).toHaveLength(64);
  });
});
