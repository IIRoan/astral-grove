import { describe, expect, test } from 'bun:test';
import {
  buildCardmarketProductUrl,
  CARDMARKET_RIFTBOUND_ORIGIN,
} from '@/lib/cardmarket';

describe('buildCardmarketProductUrl', () => {
  test('builds a Riftbound product deep link', () => {
    expect(buildCardmarketProductUrl(845712)).toBe(
      `${CARDMARKET_RIFTBOUND_ORIGIN}/Products?idProduct=845712`
    );
  });

  test('rejects non-positive ids', () => {
    expect(() => buildCardmarketProductUrl(0)).toThrow('Invalid Cardmarket product id');
    expect(() => buildCardmarketProductUrl(-3)).toThrow(
      'Invalid Cardmarket product id'
    );
  });
});
