import { describe, expect, mock, test } from 'bun:test';

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.resolve(),
  },
}));

const { normalizeAuthor, withoutBlockedAuthors } = await import('./blocked-authors');

describe('withoutBlockedAuthors', () => {
  const decks = [
    { id: 'a', authorName: 'Rude Person' },
    { id: 'b', authorName: 'Friendly' },
    { id: 'c', authorName: null },
    { id: 'd' },
  ];

  test('hides decks by a blocked author regardless of case and spacing', () => {
    const blocked = new Set([normalizeAuthor('  rude person ')]);
    expect(withoutBlockedAuthors(decks, blocked).map((deck) => deck.id)).toEqual([
      'b',
      'c',
      'd',
    ]);
  });

  test('keeps every deck when nobody is blocked', () => {
    expect(withoutBlockedAuthors(decks, new Set())).toHaveLength(4);
  });
});
