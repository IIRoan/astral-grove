import { describe, expect, test } from 'bun:test';
import {
  collectionImportPreviewStatus,
  fromTtsCardToken,
  parseCollectionTtsToImportItems,
  splitCollectionTtsTokens,
} from './collection-tts.js';

describe('fromTtsCardToken', () => {
  test('maps art indexes to deck-code card codes', () => {
    expect(fromTtsCardToken('OGN-261-1')).toBe('OGN-261');
    expect(fromTtsCardToken('UNL-176-2')).toBe('UNL-176a');
    expect(fromTtsCardToken('OGN-197-3')).toBe('OGN-197b');
    expect(fromTtsCardToken('OGS-017-1')).toBe('OGS-017');
  });

  test('rejects non-TTS tokens', () => {
    expect(fromTtsCardToken('OGN-261')).toBeNull();
    expect(fromTtsCardToken('OGN-001-Foil')).toBeNull();
    expect(fromTtsCardToken('')).toBeNull();
  });
});

describe('parseCollectionTtsToImportItems', () => {
  test('splits whitespace and commas, then aggregates copies', () => {
    const parsed = parseCollectionTtsToImportItems(
      'OGN-166-2 OGN-166-2, OGN-007-2; OGS-017-1'
    );
    expect(parsed.totalTokens).toBe(4);
    expect(parsed.errors).toEqual([]);
    expect(parsed.uniquePrintings).toBe(3);
    expect(parsed.totalCopies).toBe(4);
    expect(parsed.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ variantNumber: 'OGN-166a', quantity: 2 }),
        expect.objectContaining({ variantNumber: 'OGN-007a', quantity: 1 }),
        expect.objectContaining({ variantNumber: 'OGS-017', quantity: 1 }),
      ])
    );
  });

  test('collects invalid tokens without dropping valid ones', () => {
    const parsed = parseCollectionTtsToImportItems('OGN-001-1 NOT-A-TOKEN OGN-002-1');
    expect(parsed.totalTokens).toBe(3);
    expect(parsed.errors).toEqual([
      { token: 'NOT-A-TOKEN', message: 'Invalid TTS token: NOT-A-TOKEN' },
    ]);
    expect(parsed.items.map((item) => item.variantNumber).sort()).toEqual([
      'OGN-001',
      'OGN-002',
    ]);
  });
});

describe('splitCollectionTtsTokens', () => {
  test('ignores empty segments', () => {
    expect(splitCollectionTtsTokens('  OGN-001-1   \n  OGN-002-1  ')).toEqual([
      'OGN-001-1',
      'OGN-002-1',
    ]);
  });
});

describe('collectionImportPreviewStatus', () => {
  test('classifies quantity transitions', () => {
    expect(collectionImportPreviewStatus(0, 3)).toBe('new');
    expect(collectionImportPreviewStatus(1, 4)).toBe('increase');
    expect(collectionImportPreviewStatus(5, 2)).toBe('decrease');
    expect(collectionImportPreviewStatus(2, 2)).toBe('unchanged');
  });
});
