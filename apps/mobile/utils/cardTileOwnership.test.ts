import { expect, test } from 'bun:test';
import type { CardListItem } from '@riftbound/contracts';
import { cardTileOwnershipEqual } from './cardTileOwnership';

const card: CardListItem = {
  cardId: '00000000-0000-4000-8000-000000000001',
  variantNumber: 'OGN-001',
  name: 'Test',
  type: 'Unit',
  energy: 1,
  might: 1,
  power: 0,
  rarity: 'Common',
  setCode: 'OGN',
  colors: [],
  imageUrl: null,
  cardmarketId: null,
  priceEur: null,
  isBanned: false,
  printings: [false, true].map((isFoil) => ({
    variantNumber: 'OGN-001',
    variantLabel: 'Standard',
    isFoil,
    priceEur: null,
  })),
};

test('unrelated collection edits do not rerender a card tile', () => {
  const previous = new Map([['OGN-001::std', { quantity: 1 }]]);
  const next = new Map([...previous, ['OGN-002::std', { quantity: 2 }]]);
  expect(cardTileOwnershipEqual(card, null, previous, next)).toBe(true);
});

test('quantity changes refresh the affected tile immediately', () => {
  const previous = new Map([['OGN-001::std', { quantity: 1 }]]);
  const next = new Map([['OGN-001::std', { quantity: 2 }]]);
  expect(cardTileOwnershipEqual(card, null, previous, next)).toBe(false);
});

test('finish changes refresh picker options even when the total is unchanged', () => {
  const previous = new Map([
    ['OGN-001::std', { quantity: 1 }],
    ['OGN-001::foil', { quantity: 0 }],
  ]);
  const next = new Map([
    ['OGN-001::std', { quantity: 0 }],
    ['OGN-001::foil', { quantity: 1 }],
  ]);
  expect(cardTileOwnershipEqual(card, null, previous, next)).toBe(false);
});
