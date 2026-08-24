import { describe, expect, test } from 'bun:test';
import {
  catalogFingerprint,
  entityHash,
  pricesFingerprint,
} from '../../src/lib/hash.js';

describe('entityHash', () => {
  test('is stable regardless of object key order', () => {
    expect(entityHash({ b: 2, a: 1 })).toBe(entityHash({ a: 1, b: 2 }));
  });

  test('changes when nested values differ', () => {
    expect(entityHash({ filters: { sets: [1] } })).not.toBe(
      entityHash({ filters: { sets: [2] } })
    );
  });
});

describe('catalogFingerprint', () => {
  test('combines total and filters into one digest', () => {
    const hash = catalogFingerprint(1396, { sets: [{ code: 'OGN' }] });
    expect(hash).toHaveLength(64);
    expect(catalogFingerprint(1396, { sets: [{ code: 'OGN' }] })).toBe(hash);
  });
});

describe('pricesFingerprint', () => {
  test('sorts rows before hashing', () => {
    const rows = [
      {
        cardmarketId: 2,
        isFoil: false,
        lastUpdated: '2026-01-01',
        marketPrice: '1.00',
      },
      {
        cardmarketId: 1,
        isFoil: true,
        lastUpdated: '2026-01-02',
        marketPrice: null,
      },
    ];
    expect(pricesFingerprint([...rows].reverse())).toBe(pricesFingerprint(rows));
  });
});
