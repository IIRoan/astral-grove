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
  test('requires an owner to configure link access before copying a link', () => {
    const deck = createEmptyDeck('Test');
    deck.id = 'deck_abc';
    const result = resolveDeckSharePayload(
      deck,
      'link',
      'https://riftbounddev.roan.dev'
    );
    expect(result).toEqual({
      ok: false,
      error: 'Enable link access before copying a deck link.',
    });
  });

  test('copies a shared deck link that opens outside the sign-in gate', () => {
    const deck = {
      ...createEmptyDeck('Shared'),
      id: 'dshare_abc',
      source: 'owned' as const,
      shareToken: 'dshare_abc',
      readOnly: true,
    };
    expect(resolveDeckSharePayload(deck, 'link', 'https://astral-grove.com')).toEqual({
      ok: true,
      value: 'https://astral-grove.com/shared/decks/dshare_abc',
    });
  });

  test('preserves community deck links', () => {
    const deck = {
      ...createEmptyDeck('Community'),
      id: 'pa_abc',
      source: 'imported' as const,
      readOnly: true,
    };
    expect(resolveDeckSharePayload(deck, 'link', 'https://astral-grove.com')).toEqual({
      ok: true,
      value: 'https://astral-grove.com/decks/pa_abc',
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

  test('encodes a deck code with more than 3 Spiderling copies', () => {
    let deck = createEmptyDeck('Spiderlings');
    deck = addCardToDeck(deck, card('VEN-097', { name: 'Spiderling' }), {
      section: 'mainDeck',
      count: 16,
    });
    const result = resolveDeckSharePayload(deck, 'code');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeGreaterThan(16);
      expect(result.value).toMatch(/^[A-Z2-7]+$/i);
    }
  });

  test('copies a TTS list with one token per copy', () => {
    let deck = createEmptyDeck('TTS');
    deck = addCardToDeck(deck, card('OGN-261', { type: 'Legend', name: 'Legend' }), {
      section: 'legend',
    });
    deck = addCardToDeck(deck, card('VEN-135a', { name: 'Alt' }), {
      section: 'mainDeck',
      count: 3,
    });
    const result = resolveDeckSharePayload(deck, 'tts');
    expect(result).toEqual({
      ok: true,
      value: 'OGN-261-1 VEN-135-2 VEN-135-2 VEN-135-2',
    });
  });
});
