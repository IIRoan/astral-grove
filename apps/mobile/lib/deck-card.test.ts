import { describe, expect, test } from 'bun:test';
import { cardHasAnyType, cardTypeTokens } from '@riftbound/contracts';
import {
  cardHasType,
  isChampionUnit,
  sectionForCardType,
  cloneDeck,
  createEmptyDeck,
  deserializeDeck,
  serializeDeck,
} from './deck-card';

describe('card type tokens', () => {
  test('splits dual types like Unit Gear', () => {
    expect(cardTypeTokens('Unit Gear')).toEqual(['unit', 'gear']);
    expect(cardHasAnyType('Unit Gear', ['unit'])).toBe(true);
    expect(cardHasType({ type: 'Unit Gear' }, 'gear')).toBe(true);
    expect(cardHasType({ type: 'Unit Gear' }, 'spell')).toBe(false);
  });

  test('routes Unit Gear to main deck', () => {
    expect(sectionForCardType({ type: 'Unit Gear', super: null })).toBe('mainDeck');
  });

  test('treats Unit Gear with Champion super as champion unit', () => {
    expect(isChampionUnit({ type: 'Unit Gear', super: 'Champion' })).toBe(true);
  });
});

describe('deck version serialize', () => {
  test('roundtrips version metadata and cloneDeck strips it', () => {
    const deck = {
      ...createEmptyDeck('Annie'),
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
    };
    const roundtrip = deserializeDeck(serializeDeck(deck));
    expect(roundtrip.versionId).toBe('dver_1');
    expect(roundtrip.versionName).toBe('Current');
    expect(roundtrip.versions).toHaveLength(1);

    const copy = cloneDeck(deck);
    expect(copy.versionId).toBeUndefined();
    expect(copy.versionName).toBeUndefined();
    expect(copy.versions).toBeUndefined();
    expect(copy.id).not.toBe(deck.id);
  });
});
