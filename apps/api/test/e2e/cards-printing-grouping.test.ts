import { describe, expect, test } from 'bun:test';
import { CardsListResponse, CardDetailResponse } from '@riftbound/contracts';
import { getSearchGroupKey } from '../../src/services/card-mapper.js';
import { apiJson } from './support.js';

describe('cards printing grouping', () => {
  test('search rows keep alternate printings on separate list items', async () => {
    const json = await apiJson<unknown>(
      '/api/v1/cards?q=OGN-253&limit=20&page=1&sortBy=name&dir=asc'
    );
    const parsed = CardsListResponse.parse(json);
    expect(parsed.data.length).toBeGreaterThan(0);

    const standard = parsed.data.find((card) => card.variantNumber === 'OGN-253');
    expect(standard).toBeTruthy();
    expect(
      standard!.printings.every((printing) =>
        ['OGN-253', 'OGN-253-Foil'].includes(printing.variantNumber)
      )
    ).toBe(true);
    expect(
      standard!.printings.some(
        (printing) => printing.variantNumber === 'OGN-253-Release'
      )
    ).toBe(false);

    const promo = parsed.data.find((card) => card.variantNumber === 'OGN-253-Release');
    if (promo) {
      expect(
        promo.printings.every((printing) => printing.variantNumber.includes('Release'))
      ).toBe(true);
    }
  });

  test('browse pages do not dump every logical-card printing onto one row', async () => {
    const json = await apiJson<unknown>(
      '/api/v1/cards?limit=40&page=1&sortBy=name&dir=asc&types=Unit'
    );
    const parsed = CardsListResponse.parse(json);
    expect(parsed.data.length).toBeGreaterThan(0);

    for (const card of parsed.data) {
      const keys = new Set(
        card.printings.map((printing) =>
          getSearchGroupKey(printing.variantNumber, printing.variantLabel)
        )
      );
      expect(keys.size).toBe(1);
    }
  });

  test('card detail still exposes all printings for family switching', async () => {
    const json = await apiJson<unknown>('/api/v1/cards/OGN-253');
    const parsed = CardDetailResponse.parse(json);
    const numbers = parsed.data.variants.map((variant) => variant.variantNumber);
    expect(numbers).toContain('OGN-253');
    expect(
      numbers.some((value) => value.includes('Release') || value.includes('302'))
    ).toBe(true);
  });
});
