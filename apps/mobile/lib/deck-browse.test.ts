import { describe, expect, test } from 'bun:test';
import { DEFAULT_DECK_BROWSE_FILTERS } from '@/constants/deckBrowse';
import {
  deckBrowseFilterSegmentActive,
  deckBrowseFilterSegmentSummary,
  deckBrowseSummaryLine,
  formatDeckRelativeTime,
  formatDeckStatCount,
  isBrowseDeck,
} from '@/lib/deck-browse';
import { deckHasBannedCards, isCardBannedInDeck } from '@/lib/card-legality';
import type { DeckState } from '@/lib/deck-types';

function browseDeck(overrides: Partial<DeckState> = {}): DeckState {
  return {
    id: 'deck-1',
    name: 'Vex Control',
    description: '',
    format: 'constructed',
    createdAt: Date.parse('2026-02-01T00:00:00.000Z'),
    updatedAt: Date.parse('2026-03-01T00:00:00.000Z'),
    legend: null,
    champion: null,
    mainDeck: new Map(),
    runes: new Map(),
    battlefields: new Map(),
    sideboard: new Map(),
    addToSideboard: false,
    source: 'imported',
    readOnly: true,
    authorName: 'Jarl Defra',
    views: 2200,
    likes: 8,
    isLegal: true,
    setPrefixes: ['UNL', 'OGN', 'SFD'],
    hasGuide: false,
    hasVideo: true,
    hasMatchups: false,
    ...overrides,
  };
}

describe('formatDeckStatCount', () => {
  test('formats compact thousands', () => {
    expect(formatDeckStatCount(8)).toBe('8');
    expect(formatDeckStatCount(2200)).toBe('2.2k');
    expect(formatDeckStatCount(4000)).toBe('4.0k');
    expect(formatDeckStatCount(19500)).toBe('20k');
  });
});

describe('formatDeckRelativeTime', () => {
  test('formats recent and older timestamps', () => {
    const now = Date.parse('2026-04-01T00:00:00.000Z');
    expect(formatDeckRelativeTime(now - 5 * 60_000, now)).toBe('5m ago');
    expect(formatDeckRelativeTime(now - 9 * 24 * 60 * 60_000, now)).toBe('9d ago');
    expect(formatDeckRelativeTime(now - 40 * 24 * 60 * 60_000, now)).toBe(
      'about 1 month ago'
    );
  });
});

describe('deckBrowseSummaryLine', () => {
  test('builds author, stats, and relative time', () => {
    const line = deckBrowseSummaryLine(browseDeck());
    expect(line).toContain('by Jarl Defra');
    expect(line).toContain('2.2k views');
    expect(line).toContain('8 likes');
  });

  test('returns null for owned decks', () => {
    expect(
      deckBrowseSummaryLine(browseDeck({ source: 'owned', readOnly: false }))
    ).toBeNull();
  });
});

describe('isBrowseDeck', () => {
  test('detects imported read-only browse decks', () => {
    expect(isBrowseDeck(browseDeck())).toBe(true);
    expect(isBrowseDeck(browseDeck({ source: 'owned', readOnly: false }))).toBe(false);
  });
});

describe('isCardBannedInDeck', () => {
  test('matches banned card names case-insensitively', () => {
    const deck = browseDeck({ bannedCardNames: ['The Dreaming Tree'] });
    expect(isCardBannedInDeck(deck, 'the dreaming tree')).toBe(true);
    expect(isCardBannedInDeck(deck, 'Vex')).toBe(false);
  });
});

describe('deckHasBannedCards', () => {
  test('detects banned card lists', () => {
    expect(
      deckHasBannedCards(browseDeck({ bannedCardNames: ['Obelisk of Power'] }))
    ).toBe(true);
    expect(deckHasBannedCards(browseDeck({ bannedCardNames: [] }))).toBe(false);
  });

  test('detects banned cards from ban dates on deck entries', () => {
    const banned = {
      cardId: 'c1',
      variantNumber: 'OGN-001',
      name: 'Obelisk of Power',
      type: 'Unit',
      super: null,
      tags: [],
      colors: [],
      energy: 1,
      setCode: 'OGN',
      rarity: 'Rare',
      variantType: 'Standard',
      isSignature: false,
      banEffectiveDate: '2020-01-01T00:00:00.000Z',
    };
    expect(
      deckHasBannedCards(
        browseDeck({
          mainDeck: new Map([['Obelisk of Power', { card: banned, count: 1 }]]),
        })
      )
    ).toBe(true);
  });
});

describe('deckBrowseFilterSegmentActive', () => {
  test('tracks active state per segment', () => {
    expect(deckBrowseFilterSegmentActive('legends', DEFAULT_DECK_BROWSE_FILTERS)).toBe(
      false
    );
    expect(
      deckBrowseFilterSegmentActive('legends', {
        ...DEFAULT_DECK_BROWSE_FILTERS,
        legend: 'Vex, Empress of the Void',
      })
    ).toBe(true);
    expect(
      deckBrowseFilterSegmentActive('sets', {
        ...DEFAULT_DECK_BROWSE_FILTERS,
        sets: ['OGN'],
      })
    ).toBe(true);
    expect(
      deckBrowseFilterSegmentActive('content', {
        ...DEFAULT_DECK_BROWSE_FILTERS,
        hasVideo: true,
      })
    ).toBe(true);
  });
});

describe('deckBrowseFilterSegmentSummary', () => {
  test('uses set names in the sets segment summary', () => {
    const lookup = new Map([
      ['VEN', 'Vendetta'],
      ['OGN', 'Origins'],
    ]);

    expect(
      deckBrowseFilterSegmentSummary(
        'sets',
        { ...DEFAULT_DECK_BROWSE_FILTERS, sets: ['VEN', 'OGN'] },
        lookup
      )
    ).toBe('Vendetta, Origins');
  });
});
