import { describe, expect, mock, test } from 'bun:test';
import type { CardDetail } from '@riftbound/contracts';

const getCard = mock(async (variantNumber: string) => {
  // The catalog only knows the base printing; the signature SKU 404s.
  if (variantNumber === 'OGN-305') {
    return { data: legendDetail };
  }
  throw new Error(`Piltover Archive API 404: /v1/cards/${variantNumber}`);
});

mock.module('@/src/api/client', () => ({ api: { getCard } }));

const { resolveDeckCardByVariant } = await import('@/hooks/useDeckCardResolver');

const legendDetail = {
  id: 'legend-id',
  name: 'Yasuo, Unforgiven',
  type: 'Legend',
  super: null,
  tags: [],
  colors: [],
  energy: 0,
  power: 0,
  banEffectiveDate: null,
  variants: [
    {
      variantNumber: 'OGN-259',
      rarity: 'Rare',
      variantType: 'Standard',
      imageUrl: null,
    },
    {
      variantNumber: 'OGN-305',
      rarity: 'Showcase',
      variantType: 'Overnumbered',
      imageUrl: null,
    },
  ],
} as unknown as CardDetail;

describe('resolveDeckCardByVariant', () => {
  test('falls back to the base card code when the exact variant 404s', async () => {
    const card = await resolveDeckCardByVariant('OGN-305s');
    expect(card).not.toBeNull();
    expect(card?.name).toBe('Yasuo, Unforgiven');
    expect(card?.type).toBe('Legend');
    // Resolved against the base printing, not the missing signature SKU.
    expect(card?.variantNumber).toBe('OGN-305');
    expect(getCard).toHaveBeenCalledWith('OGN-305s');
    expect(getCard).toHaveBeenCalledWith('OGN-305');
  });

  test('returns null when neither the variant nor the base resolve', async () => {
    const card = await resolveDeckCardByVariant('ZZZ-999x');
    expect(card).toBeNull();
  });
});
