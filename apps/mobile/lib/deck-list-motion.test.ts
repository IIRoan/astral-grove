import { describe, expect, test } from 'bun:test';
import {
  deckListItemStaggerMs,
  decksPaneEnterDirection,
  resetDecksPaneDirection,
} from '@/lib/deck-list-motion';

describe('deckListItemStaggerMs', () => {
  test('staggers early rows and caps later ones', () => {
    expect(deckListItemStaggerMs(0)).toBe(0);
    expect(deckListItemStaggerMs(1)).toBe(42);
    expect(deckListItemStaggerMs(7)).toBe(294);
    expect(deckListItemStaggerMs(40)).toBe(294);
  });
});

describe('decksPaneEnterDirection', () => {
  test('slides browse in from the right and mine from the left', () => {
    resetDecksPaneDirection();
    expect(decksPaneEnterDirection('mine')).toBe(0);
    expect(decksPaneEnterDirection('browse')).toBe(1);
    expect(decksPaneEnterDirection('mine')).toBe(-1);
    expect(decksPaneEnterDirection('mine')).toBe(0);
  });
});
