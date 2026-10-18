import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { FiltersResponse } from '@riftbound/contracts';
import { errorPlugin } from '../../src/plugins/error-handler.js';
import { createFiltersRoutes } from '../../src/routes/filters.js';

describe('filters routes', () => {
  test('GET /api/v1/filters validates the snapshot payload', async () => {
    const app = new Elysia().use(errorPlugin).use(
      createFiltersRoutes({
        getFiltersMeta: async () => ({
          snapshot: {
            colors: [],
            sets: [],
            types: [],
            supertypes: [],
            rarities: [],
            variants: [],
          },
          cachedAt: '2026-08-24T09:21:00.000Z',
          catalogHash: 'catalog-hash',
          pricesCatalogHash: 'prices-hash',
          variantCount: 0,
        }),
      } as never)
    );

    const response = await app.handle(new Request('http://localhost/api/v1/filters'));
    const body = FiltersResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(body.meta.variantCount).toBe(0);
    expect(body.data.sets).toEqual([]);
  });
});
