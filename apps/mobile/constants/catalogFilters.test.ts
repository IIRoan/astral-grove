import { describe, expect, test } from 'bun:test';
import {
  catalogFilterChips,
  catalogFiltersActive,
  catalogFiltersQueryKey,
  countCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  matchesCatalogFilters,
  sanitizeCatalogFilters,
} from '@/constants/catalogFilters';

const sampleCard = {
  cardId: '00000000-0000-4000-8000-000000000001',
  variantNumber: 'OGN-001',
  name: 'Sample',
  type: 'Unit',
  super: 'Champion',
  variantType: 'Standard',
  energy: 3,
  might: 3,
  power: 2,
  rarity: 'Rare',
  setCode: 'OGN',
  colors: ['Fury', 'Mind'],
  imageUrl: 'https://example.com/card.webp',
  cardmarketId: null,
  priceEur: null,
  printings: [
    {
      variantNumber: 'OGN-001',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
    {
      variantNumber: 'OGN-001*',
      variantLabel: 'Standard',
      isFoil: true,
      priceEur: null,
    },
  ],
  isBanned: false,
};

const dualColorLegend = {
  ...sampleCard,
  type: 'Legend',
  colors: ['Body', 'Calm'],
};

describe('matchesCatalogFilters', () => {
  test('default filters pass every row', () => {
    expect(matchesCatalogFilters(sampleCard, DEFAULT_CATALOG_FILTERS, new Map())).toBe(
      true
    );
  });

  test('color filter includes cards with extra domains', () => {
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, colors: ['Fury'] },
        new Map()
      )
    ).toBe(true);
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, colors: ['Calm'] },
        new Map()
      )
    ).toBe(false);
    expect(
      matchesCatalogFilters(
        dualColorLegend,
        { ...DEFAULT_CATALOG_FILTERS, colors: ['Body'] },
        new Map()
      )
    ).toBe(true);
    expect(
      matchesCatalogFilters(
        dualColorLegend,
        { ...DEFAULT_CATALOG_FILTERS, colors: ['Body', 'Calm'] },
        new Map()
      )
    ).toBe(true);
  });

  test('within color mode matches deck domain identity', () => {
    const mindOnly = { ...sampleCard, colors: ['Mind'] };
    const mindOrder = { ...sampleCard, colors: ['Mind', 'Order'] };
    const fury = { ...sampleCard, colors: ['Fury'] };
    const colorless = { ...sampleCard, colors: [] };
    const identity = { ...DEFAULT_CATALOG_FILTERS, colors: ['Mind', 'Order'] };

    expect(
      matchesCatalogFilters(mindOnly, identity, new Map(), { colorMode: 'within' })
    ).toBe(true);
    expect(
      matchesCatalogFilters(mindOrder, identity, new Map(), { colorMode: 'within' })
    ).toBe(true);
    expect(
      matchesCatalogFilters(colorless, identity, new Map(), { colorMode: 'within' })
    ).toBe(true);
    expect(
      matchesCatalogFilters(fury, identity, new Map(), { colorMode: 'within' })
    ).toBe(false);
    // Default search mode still requires all selected colors.
    expect(matchesCatalogFilters(mindOnly, identity, new Map())).toBe(false);
  });

  test('type, rarity, and stat filters use exact match', () => {
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, types: ['Unit'] },
        new Map()
      )
    ).toBe(true);
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, types: ['Spell'] },
        new Map()
      )
    ).toBe(false);
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, rarities: ['Rare'] },
        new Map()
      )
    ).toBe(true);
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, energy: 3 },
        new Map()
      )
    ).toBe(true);
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, energy: 4 },
        new Map()
      )
    ).toBe(false);
  });

  test('owned filter sums quantities across printings', () => {
    const collection = new Map([
      ['OGN-001', { quantity: 0 }],
      ['OGN-001*', { quantity: 2 }],
    ]);
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, collection: 'owned' },
        collection
      )
    ).toBe(true);
  });

  test('token filters distinguish markers from playable cards', () => {
    const tokenCard = { ...sampleCard, type: 'Card', variantNumber: 'OGN-001-T1' };
    expect(
      matchesCatalogFilters(
        tokenCard,
        { ...DEFAULT_CATALOG_FILTERS, excludeTokens: true },
        new Map()
      )
    ).toBe(false);
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, tokensOnly: true },
        new Map()
      )
    ).toBe(false);
    expect(
      matchesCatalogFilters(
        tokenCard,
        { ...DEFAULT_CATALOG_FILTERS, tokensOnly: true },
        new Map()
      )
    ).toBe(true);
  });

  test('simple add does not change which cards match', () => {
    expect(
      matchesCatalogFilters(
        sampleCard,
        { ...DEFAULT_CATALOG_FILTERS, simpleAdd: true },
        new Map()
      )
    ).toBe(true);
  });
});

describe('simple add preference', () => {
  test('sanitize coerces simpleAdd to a boolean', () => {
    expect(
      sanitizeCatalogFilters({ ...DEFAULT_CATALOG_FILTERS, simpleAdd: true }).simpleAdd
    ).toBe(true);
    expect(
      sanitizeCatalogFilters({ ...DEFAULT_CATALOG_FILTERS, simpleAdd: false }).simpleAdd
    ).toBe(false);
  });

  test('simple add is a toolbar preference, not an active filter', () => {
    const filters = { ...DEFAULT_CATALOG_FILTERS, simpleAdd: true };
    expect(catalogFiltersActive(filters)).toBe(false);
    expect(countCatalogFilters(filters)).toBe(0);
    expect(catalogFilterChips(filters)).toEqual([]);
  });

  test('query key ignores simpleAdd so result caches stay stable', () => {
    expect(
      catalogFiltersQueryKey({ ...DEFAULT_CATALOG_FILTERS, simpleAdd: true })
    ).toBe(catalogFiltersQueryKey(DEFAULT_CATALOG_FILTERS));
  });
});

describe('countCatalogFilters', () => {
  test('counts each selected color and token toggle', () => {
    expect(
      countCatalogFilters({
        ...DEFAULT_CATALOG_FILTERS,
        colors: ['Calm', 'Chaos'],
        excludeTokens: true,
      })
    ).toBe(3);
  });
});
