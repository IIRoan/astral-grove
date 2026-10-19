import { describe, expect, it } from 'bun:test';
import { createEmptyDeck } from '@/lib/deck-card';
import { deckMainCompositionLines, deckSectionProgress } from '@/lib/deck-display';
import type { DeckCard } from '@/lib/deck-types';

function sampleCard(name: string, energy: number): DeckCard {
  return {
    cardId: name,
    variantNumber: `OGN-001`,
    name,
    type: 'Unit',
    super: null,
    tags: [],
    colors: ['Fury'],
    energy,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'normal',
    isSignature: false,
  };
}

describe('deckSectionProgress', () => {
  it('counts champion toward main deck target', () => {
    const deck = createEmptyDeck();
    deck.champion = sampleCard('Champion', 3);
    const progress = deckSectionProgress(deck, 'mainDeck');
    expect(progress.current).toBe(1);
    expect(progress.target).toBe(40);
    expect(progress.hint).toBe('Includes chosen champion');
  });

  it('uses Pre-Rift main deck minimum of 25', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    const progress = deckSectionProgress(deck, 'mainDeck');
    expect(progress.current).toBe(0);
    expect(progress.target).toBe(25);
  });

  it('uses a 10-card Constructed sideboard target', () => {
    const deck = createEmptyDeck();
    expect(deckSectionProgress(deck, 'sideboard').target).toBe(10);
  });

  it('keeps an 8-card Pre-Rift sideboard target', () => {
    const deck = createEmptyDeck();
    deck.format = 'pre-rift';
    expect(deckSectionProgress(deck, 'sideboard').target).toBe(8);
    expect(deckSectionProgress(deck, 'sideboard').hint).toBe('Card pool (no limit)');
  });
});

describe('deckMainCompositionLines', () => {
  it('sorts by energy then name and caps visible lines', () => {
    const deck = createEmptyDeck();
    deck.mainDeck.set('B', { card: sampleCard('B', 2), count: 2 });
    deck.mainDeck.set('A', { card: sampleCard('A', 1), count: 3 });
    deck.mainDeck.set('C', { card: sampleCard('C', 2), count: 1 });

    const { lines, hiddenCount } = deckMainCompositionLines(deck, 2);
    expect(lines.map((line) => line.name)).toEqual(['A', 'B']);
    expect(hiddenCount).toBe(1);
  });
});
