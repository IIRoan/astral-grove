import { beforeEach, describe, expect, mock, test } from 'bun:test';
import {
  CARDMARKET_RIFTBOUND_GAME_ID,
  CardmarketPriceGuideExportSchema,
  fetchCardmarketPriceGuide,
  priceGuideDownloadUrl,
} from '../../src/upstream/cardmarket-export.js';

describe('priceGuideDownloadUrl', () => {
  test('builds the Cardmarket S3 export URL', () => {
    expect(priceGuideDownloadUrl(22)).toBe(
      'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json'
    );
    expect(CARDMARKET_RIFTBOUND_GAME_ID).toBe(22);
  });
});

describe('CardmarketPriceGuideExportSchema', () => {
  test('coerces nullable averages to null', () => {
    const parsed = CardmarketPriceGuideExportSchema.parse({
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
      priceGuides: [
        {
          idProduct: 1,
          idCategory: 2,
          trend: 1.5,
          low: undefined,
        },
      ],
    });
    expect(parsed.priceGuides[0]?.low).toBeNull();
  });
});

describe('fetchCardmarketPriceGuide', () => {
  const payload = {
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    priceGuides: [{ idProduct: 1, idCategory: 2, trend: 1.5 }],
  };

  beforeEach(() => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;
  });

  test('downloads and validates the export', async () => {
    const guide = await fetchCardmarketPriceGuide();
    expect(guide.priceGuides).toHaveLength(1);
    expect(guide.priceGuides[0]?.idProduct).toBe(1);
  });

  test('throws when Cardmarket responds with an error', async () => {
    globalThis.fetch = mock(
      async () => new Response('nope', { status: 503 })
    ) as typeof fetch;
    await expect(fetchCardmarketPriceGuide(22)).rejects.toThrow(
      'Cardmarket price guide download failed'
    );
  });
});
