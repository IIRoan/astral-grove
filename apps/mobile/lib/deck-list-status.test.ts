import { describe, expect, test } from 'bun:test';
import { addCardToDeck, createEmptyDeck } from '@/lib/deck-card';
import { deckListStatus } from '@/lib/deck-list-status';
import type { DeckCard } from '@/lib/deck-types';

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

function completeDeck() {
  let deck = createEmptyDeck();
  deck = addCardToDeck(deck, jinxLegend, { section: 'legend' });
  deck = addCardToDeck(deck, jinxChampion, { section: 'champion' });
  for (let i = 0; i < 39; i += 1) {
    deck = addCardToDeck(deck, mockCard({ name: `Main Card ${i}`, colors: ['Fury'] }), {
      section: 'mainDeck',
    });
  }
  deck = addCardToDeck(deck, furyRune, { section: 'runes', count: 12 });
  deck = addCardToDeck(
    deck,
    mockCard({ name: 'Zaun Warrens', type: 'Battlefield', colors: ['Chaos'] }),
    { section: 'battlefields' }
  );
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
  return deck;
}

describe('deckListStatus', () => {
  test('marks an empty deck incomplete without inventing ownership', () => {
    const status = deckListStatus(createEmptyDeck(), new Map());
    expect(status).toEqual({
      tone: 'incomplete',
      title: 'Incomplete',
      caption: 'Main 0/40',
    });
  });

  test('does not treat a truncated browse preview as incomplete when PA says legal', () => {
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
    const status = deckListStatus(
      {
        ...deck,
        source: 'imported',
        readOnly: true,
        isLegal: true,
      },
      new Map()
    );
    expect(status).toEqual({
      tone: 'complete',
      title: 'Complete',
      caption: 'List is legal',
    });
  });

  test('uses issue count when main is full but sections are still missing', () => {
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
    const status = deckListStatus(deck, new Map());
    expect(status.tone).toBe('incomplete');
    expect(status.title).toBe('Incomplete');
    expect(status.caption).toMatch(/issue/);
  });

  test('marks banned cards as illegal before completeness copy', () => {
    const deck = { ...completeDeck(), bannedCardNames: ['Obelisk of Power'] };
    const status = deckListStatus(deck, new Map());
    expect(status).toEqual({
      tone: 'illegal',
      title: 'Illegal',
      caption: 'Obelisk of Power',
    });
  });

  test('marks an upstream-illegal list as illegal', () => {
    const status = deckListStatus({ ...completeDeck(), isLegal: false }, new Map());
    expect(status).toEqual({
      tone: 'illegal',
      title: 'Illegal',
      caption: 'Not tournament legal',
    });
  });

  test('marks domain identity errors as illegal', () => {
    let deck = completeDeck();
    deck = addCardToDeck(
      deck,
      mockCard({ name: 'Off-domain Unit', colors: ['Calm'] }),
      { section: 'mainDeck' }
    );
    const status = deckListStatus(deck, new Map());
    expect(status.tone).toBe('illegal');
    expect(status.title).toBe('Illegal');
    expect(status.caption).toMatch(/issue/);
  });

  test('does not claim copies owned when collection is unknown', () => {
    const status = deckListStatus(completeDeck(), new Map());
    expect(status).toEqual({
      tone: 'complete',
      title: 'Complete',
      caption: 'List is legal',
    });
  });

  test('reports collection shortfall on a legal list', () => {
    const deck = completeDeck();
    const collection = new Map([[jinxLegend.name, 1]]);
    const status = deckListStatus(deck, collection, true);
    expect(status.tone).toBe('attention');
    expect(status.title).toBe('Missing copies');
    expect(status.caption).toMatch(/copies short/);
  });

  test('reports all copies owned when collection covers the list', () => {
    const deck = completeDeck();
    const collection = new Map<string, number>([
      [jinxLegend.name, 1],
      [jinxChampion.name, 1],
    ]);
    for (let i = 0; i < 39; i += 1) {
      collection.set(`Main Card ${i}`, 1);
    }
    const status = deckListStatus(deck, collection, true);
    expect(status).toEqual({
      tone: 'complete',
      title: 'Complete',
      caption: 'All copies owned',
    });
  });

  test('treats an empty ready collection as zero copies owned', () => {
    const deck = completeDeck();
    const status = deckListStatus(deck, new Map(), true);
    expect(status.tone).toBe('attention');
    expect(status.title).toBe('Missing copies');
  });
});
