import { describe, expect, test } from 'bun:test';
import { createEmptyDeck } from '@/lib/deck-card';
import {
  countDecksByFormat,
  filterDecksByFormat,
  sortOwnedDecks,
} from '@/lib/deck-list';

describe('owned deck list helpers', () => {
  test('counts constructed and pre-rift lists without inventing formats', () => {
    const constructed = createEmptyDeck('Ionia Tempo');
    const preRift = createEmptyDeck('Sealed pool', '', 'pre-rift');
    expect(countDecksByFormat([constructed, preRift, constructed])).toEqual({
      all: 3,
      constructed: 2,
      'pre-rift': 1,
    });
  });

  test('filters to a real format', () => {
    const constructed = createEmptyDeck('Constructed list');
    const preRift = createEmptyDeck('Pre-Rift list', '', 'pre-rift');
    expect(filterDecksByFormat([constructed, preRift], 'pre-rift')).toEqual([preRift]);
    expect(filterDecksByFormat([constructed, preRift], 'all')).toHaveLength(2);
  });

  test('sorts by last edited, created, and name', () => {
    const older = {
      ...createEmptyDeck('Bravo'),
      createdAt: 100,
      updatedAt: 200,
    };
    const newer = {
      ...createEmptyDeck('Alpha'),
      createdAt: 150,
      updatedAt: 300,
    };

    expect(sortOwnedDecks([older, newer], 'edited').map((deck) => deck.name)).toEqual([
      'Alpha',
      'Bravo',
    ]);
    expect(sortOwnedDecks([newer, older], 'created').map((deck) => deck.name)).toEqual([
      'Alpha',
      'Bravo',
    ]);
    expect(sortOwnedDecks([newer, older], 'name').map((deck) => deck.name)).toEqual([
      'Alpha',
      'Bravo',
    ]);
  });
});
