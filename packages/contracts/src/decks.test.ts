import { describe, expect, test } from 'bun:test';
import {
  CreateDeckVersionRequest,
  DeckListItem,
  DeckVersionName,
  RenameDeckVersionRequest,
  StoredDeckPayload,
} from './decks.js';

const basePayload = {
  id: 'deck_1',
  name: 'Annie Aggro',
  createdAt: 1,
  updatedAt: 2,
  legend: null,
  champion: null,
  mainDeck: [],
  runes: [],
  battlefields: [],
  sideboard: [],
};

describe('DeckVersionName', () => {
  test('trims and accepts names up to 60 characters', () => {
    expect(DeckVersionName.parse('  Post-ban  ')).toBe('Post-ban');
    expect(DeckVersionName.parse('a'.repeat(60))).toHaveLength(60);
  });

  test('rejects empty and oversized names', () => {
    expect(() => DeckVersionName.parse('')).toThrow();
    expect(() => DeckVersionName.parse('   ')).toThrow();
    expect(() => DeckVersionName.parse('a'.repeat(61))).toThrow();
  });
});

describe('version request bodies', () => {
  test('create and rename share the name contract', () => {
    expect(CreateDeckVersionRequest.parse({ name: ' Budget ' })).toEqual({
      name: 'Budget',
    });
    expect(RenameDeckVersionRequest.parse({ name: 'Main' })).toEqual({ name: 'Main' });
  });
});

describe('DeckListItem version fields', () => {
  test('owned detail may include versions', () => {
    const parsed = DeckListItem.parse({
      ...basePayload,
      source: 'owned',
      readOnly: false,
      versionId: 'dver_1',
      versionName: 'Current',
      versions: [
        {
          id: 'dver_1',
          name: 'Current',
          createdAt: 1,
          updatedAt: 2,
          isActive: true,
        },
      ],
    });
    expect(parsed.versionId).toBe('dver_1');
    expect(parsed.versions).toHaveLength(1);
  });

  test('imported decks omit version fields', () => {
    const parsed = DeckListItem.parse({
      ...basePayload,
      source: 'imported',
      readOnly: true,
    });
    expect(parsed.versionId).toBeUndefined();
    expect(parsed.versions).toBeUndefined();
  });

  test('StoredDeckPayload strips version metadata', () => {
    const parsed = StoredDeckPayload.parse({
      ...basePayload,
      versionId: 'dver_ignored',
      versionName: 'Ignored',
    });
    expect(parsed).not.toHaveProperty('versionId');
    expect(parsed).not.toHaveProperty('versionName');
  });
});
