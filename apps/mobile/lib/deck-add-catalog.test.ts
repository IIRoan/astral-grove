import { describe, expect, test } from 'bun:test';
import type { CardDetail, CardListItem } from '@riftbound/contracts';
import type { DeckCard } from './deck-types';
import { createEmptyDeck } from './deck-card';
import {
  buildDeckAddCandidates,
  buildDeckAddListQuery,
  defaultDeckAddCatalogFilters,
  defaultDeckAddSearch,
  deckAddListQueryKey,
  effectiveDeckAddSearch,
  filterDeckAddDisplayCards,
  filterEligibleDeckAddCards,
  legendNeedsHydration,
  uniqueCardListItems,
} from './deck-add-catalog';
import { DEFAULT_CATALOG_FILTERS } from '@/constants/catalogFilters';

function mockDeckCard(overrides: Partial<DeckCard> & Pick<DeckCard, 'name'>): DeckCard {
  return {
    cardId: `id-${overrides.name}`,
    variantNumber: 'OGN-001',
    type: 'Unit',
    super: null,
    tags: [],
    colors: ['Body'],
    energy: 2,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
    imageUrl: null,
    ...overrides,
  };
}

const settLegend = mockDeckCard({
  name: 'Sett, The Boss',
  type: 'Legend',
  tags: ['Sett'],
  colors: ['Body', 'Order'],
  variantNumber: 'OGN-269',
});

const settBrawlerDetail: CardDetail = {
  id: 'e5453c50-e64f-41a1-a3fb-e9ecd37f52b6',
  name: 'Sett, Brawler',
  type: 'Unit',
  super: 'Champion',
  description: '',
  energy: 5,
  might: 4,
  power: 1,
  tags: ['Sett', 'Ionia'],
  colors: [{ id: '1', name: 'Body' }],
  variants: [
    {
      id: 'v1',
      variantNumber: 'OGN-164',
      rarity: 'Epic',
      variantType: 'Standard',
      variantLabel: 'Standard',
      imageUrl: 'https://example.com/ogn-164.webp',
      cardmarketId: 1,
      tcgplayerId: null,
      releaseDate: null,
      artist: null,
      prices: [],
    },
    {
      id: 'v2',
      variantNumber: 'OGN-164a',
      rarity: 'Showcase',
      variantType: 'Alt Art',
      variantLabel: 'Alt Art',
      imageUrl: 'https://example.com/ogn-164a.webp',
      cardmarketId: 2,
      tcgplayerId: null,
      releaseDate: null,
      artist: null,
      prices: [],
    },
  ],
};

const settListItems: CardListItem[] = [
  {
    cardId: settBrawlerDetail.id,
    variantNumber: 'OGN-164',
    name: 'Sett, Brawler',
    type: 'Unit',
    energy: 5,
    might: 4,
    power: 1,
    rarity: 'Epic',
    setCode: 'OGN',
    colors: ['Body'],
    imageUrl: 'https://example.com/ogn-164.webp',
    cardmarketId: 1,
    priceEur: null,
    printings: [
      {
        variantNumber: 'OGN-164',
        variantLabel: 'Standard',
        isFoil: false,
        priceEur: null,
      },
    ],
  },
  {
    cardId: settBrawlerDetail.id,
    variantNumber: 'OGN-164a',
    name: 'Sett, Brawler',
    type: 'Unit',
    energy: 5,
    might: 4,
    power: 1,
    rarity: 'Showcase',
    setCode: 'OGN',
    colors: ['Body'],
    imageUrl: 'https://example.com/ogn-164a.webp',
    cardmarketId: 2,
    priceEur: null,
    printings: [
      {
        variantNumber: 'OGN-164a',
        variantLabel: 'Alt Art',
        isFoil: false,
        priceEur: null,
      },
    ],
  },
];

describe('deck-add-catalog', () => {
  test('prefills champion search from legend primary name', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    expect(defaultDeckAddSearch('champion', deck)).toBe('Sett');
    expect(effectiveDeckAddSearch('champion', deck, '')).toBe('Sett');
  });

  test('Pre-Rift does not prefill champion search from legend', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    deck.legend = settLegend;
    expect(defaultDeckAddSearch('champion', deck)).toBe('');
    expect(effectiveDeckAddSearch('champion', deck, '')).toBe('');
    expect(buildDeckAddListQuery('champion', deck, '')).toEqual({
      page: 1,
      sortBy: 'name',
      dir: 'asc',
      limit: 80,
      types: 'Unit',
      super: 'Champion',
    });
  });

  test('builds champion list query with super filter and legend search', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    expect(buildDeckAddListQuery('champion', deck, '')).toEqual({
      page: 1,
      sortBy: 'name',
      dir: 'asc',
      limit: 80,
      types: 'Unit',
      super: 'Champion',
      q: 'Sett',
    });
  });

  test('builds battlefield list query without implicit search', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    expect(buildDeckAddListQuery('battlefields', deck, '')).toEqual({
      page: 1,
      sortBy: 'name',
      dir: 'asc',
      limit: 80,
      types: 'Battlefield',
    });
  });

  test('default main deck filters preselect legend colors', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    expect(defaultDeckAddCatalogFilters('mainDeck', deck)).toEqual({
      ...DEFAULT_CATALOG_FILTERS,
      colors: ['Body', 'Order'],
      excludeTokens: true,
    });
  });

  test('builds main deck list query from catalog filters', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    const filters = defaultDeckAddCatalogFilters('mainDeck', deck);
    expect(buildDeckAddListQuery('mainDeck', deck, 'flame', filters)).toEqual({
      page: 1,
      sortBy: 'name',
      dir: 'asc',
      limit: 80,
      types: 'Unit,Gear,Spell',
      excludeTokens: true,
      colors: 'Body,Order',
      colorMode: 'within',
      q: 'flame',
    });
  });

  test('builds main deck browse query with filter defaults', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    const filters = defaultDeckAddCatalogFilters('mainDeck', deck);
    expect(buildDeckAddListQuery('mainDeck', deck, '', filters)).toEqual({
      page: 1,
      sortBy: 'name',
      dir: 'asc',
      limit: 80,
      types: 'Unit,Gear,Spell',
      excludeTokens: true,
      colors: 'Body,Order',
      colorMode: 'within',
    });
  });

  test('query key includes legend so catalog refetches after legend change', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    const settKey = deckAddListQueryKey(
      'champion',
      buildDeckAddListQuery('champion', deck, 'Sett'),
      deck
    );
    deck.legend = mockDeckCard({
      name: 'Jinx, Rebel',
      type: 'Legend',
      tags: ['Jinx'],
      colors: ['Fury', 'Chaos'],
      variantNumber: 'OGN-100',
    });
    const jinxKey = deckAddListQueryKey(
      'champion',
      buildDeckAddListQuery('champion', deck, 'Jinx'),
      deck
    );
    expect(settKey).not.toBe(jinxKey);
  });

  test('detects legends missing champion tags', () => {
    expect(legendNeedsHydration(settLegend)).toBe(false);
    expect(
      legendNeedsHydration(
        mockDeckCard({ name: 'Sett, The Boss', type: 'Legend', tags: [] })
      )
    ).toBe(true);
  });

  test('keeps alternate arts as separate candidates', () => {
    const unique = uniqueCardListItems(settListItems);
    expect(unique).toHaveLength(1);

    const candidates = buildDeckAddCandidates({
      section: 'champion',
      listItems: settListItems,
      details: [settBrawlerDetail],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.variantNumber).sort()).toEqual([
      'OGN-164',
      'OGN-164a',
    ]);
    expect(candidates.every((c) => c.super === 'Champion')).toBe(true);
  });

  test('filters Sett champion for Sett legend deck', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;

    const candidates = buildDeckAddCandidates({
      section: 'champion',
      listItems: settListItems,
      details: [settBrawlerDetail],
    });

    const eligible = filterEligibleDeckAddCards(deck, 'champion', candidates);
    expect(eligible).toHaveLength(2);
    expect(eligible.every((c) => c.name === 'Sett, Brawler')).toBe(true);
  });

  test('Pre-Rift keeps all champion candidates eligible', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    deck.legend = settLegend;

    const candidates = buildDeckAddCandidates({
      section: 'champion',
      listItems: settListItems,
      details: [settBrawlerDetail],
    });

    const eligible = filterEligibleDeckAddCards(deck, 'champion', candidates);
    expect(eligible).toHaveLength(candidates.length);
  });

  test('filters Sett champion when legend tags are missing but name matches', () => {
    const deck = createEmptyDeck();
    deck.legend = mockDeckCard({
      name: 'Sett, The Boss',
      type: 'Legend',
      tags: [],
      colors: ['Body', 'Order'],
    });

    const candidates = buildDeckAddCandidates({
      section: 'champion',
      listItems: settListItems,
      details: [settBrawlerDetail],
    });

    const eligible = filterEligibleDeckAddCards(deck, 'champion', candidates);
    expect(eligible).toHaveLength(2);
  });

  test('keeps added battlefields in the add picker list', () => {
    const deck = createEmptyDeck();
    deck.legend = settLegend;
    const battlefield = mockDeckCard({
      name: 'Abandoned Hall',
      type: 'Battlefield',
      variantNumber: 'UNL-205',
    });
    deck.battlefields.set(battlefield.name, { card: battlefield, count: 1 });

    const displayed = filterDeckAddDisplayCards(deck, 'battlefields', [battlefield]);
    expect(displayed).toHaveLength(1);
  });

  test('sideboard accepts main-deck card types and skips signatures for Constructed', () => {
    const unitItem = {
      cardId: 'u1',
      variantNumber: 'OGN-010',
      name: 'Apprentice Mage',
      type: 'Unit',
      energy: 1,
      might: 1,
      power: 0,
      rarity: 'Common',
      setCode: 'OGN',
      colors: ['Mind'],
      imageUrl: null,
      cardmarketId: null,
      priceEur: null,
      printings: [],
      isBanned: false,
    } as CardListItem;
    const signatureItem = {
      ...unitItem,
      cardId: 's1',
      variantNumber: 'OGN-011',
      name: 'Signature Spell',
      type: 'Spell',
      rarity: 'Signature',
    } as CardListItem;

    const candidates = buildDeckAddCandidates({
      section: 'sideboard',
      listItems: [unitItem, signatureItem],
      details: [],
    });

    expect(candidates.map((card) => card.name)).toEqual(['Apprentice Mage']);
  });

  test('Pre-Rift sideboard includes signature cards', () => {
    const unitItem = {
      cardId: 'u1',
      variantNumber: 'OGN-010',
      name: 'Apprentice Mage',
      type: 'Unit',
      energy: 1,
      might: 1,
      power: 0,
      rarity: 'Common',
      setCode: 'OGN',
      colors: ['Mind'],
      imageUrl: null,
      cardmarketId: null,
      priceEur: null,
      printings: [],
      isBanned: false,
    } as CardListItem;
    const signatureItem = {
      ...unitItem,
      cardId: 's1',
      variantNumber: 'OGN-011',
      name: 'Signature Spell',
      type: 'Spell',
      rarity: 'Signature',
    } as CardListItem;

    const candidates = buildDeckAddCandidates({
      section: 'sideboard',
      listItems: [unitItem, signatureItem],
      details: [],
      deck: { ...createEmptyDeck(), format: 'pre-rift' },
    });

    expect(candidates.map((card) => card.name).sort()).toEqual([
      'Apprentice Mage',
      'Signature Spell',
    ]);
  });

  test('shows all champion catalog hits in the add picker', () => {
    const deck = createEmptyDeck();
    deck.legend = mockDeckCard({
      name: 'Sett, The Boss',
      type: 'Legend',
      tags: ['Body', 'Order'],
      colors: ['Body', 'Order'],
      super: null,
    });

    const candidates = buildDeckAddCandidates({
      section: 'champion',
      listItems: settListItems,
      details: [settBrawlerDetail],
    });

    const displayed = filterDeckAddDisplayCards(deck, 'champion', candidates);
    expect(displayed).toEqual(candidates);
  });

  test('builds candidates from list items when batch details are missing', () => {
    const battlefieldItem: CardListItem = {
      cardId: 'bf-1',
      variantNumber: 'UNL-205',
      name: 'Abandoned Hall',
      type: 'Battlefield',
      energy: 0,
      might: 0,
      power: 0,
      rarity: 'Uncommon',
      setCode: 'UNL',
      colors: [],
      imageUrl: 'https://example.com/unl-205.webp',
      cardmarketId: 1,
      priceEur: null,
      printings: [
        {
          variantNumber: 'UNL-205',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: null,
        },
      ],
      isBanned: false,
    };

    const candidates = buildDeckAddCandidates({
      section: 'battlefields',
      listItems: [battlefieldItem],
      details: [],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe('Abandoned Hall');
  });

  test('includes dual-type Unit Gear cards in main deck candidates', () => {
    const patchedPorobot: CardListItem = {
      cardId: '7a6b4f37-b1f9-4571-847a-256215e46636',
      variantNumber: 'VEN-058',
      name: 'Patched Porobot',
      type: 'Unit Gear',
      energy: 2,
      might: 2,
      power: 0,
      rarity: 'Uncommon',
      setCode: 'VEN',
      colors: ['Mind'],
      imageUrl: 'https://example.com/ven-058.webp',
      cardmarketId: null,
      priceEur: null,
      printings: [
        {
          variantNumber: 'VEN-058',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: null,
        },
      ],
      isBanned: false,
    };

    const candidates = buildDeckAddCandidates({
      section: 'mainDeck',
      listItems: [patchedPorobot],
      details: [],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe('Patched Porobot');
    expect(candidates[0]?.type).toBe('Unit Gear');
  });

  test('excludes token printings like Gold from deck add candidates', () => {
    const goldToken: CardListItem = {
      cardId: 'gold-1',
      variantNumber: 'SFD-T03',
      name: 'Gold',
      type: 'Gear',
      energy: 0,
      might: 0,
      power: 0,
      rarity: 'Common',
      setCode: 'SFD',
      colors: [],
      imageUrl: 'https://example.com/sfd-t03.webp',
      cardmarketId: 1,
      priceEur: null,
      printings: [
        {
          variantNumber: 'SFD-T03',
          variantLabel: 'Standard',
          isFoil: false,
          priceEur: null,
        },
      ],
      isBanned: false,
    };

    const candidates = buildDeckAddCandidates({
      section: 'mainDeck',
      listItems: [goldToken],
      details: [],
    });

    expect(candidates).toHaveLength(0);
  });
});
