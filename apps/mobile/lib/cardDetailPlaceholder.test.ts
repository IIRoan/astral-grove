import { describe, expect, test } from 'bun:test';
import type { CardListItem } from '@riftbound/contracts';
import {
  cardListItemToDetail,
  cardListItemToDetailResponse,
} from '@/lib/cardDetailPlaceholder';
import { findVariantByNumber } from '@/utils/variants';

const listCard: CardListItem = {
  cardId: '11111111-1111-4111-8111-111111111111',
  variantNumber: 'OGN-001',
  name: 'Jinx - Rebel',
  type: 'Unit',
  energy: 3,
  might: 3,
  power: 0,
  rarity: 'Rare',
  setCode: 'OGN',
  colors: ['Fury'],
  imageUrl: 'https://cdn.piltoverarchive.com/cards/ogn-001.webp',
  cardmarketId: 42,
  priceEur: {
    currency: 'EUR',
    low: 1,
    market: 2,
    avg7d: 1.5,
    isFoil: false,
  },
  printings: [
    {
      variantNumber: 'OGN-001',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: {
        currency: 'EUR',
        low: 1,
        market: 2,
        avg7d: 1.5,
        isFoil: false,
      },
    },
    {
      variantNumber: 'OGN-001*',
      variantLabel: 'Foil',
      isFoil: true,
      priceEur: {
        currency: 'EUR',
        low: 4,
        market: 5,
        avg7d: 4.5,
        isFoil: true,
      },
    },
  ],
  isBanned: false,
};

describe('cardListItemToDetail', () => {
  test('maps list stats, colors, and printings into detail variants', () => {
    const detail = cardListItemToDetail(listCard);

    expect(detail.id).toBe(listCard.cardId);
    expect(detail.name).toBe(listCard.name);
    expect(detail.energy).toBe(3);
    expect(detail.colors).toEqual([{ id: 'placeholder-color-Fury', name: 'Fury' }]);
    expect(detail.variants).toHaveLength(2);
    expect(findVariantByNumber(detail.variants, 'OGN-001*')?.variantLabel).toBe('Foil');
  });

  test('wraps detail in a response envelope for react-query', () => {
    const response = cardListItemToDetailResponse(listCard);
    expect(response.data.name).toBe(listCard.name);
    expect(response.meta.source).toBe('cache');
  });
});
