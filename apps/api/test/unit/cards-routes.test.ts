import { describe, expect, mock, test } from 'bun:test';
import { CardsListResponse, CatalogIndexResponse } from '@riftbound/contracts';
import type { Env } from '../../src/env.js';
import { createErrorPlugin } from '../../src/plugins/error-handler.js';
import { createCardsRoutes } from '../../src/routes/cards.js';

function env(): Env {
  return {
    NODE_ENV: 'test',
    PORT: 7000,
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgres://riftbound:riftbound@localhost:5433/riftbound_test',
    PA_API_KEY: 'ak_test_key_1234567890',
    PA_BASE_URL: 'https://piltoverarchive.com/api/external',
    ADMIN_SYNC_TOKEN: 'sync-token-12345678',
    SYNC_CRON_ENABLED: false,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:7000',
    TRUSTED_ORIGINS: ['http://localhost:7001'],
    PUBLIC_APP_URL: 'http://localhost:7001',
    CATALOG_WARMUP_ON_START: false,
    EMBEDDING_PROVIDER: 'none',
    CARDMARKET_GAME_ID: 22,
    DB_POOL_MAX: 5,
  };
}

function createCardsApp(overrides?: {
  search?: () => Promise<{
    items: never[];
    total: number;
    source: 'cache';
    catalogHash: string;
  }>;
  listIndex?: () => Promise<{
    items: never[];
    catalogHash: string;
    pricesCatalogHash: string;
    total: number;
  }>;
}) {
  const cards = {
    search:
      overrides?.search ??
      (async () => ({
        items: [],
        total: 0,
        source: 'cache' as const,
        catalogHash: 'catalog-hash',
      })),
    listIndex:
      overrides?.listIndex ??
      (async () => ({
        items: [],
        catalogHash: 'catalog-hash',
        pricesCatalogHash: 'prices-hash',
        total: 0,
      })),
    getByVariantNumber: async () => {
      throw new Error('unused');
    },
    batchGet: async () => ({ found: [], notFound: [], source: 'cache' as const }),
  };

  return createErrorPlugin().use(createCardsRoutes(cards as never, env()));
}

describe('cards routes', () => {
  test('GET /api/v1/cards parses query defaults and validates the response', async () => {
    const search = mock(async () => ({
      items: [],
      total: 0,
      source: 'cache' as const,
      catalogHash: 'catalog-hash',
    }));
    const app = createCardsApp({ search });
    const response = await app.handle(new Request('http://localhost/api/v1/cards'));
    const body = CardsListResponse.parse(await response.json());

    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50, sortBy: 'name', dir: 'asc' })
    );
    expect(body.meta.pagination).toMatchObject({
      total: 0,
      page: 1,
      limit: 50,
      hasNext: false,
    });
  });

  test('GET /api/v1/cards rejects invalid query values', async () => {
    const app = createCardsApp();
    const response = await app.handle(
      new Request('http://localhost/api/v1/cards?page=0')
    );
    expect(response.status).toBe(422);
  });

  test('GET /api/v1/cards/index validates the catalog payload', async () => {
    const app = createCardsApp();
    const response = await app.handle(
      new Request('http://localhost/api/v1/cards/index')
    );
    const body = CatalogIndexResponse.parse(await response.json());
    expect(response.status).toBe(200);
    expect(body.meta.source).toBe('cache');
  });

  test('GET /api/v1/cards/:variantNumber rejects malformed ids', async () => {
    const app = createCardsApp();
    const response = await app.handle(
      new Request('http://localhost/api/v1/cards/not a variant')
    );
    expect(response.status).toBe(422);
  });
});
