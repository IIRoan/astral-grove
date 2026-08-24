import { describe, expect, test } from 'bun:test';
import { createEmptyDeck, addCardToDeck } from '@/lib/deck-card';
import { resolveDeckSharePayload } from '@/lib/deck-share';
import type { DeckCard } from '@/lib/deck-types';

function card(variantNumber: string, overrides: Partial<DeckCard> = {}): DeckCard {
  return {
    cardId: variantNumber,
    variantNumber,
    name: overrides.name ?? variantNumber,
    type: overrides.type ?? 'Unit',
    super: overrides.super ?? null,
    tags: [],
    colors: ['Fury'],
    energy: 1,
    setCode: variantNumber.split('-')[0] ?? 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
    ...overrides,
  };
}

describe('resolveDeckSharePayload', () => {
  test('builds an Astral Grove link for the deck id', () => {
    const deck = createEmptyDeck('Test');
    deck.id = 'deck_abc';
    const result = resolveDeckSharePayload(
      deck,
      'link',
      'https://riftbounddev.roan.dev'
    );
    expect(result).toEqual({
      ok: true,
      value: 'https://riftbounddev.roan.dev/decks/deck_abc',
    });
  });

  test('encodes a deck code when cards are present', () => {
    let deck = createEmptyDeck('Test');
    deck = addCardToDeck(deck, card('OGN-004'), { count: 3 });
    const result = resolveDeckSharePayload(deck, 'code');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeGreaterThan(16);
      expect(result.value).toMatch(/^[A-Z2-7]+$/i);
    }
  });
});
