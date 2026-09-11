import { describe, expect, test } from 'bun:test';
import { addCardToDeck, createEmptyDeck } from '@/lib/deck-card';
import { exportDeckTts, toTtsCardToken } from '@/lib/deck-tts';
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
    variantType: overrides.variantType ?? 'Standard',
    isSignature: false,
    ...overrides,
  };
}

describe('toTtsCardToken', () => {
  test('maps standard printings to art 1', () => {
    expect(toTtsCardToken('OGN-261')).toBe('OGN-261-1');
    expect(toTtsCardToken('UNL-055')).toBe('UNL-055-1');
    expect(toTtsCardToken('OGN-042')).toBe('OGN-042-1');
  });

  test('maps PA art indexes: a → 2, b → 3', () => {
    expect(toTtsCardToken('UNL-176a')).toBe('UNL-176-2');
    expect(toTtsCardToken('OGN-197b-Nexus')).toBe('OGN-197-3');
    expect(toTtsCardToken('OGN-128-Nexus')).toBe('OGN-128-1');
  });

  test('keeps foil as art 1 when the underlying code is standard', () => {
    expect(toTtsCardToken('OGN-001-Foil')).toBe('OGN-001-1');
  });
});

describe('exportDeckTts', () => {
  test('repeats one token per copy in legend, main, battlefield, rune order', () => {
    let deck = createEmptyDeck('TTS');
    deck = addCardToDeck(deck, card('OGN-261', { type: 'Legend', name: 'Legend' }), {
      section: 'legend',
    });
    deck = addCardToDeck(
      deck,
      card('UNL-176a', { super: 'Champion', name: 'Champion' }),
      { section: 'champion' }
    );
    deck = addCardToDeck(
      deck,
      card('UNL-176a', { super: 'Champion', name: 'Champion' }),
      { section: 'mainDeck', count: 2 }
    );
    deck = addCardToDeck(deck, card('OGN-047', { name: 'Main' }), {
      section: 'mainDeck',
      count: 3,
    });
    deck = addCardToDeck(deck, card('OGN-280', { type: 'Battlefield', name: 'BF' }), {
      section: 'battlefields',
    });
    deck = addCardToDeck(deck, card('OGN-042', { type: 'Rune', name: 'Rune' }), {
      section: 'runes',
      count: 6,
    });

    expect(exportDeckTts(deck)).toBe(
      [
        'OGN-261-1',
        'UNL-176-2',
        'UNL-176-2',
        'UNL-176-2',
        'OGN-047-1',
        'OGN-047-1',
        'OGN-047-1',
        'OGN-280-1',
        'OGN-042-1',
        'OGN-042-1',
        'OGN-042-1',
        'OGN-042-1',
        'OGN-042-1',
        'OGN-042-1',
      ].join(' ')
    );
  });

  test('appends sideboard after runes', () => {
    let deck = createEmptyDeck('TTS side');
    deck = addCardToDeck(deck, card('OGN-004', { name: 'Main' }), {
      section: 'mainDeck',
      count: 1,
    });
    deck = addCardToDeck(deck, card('OGN-009', { name: 'Side' }), {
      section: 'sideboard',
      count: 2,
    });

    expect(exportDeckTts(deck)).toBe('OGN-004-1 OGN-009-1 OGN-009-1');
  });
});
