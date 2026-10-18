import { describe, expect, test } from 'bun:test';
import {
  CardDetailResponse,
  CardsBatchResponse,
  CardsListResponse,
  CatalogIndexResponse,
} from '@riftbound/contracts';
import { apiJson } from './support.js';

describe('cards (cached catalog)', () => {
  test('GET /api/v1/cards lists cards with pagination', async () => {
    const json = await apiJson<unknown>('/api/v1/cards?limit=10&page=1&q=vi');
    const parsed = CardsListResponse.parse(json);

    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.meta.pagination.total).toBeGreaterThan(0);
    expect(parsed.meta.source).toBe('cache');
    expect(parsed.data[0]?.variantNumber).toBeTruthy();
    expect(parsed.data[0]?.imageUrl).toMatch(/^https?:\/\//);
  });

  test('GET /api/v1/cards/index returns grouped catalog rows', async () => {
    const json = await apiJson<unknown>('/api/v1/cards/index');
    const parsed = CatalogIndexResponse.parse(json);

    expect(parsed.data.length).toBeGreaterThan(0);
    expect(parsed.meta.total).toBe(parsed.data.length);
    expect(parsed.meta.catalogHash.length).toBeGreaterThan(0);
    expect(parsed.meta.pricesCatalogHash.length).toBeGreaterThan(0);
    expect(parsed.meta.source).toBe('cache');
    expect(parsed.data[0]?.printings.length).toBeGreaterThan(0);
  });

  test('GET /api/v1/cards/:variantNumber returns card detail', async () => {
    const list = CardsListResponse.parse(
      await apiJson<unknown>('/api/v1/cards?limit=1&page=1')
    );
    const variantNumber = list.data[0]?.variantNumber;
    expect(variantNumber).toBeTruthy();

    const json = await apiJson<unknown>(
      `/api/v1/cards/${encodeURIComponent(variantNumber!)}`
    );
    const parsed = CardDetailResponse.parse(json);

    expect(parsed.data.name.length).toBeGreaterThan(0);
    expect(parsed.data.variants.length).toBeGreaterThan(0);
    expect(parsed.data.variants[0]?.variantNumber).toBe(variantNumber);
  });

  test('POST /api/v1/cards/batch resolves multiple variant numbers', async () => {
    const list = CardsListResponse.parse(
      await apiJson<unknown>('/api/v1/cards?limit=3&page=1')
    );
    const variantNumbers = list.data.map((c) => c.variantNumber);

    const json = await apiJson<unknown>('/api/v1/cards/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantNumbers }),
    });
    const parsed = CardsBatchResponse.parse(json);

    expect(parsed.data.length).toBe(variantNumbers.length);
    expect(parsed.meta.found).toBe(variantNumbers.length);
    expect(parsed.meta.notFound).toEqual([]);
  });

  test('GET /api/v1/cards returns empty for nonsense query', async () => {
    const json = await apiJson<unknown>(
      '/api/v1/cards?q=zzzznotacardname99999&limit=10'
    );
    const parsed = CardsListResponse.parse(json);

    expect(parsed.data).toEqual([]);
    expect(parsed.meta.pagination.total).toBe(0);
  });
});
