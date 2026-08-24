import { describe, expect, test } from 'bun:test';
import {
  collectionAddActorLabel,
  formatCollectionAddAt,
  formatCollectionLogDelta,
  formatCollectionLogWhat,
} from '@/lib/collection-add-log';

describe('formatCollectionAddAt', () => {
  test('formats same-year adds as day month time', () => {
    const at = new Date(2026, 7, 22, 15, 4, 0);
    expect(formatCollectionAddAt(at.toISOString(), new Date(2026, 7, 22))).toBe(
      '22 Aug 15:04'
    );
  });

  test('includes a two-digit year for older adds', () => {
    const at = new Date(2025, 0, 3, 9, 5, 0);
    expect(formatCollectionAddAt(at.toISOString(), new Date(2026, 7, 22))).toBe(
      '3 Jan 25 09:05'
    );
  });
});

describe('collectionAddActorLabel', () => {
  test('uses the first name token', () => {
    expect(collectionAddActorLabel('Roan Vale')).toBe('Roan');
    expect(collectionAddActorLabel('  ')).toBeNull();
  });
});

describe('formatCollectionLogWhat', () => {
  test('names added and removed copy counts', () => {
    expect(formatCollectionLogWhat(2, 3)).toBe('Added 2 copies · now 3');
    expect(formatCollectionLogWhat(1, 1)).toBe('Added 1 copy · now 1');
    expect(formatCollectionLogWhat(-1, 2)).toBe('Removed 1 copy · now 2');
    expect(formatCollectionLogWhat(-1, 0)).toBe('Removed last copy');
  });

  test('names the Standard or Foil finish', () => {
    expect(formatCollectionLogWhat(2, 3, null, false)).toBe(
      'Added 2 Standard copies · now 3'
    );
    expect(formatCollectionLogWhat(1, 1, null, true)).toBe('Added 1 Foil copy · now 1');
    expect(formatCollectionLogWhat(-1, 0, null, true)).toBe('Removed last Foil copy');
  });

  test('prefixes a share partner name', () => {
    expect(formatCollectionLogWhat(1, 1, 'Roan Vale', true)).toBe(
      'Roan added 1 Foil copy · now 1'
    );
  });
});

describe('formatCollectionLogDelta', () => {
  test('signs quantity changes', () => {
    expect(formatCollectionLogDelta(2)).toBe('+2');
    expect(formatCollectionLogDelta(-1)).toBe('−1');
  });
});
