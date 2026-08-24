import { describe, expect, test } from 'bun:test';
import { addCardToDeck, createEmptyDeck } from '@/lib/deck-card';
import {
  deckCardsMatch,
  deckMembershipRevision,
  findDeckEntryForCandidate,
  getDeckCandidateCount,
  isDeckCandidateInSection,
  listDeckSectionCards,
} from '@/lib/deck-membership';
import type { DeckCard } from '@/lib/deck-types';

function mockCard(overrides: Partial<DeckCard> & Pick<DeckCard, 'name'>): DeckCard {
  return {
    cardId: `id-${overrides.name}`,
    variantNumber: `OGN-${overrides.name}`,
    type: 'Battlefield',
    super: null,
    tags: [],
    colors: ['Fury'],
    energy: 0,
    setCode: 'OGN',
    rarity: 'Common',
    variantType: 'Standard',
    isSignature: false,
    ...overrides,
  };
}

describe('deck-membership', () => {
  test('matches printings by variantNumber, not shared cardId or name', () => {
    const standard = mockCard({
      name: 'Sett, Brawler',
      cardId: 'sett-1',
      variantNumber: 'OGN-164',
      type: 'Unit',
    });
    const altArt = mockCard({
      name: 'Sett, Brawler',
      cardId: 'sett-1',
      variantNumber: 'OGN-164a',
      type: 'Unit',
    });
    expect(deckCardsMatch(standard, altArt)).toBe(false);
    expect(deckCardsMatch(standard, { ...standard, name: 'Sett, Brawler ' })).toBe(
      true
    );
  });

  test('only the added printing counts as in-deck', () => {
    const standard = mockCard({
      name: 'Sett, Brawler',
      cardId: 'sett-1',
      variantNumber: 'OGN-164',
      type: 'Unit',
    });
    const altArt = mockCard({
      name: 'Sett, Brawler',
      cardId: 'sett-1',
      variantNumber: 'OGN-164a',
      type: 'Unit',
    });
    const deck = createEmptyDeck();
    deck.mainDeck.set(standard.name, { card: standard, count: 2 });

    expect(getDeckCandidateCount(deck, 'mainDeck', standard)).toBe(2);
    expect(isDeckCandidateInSection(deck, 'mainDeck', standard)).toBe(true);
    expect(getDeckCandidateCount(deck, 'mainDeck', altArt)).toBe(0);
    expect(isDeckCandidateInSection(deck, 'mainDeck', altArt)).toBe(false);
    expect(findDeckEntryForCandidate(deck, 'mainDeck', altArt)).toBeNull();
  });

  test('adding a different printing switches deck art to that variant', () => {
    const standard = mockCard({
      name: 'Sett, Brawler',
      cardId: 'sett-1',
      variantNumber: 'OGN-164',
      type: 'Unit',
    });
    const altArt = mockCard({
      name: 'Sett, Brawler',
      cardId: 'sett-1',
      variantNumber: 'OGN-164a',
      type: 'Unit',
    });
    let deck = createEmptyDeck();
    deck = addCardToDeck(deck, standard, { section: 'mainDeck', count: 2 });
    deck = addCardToDeck(deck, altArt, { section: 'mainDeck' });

    const entry = deck.mainDeck.get(standard.name);
    expect(entry?.count).toBe(3);
    expect(entry?.card.variantNumber).toBe('OGN-164a');
    expect(getDeckCandidateCount(deck, 'mainDeck', standard)).toBe(0);
    expect(getDeckCandidateCount(deck, 'mainDeck', altArt)).toBe(3);
  });

  test('tracks battlefield membership and removal', () => {
    const battlefield = mockCard({ name: 'Zaun Warrens', type: 'Battlefield' });
    let deck = createEmptyDeck();
    deck.battlefields.set(battlefield.name, { card: battlefield, count: 1 });
    deck = { ...deck, updatedAt: 100 };

    expect(isDeckCandidateInSection(deck, 'battlefields', battlefield)).toBe(true);
    expect(getDeckCandidateCount(deck, 'battlefields', battlefield)).toBe(1);

    deck.battlefields.delete(battlefield.name);
    deck = { ...deck, updatedAt: 200 };

    expect(isDeckCandidateInSection(deck, 'battlefields', battlefield)).toBe(false);
    expect(findDeckEntryForCandidate(deck, 'battlefields', battlefield)).toBeNull();
  });

  test('tracks main deck counts', () => {
    const unit = mockCard({ name: 'Flame Chompers', type: 'Unit' });
    const deck = createEmptyDeck();
    deck.mainDeck.set(unit.name, { card: unit, count: 2 });

    expect(getDeckCandidateCount(deck, 'mainDeck', unit)).toBe(2);
    expect(isDeckCandidateInSection(deck, 'mainDeck', unit)).toBe(true);

    deck.mainDeck.delete(unit.name);
    expect(getDeckCandidateCount(deck, 'mainDeck', unit)).toBe(0);
  });

  test('lists section cards sorted by energy then name', () => {
    const low = mockCard({ name: 'Zed', type: 'Unit', energy: 1 });
    const mid = mockCard({ name: 'Annie', type: 'Unit', energy: 2 });
    const high = mockCard({ name: 'Aatrox', type: 'Unit', energy: 2 });
    const deck = createEmptyDeck();
    deck.mainDeck.set(mid.name, { card: mid, count: 1 });
    deck.mainDeck.set(low.name, { card: low, count: 3 });
    deck.mainDeck.set(high.name, { card: high, count: 2 });

    expect(listDeckSectionCards(deck, 'mainDeck').map((c) => c.name)).toEqual([
      'Zed',
      'Aatrox',
      'Annie',
    ]);
    expect(listDeckSectionCards(deck, 'sideboard')).toEqual([]);
  });

  test('revision changes when membership changes', () => {
    const battlefield = mockCard({ name: 'Zaun Warrens', type: 'Battlefield' });
    let deck = createEmptyDeck();
    const emptyRevision = deckMembershipRevision(deck);

    deck.battlefields.set(battlefield.name, { card: battlefield, count: 1 });
    deck = { ...deck, updatedAt: deck.updatedAt + 1 };
    const withBfRevision = deckMembershipRevision(deck);

    deck.battlefields.delete(battlefield.name);
    deck = { ...deck, updatedAt: deck.updatedAt + 1 };
    const removedRevision = deckMembershipRevision(deck);

    expect(withBfRevision).not.toBe(emptyRevision);
    expect(removedRevision).not.toBe(withBfRevision);
    expect(isDeckCandidateInSection(deck, 'battlefields', battlefield)).toBe(false);
  });
});
