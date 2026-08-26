import { describe, expect, test } from 'bun:test';
import {
  EMPTY_COLLECTION_BY_NAME,
  collectionByCardName,
  collectionByNameEqual,
  reuseCollectionByCardName,
} from '@/lib/collection-by-name';

describe('collectionByCardName', () => {
  test('sums quantities that share a card name', () => {
    const map = collectionByCardName([
      { name: 'Jinx', quantity: 2 },
      { name: 'Vi', quantity: 1 },
      { name: 'Jinx', quantity: 1 },
    ]);
    expect(map.get('Jinx')).toBe(3);
    expect(map.get('Vi')).toBe(1);
    expect(map.size).toBe(2);
  });

  test('reuses the interned empty map when the query has not resolved', () => {
    expect(collectionByCardName(undefined)).toBe(EMPTY_COLLECTION_BY_NAME);
    expect(collectionByCardName([])).toBe(EMPTY_COLLECTION_BY_NAME);
  });
});

describe('collectionByNameEqual', () => {
  test('treats maps with the same totals as equal even when the Map reference changes', () => {
    const prev = collectionByCardName([{ name: 'Jinx', quantity: 2 }]);
    const next = collectionByCardName([{ name: 'Jinx', quantity: 2 }]);
    expect(prev).not.toBe(next);
    expect(collectionByNameEqual(prev, next)).toBe(true);
  });

  test('returns false when a quantity or membership changes', () => {
    const prev = collectionByCardName([{ name: 'Jinx', quantity: 2 }]);
    expect(
      collectionByNameEqual(prev, collectionByCardName([{ name: 'Jinx', quantity: 3 }]))
    ).toBe(false);
    expect(
      collectionByNameEqual(prev, collectionByCardName([{ name: 'Vi', quantity: 2 }]))
    ).toBe(false);
    expect(collectionByNameEqual(prev, undefined)).toBe(false);
  });
});

describe('reuseCollectionByCardName', () => {
  test('keeps the previous map when a new array carries the same totals', () => {
    const previous = reuseCollectionByCardName(EMPTY_COLLECTION_BY_NAME, [
      { name: 'Jinx', quantity: 2 },
      { name: 'Vi', quantity: 1 },
    ]);
    const reused = reuseCollectionByCardName(previous, [
      { name: 'Jinx', quantity: 2 },
      { name: 'Vi', quantity: 1 },
    ]);
    expect(reused).toBe(previous);
  });

  test('replaces the map when collection totals actually change', () => {
    const previous = reuseCollectionByCardName(EMPTY_COLLECTION_BY_NAME, [
      { name: 'Jinx', quantity: 2 },
    ]);
    const next = reuseCollectionByCardName(previous, [{ name: 'Jinx', quantity: 3 }]);
    expect(next).not.toBe(previous);
    expect(next.get('Jinx')).toBe(3);
  });
});
