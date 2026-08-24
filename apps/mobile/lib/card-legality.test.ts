import { describe, expect, test } from 'bun:test';
import {
  collectIllegalCardNames,
  isCardBannedInDeck,
  isCardTournamentIllegal,
} from '@/lib/card-legality';
import type { DeckCard, DeckState } from '@/lib/deck-types';

function deckCard(name: string, banEffectiveDate?: string | null): DeckCard {
  return {
    cardId: 'card-1',
    variantNumber: 'OGN-001',
    name,
    type: 'Unit',
    super: null,
    tags: [],
    colors: [],
    energy: 1,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
    banEffectiveDate,
  };
}

function deck(overrides: Partial<DeckState> = {}): DeckState {
  return {
    id: 'deck-1',
    name: 'Test',
    description: '',
    format: 'constructed',
    createdAt: 0,
    updatedAt: 0,
    legend: null,
    champion: null,
    mainDeck: new Map(),
    runes: new Map(),
    battlefields: new Map(),
    sideboard: new Map(),
    addToSideboard: false,
    ...overrides,
  };
}

describe('isCardTournamentIllegal', () => {
  test('detects active ban dates', () => {
    expect(
      isCardTournamentIllegal({
        name: 'The Dreaming Tree',
        banEffectiveDate: '2020-01-01T00:00:00.000Z',
      })
    ).toBe(true);
  });

  test('detects upstream banned name lists', () => {
    expect(
      isCardTournamentIllegal(deckCard('The Dreaming Tree'), {
        bannedCardNames: ['The Dreaming Tree'],
      })
    ).toBe(true);
  });

  test('ignores future ban dates', () => {
    expect(
      isCardTournamentIllegal({
        name: 'Future Ban',
        banEffectiveDate: '2999-01-01T00:00:00.000Z',
      })
    ).toBe(false);
  });
});

describe('isCardBannedInDeck', () => {
  test('matches banned card names case-insensitively', () => {
    const state = deck({ bannedCardNames: ['The Dreaming Tree'] });
    expect(isCardBannedInDeck(state, 'the dreaming tree')).toBe(true);
    expect(isCardBannedInDeck(state, 'Vex')).toBe(false);
  });

  test('uses card ban date when provided', () => {
    const state = deck();
    expect(
      isCardBannedInDeck(
        state,
        'Obelisk',
        deckCard('Obelisk', '2020-01-01T00:00:00.000Z')
      )
    ).toBe(true);
  });
});

describe('collectIllegalCardNames', () => {
  test('collects unique illegal names from deck cards', () => {
    const state = deck({
      mainDeck: new Map([
        ['Banned', { card: deckCard('Banned', '2020-01-01T00:00:00.000Z'), count: 2 }],
      ]),
    });
    expect(collectIllegalCardNames(state)).toEqual(['Banned']);
  });
});
