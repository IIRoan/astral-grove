import { describe, expect, test } from 'bun:test';
import { addCardToDeck, createEmptyDeck, deckCardFromDetail } from '@/lib/deck-card';
import {
  validateDeck,
  deckOwnershipBorderClass,
  deckOwnershipTotals,
} from '@/lib/deck-validation';
import type { DeckCard } from '@/lib/deck-types';

describe('deckOwnershipBorderClass', () => {
  test('maps owned coverage to border tokens', () => {
    expect(deckOwnershipBorderClass(null, 3)).toBeNull();
    expect(deckOwnershipBorderClass(0, 0)).toBeNull();
    expect(deckOwnershipBorderClass(0, 1)).toBe('border-ownership-missing');
    expect(deckOwnershipBorderClass(1, 3)).toBe('border-ownership-partial');
    expect(deckOwnershipBorderClass(3, 3)).toBe('border-ownership-complete');
    expect(deckOwnershipBorderClass(4, 3)).toBe('border-ownership-complete');
  });
});

describe('deckOwnershipTotals', () => {
  test('returns null when collection is unknown', () => {
    const deck = createEmptyDeck();
    deck.legend = mockCard({ name: 'Jinx - Loose Cannon', type: 'Legend' });
    expect(deckOwnershipTotals(deck, new Map())).toBeNull();
  });

  test('counts legend, champion, main, and sideboard when collection is ready', () => {
    const deck = createEmptyDeck();
    deck.legend = mockCard({ name: 'Legend', type: 'Legend' });
    deck.champion = mockCard({ name: 'Champion', type: 'Unit', super: 'Champion' });
    deck.mainDeck.set('Unit', {
      card: mockCard({ name: 'Unit' }),
      count: 3,
    });
    deck.sideboard.set('Side', {
      card: mockCard({ name: 'Side' }),
      count: 2,
    });
    deck.runes.set('Rune', {
      card: mockCard({ name: 'Rune', type: 'Rune' }),
      count: 12,
    });

    const totals = deckOwnershipTotals(
      deck,
      new Map([
        ['Legend', 1],
        ['Champion', 1],
        ['Unit', 1],
        ['Side', 2],
      ]),
      true
    );
    expect(totals).toEqual({ owned: 5, required: 7, missing: 2 });
  });
});

function mockCard(overrides: Partial<DeckCard> & Pick<DeckCard, 'name'>): DeckCard {
  return {
    cardId: `id-${overrides.name}`,
    variantNumber: 'OGN-001',
    type: 'Unit',
    super: null,
    tags: [],
    colors: ['Fury'],
    energy: 2,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
    ...overrides,
  };
}

const jinxLegend = mockCard({
  name: 'Jinx - Loose Cannon',
  type: 'Legend',
  tags: ['Jinx'],
  colors: ['Fury', 'Chaos'],
});

const jinxChampion = mockCard({
  name: 'Jinx - Demolitionist',
  type: 'Unit',
  super: 'Champion',
  tags: ['Jinx'],
  colors: ['Fury'],
});

const furyRune = mockCard({
  name: 'Fury Rune',
  type: 'Rune',
  colors: ['Fury'],
});

const battlefield = mockCard({
  name: 'Zaun Warrens',
  type: 'Battlefield',
  colors: ['Chaos'],
});

const mainUnit = mockCard({
  name: 'Flame Chompers',
  type: 'Unit',
  colors: ['Fury'],
});

describe('validateDeck', () => {
  test('reports missing legend and champion', () => {
    const deck = createEmptyDeck();
    const messages = validateDeck(deck);
    expect(messages.some((m) => m.message.includes('Legend'))).toBe(true);
    expect(messages.some((m) => m.message.includes('Chosen Champion'))).toBe(true);
  });

  test('requires champion tag match with legend', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
    deck = addCardToDeck(
      deck,
      mockCard({
        name: 'Ahri - Nine-Tailed Fox',
        type: 'Unit',
        super: 'Champion',
        tags: ['Ahri'],
        colors: ['Mind'],
      }),
      { section: 'champion' }
    );

    const messages = validateDeck(deck);
    expect(messages.some((m) => m.message.includes('share a champion tag'))).toBe(true);
  });

  test('accepts Darius legend and champion by primary name', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(
      deck,
      mockCard({
        name: 'Darius, Hand of Noxus',
        type: 'Legend',
        tags: ['Noxus', 'Fury', 'Order'],
        colors: ['Fury', 'Order'],
      }),
      { section: 'legend' }
    );
    deck = addCardToDeck(
      deck,
      mockCard({
        name: 'Darius, Executioner',
        type: 'Unit',
        super: 'Champion',
        tags: ['Noxus', 'Fury'],
        colors: ['Fury'],
      }),
      { section: 'champion' }
    );

    const messages = validateDeck(deck);
    expect(messages.some((m) => m.code === 'champion_tag_mismatch')).toBe(false);
  });

  test('enforces domain identity on main deck cards', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
    deck = addCardToDeck(deck, jinxChampion, { section: 'champion' });
    deck = addCardToDeck(
      deck,
      mockCard({ name: 'Mind Orb', type: 'Gear', colors: ['Mind'] }),
      { section: 'mainDeck', count: 3 }
    );

    const messages = validateDeck(deck);
    expect(messages.some((m) => m.message.includes('Domain Identity'))).toBe(true);
  });

  test('enforces max 3 copies for non-runes', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
    deck = addCardToDeck(deck, jinxChampion, { section: 'champion' });
    deck = addCardToDeck(deck, mainUnit, { section: 'mainDeck', count: 4 });

    const messages = validateDeck(deck);
    expect(messages.some((m) => m.message.includes('max 3'))).toBe(true);
  });

  test('allows up to 12 rune copies', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
    deck = addCardToDeck(deck, jinxChampion, { section: 'champion' });
    deck = addCardToDeck(deck, furyRune, { section: 'runes', count: 12 });

    const messages = validateDeck(deck);
    expect(
      messages.some((m) => m.message.includes('Fury Rune') && m.message.includes('max'))
    ).toBe(false);
  });

  test('requires exactly 12 runes and 3 battlefields', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
    deck = addCardToDeck(deck, jinxChampion, { section: 'champion' });
    deck = addCardToDeck(deck, furyRune, { section: 'runes', count: 9 });
    deck = addCardToDeck(deck, battlefield, { section: 'battlefields', count: 2 });

    const messages = validateDeck(deck);
    expect(messages.some((m) => m.message.includes('Rune Deck has 9'))).toBe(true);
    expect(messages.some((m) => m.message.includes('Battlefields: 2'))).toBe(true);
  });

  test('limits signature cards to 3 total with matching legend tag', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
    deck = addCardToDeck(deck, jinxChampion, { section: 'champion' });
    deck = addCardToDeck(
      deck,
      mockCard({
        name: 'Jinx Signature',
        tags: ['Jinx'],
        colors: ['Fury'],
        isSignature: true,
      }),
      { section: 'mainDeck', count: 4 }
    );

    const messages = validateDeck(deck);
    expect(messages.some((m) => m.message.includes('Signature cards'))).toBe(true);
  });

  test('returns valid message for complete deck', () => {
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
    deck = addCardToDeck(deck, jinxChampion, { section: 'champion' });

    for (let i = 0; i < 39; i += 1) {
      deck = addCardToDeck(
        deck,
        mockCard({ name: `Main Card ${i}`, colors: ['Fury'] }),
        { section: 'mainDeck' }
      );
    }

    deck = addCardToDeck(deck, furyRune, { section: 'runes', count: 12 });
    deck = addCardToDeck(deck, battlefield, { section: 'battlefields' });
    deck = addCardToDeck(
      deck,
      mockCard({ name: 'Reaver Row', type: 'Battlefield', colors: ['Fury'] }),
      { section: 'battlefields' }
    );
    deck = addCardToDeck(
      deck,
      mockCard({ name: 'The Arena', type: 'Battlefield', colors: ['Chaos'] }),
      { section: 'battlefields' }
    );

    const messages = validateDeck(deck);
    expect(messages).toEqual([
      { type: 'valid', code: 'deck_valid', message: 'Deck is valid!' },
    ]);
  });
});

describe('deckCardFromDetail', () => {
  test('marks signature variants', () => {
    const card = deckCardFromDetail(
      {
        id: 'card-id',
        name: 'Jinx - Loose Cannon',
        type: 'Legend',
        super: null,
        description: '',
        energy: 0,
        might: 0,
        power: 0,
        tags: ['Jinx'],
        colors: [{ id: 'c1', name: 'Fury' }],
        banEffectiveDate: null,
        variants: [
          {
            id: 'v1',
            variantNumber: 'OGN-251',
            rarity: 'Signature',
            variantType: 'Standard',
            variantLabel: 'Standard',
            imageUrl: 'https://example.com/card.webp',
            cardmarketId: null,
            tcgplayerId: null,
            releaseDate: null,
            artist: null,
            prices: [],
          },
        ],
      },
      'OGN-251'
    );

    expect(card.isSignature).toBe(true);
  });
});
