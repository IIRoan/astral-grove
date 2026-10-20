import { describe, expect, test } from 'bun:test';
import { cardHasAnyType, cardTypeTokens } from '@riftbound/contracts';
import {
  cardHasType,
  isChampionUnit,
  sectionForCardType,
  cloneDeck,
  createEmptyDeck,
  deckCardFromListItem,
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

describe('deckCardFromListItem', () => {
  test('keeps super and detects Signature cards from it', () => {
    const card = deckCardFromListItem({
      cardId: '00000000-0000-4000-8000-000000000252',
      variantNumber: 'OGN-252',
      name: 'Super Mega Death Rocket!',
      type: 'Spell',
      super: 'Signature',
      energy: 4,
      might: 0,
      power: 0,
      rarity: 'Epic',
      setCode: 'OGN',
      colors: ['Fury', 'Chaos'],
      imageUrl: 'https://example.com/card.webp',
      cardmarketId: null,
      priceEur: null,
      printings: [],
      isBanned: false,
    });
    expect(card.super).toBe('Signature');
    expect(card.isSignature).toBe(true);
  });
});
