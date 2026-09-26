import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/app.js';
import type { Env } from '../../src/env.js';
import { createSyncRoutes } from '../../src/routes/sync.js';
import type { CardCacheService } from '../../src/services/card-cache.js';
import type { PriceCacheService } from '../../src/services/price-cache.js';
import type { SyncEngine } from '../../src/services/sync-engine.js';

function env(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 7000,
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgres://riftbound:riftbound@localhost:5433/riftbound_test',
    PA_API_KEY: 'ak_test_key_1234567890',
    PA_BASE_URL: 'https://piltoverarchive.com/api/external',
    ADMIN_SYNC_TOKEN: 'sync-token-12345678',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:7000',
    TRUSTED_ORIGINS: ['http://localhost:7001'],
    PUBLIC_APP_URL: 'http://localhost:7001',
    CATALOG_WARMUP_ON_START: false,
    EMBEDDING_PROVIDER: 'none',
    CARDMARKET_GAME_ID: 22,
    DB_POOL_MAX: 5,
    ...overrides,
  };
}

describe('sync admin routes', () => {
  const { app } = createApp(env());

  async function postSync(path: string, headers?: HeadersInit) {
    return app.handle(
      new Request(`http://localhost${path}`, {
        method: 'POST',
        headers,
      })
    );
  }

  test('POST /api/v1/sync/catalog rejects missing bearer token', async () => {
    const response = await postSync('/api/v1/sync/catalog');
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('POST /api/v1/sync/catalog rejects invalid bearer token', async () => {
    const response = await postSync('/api/v1/sync/catalog', {
      Authorization: 'Bearer wrong-token',
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('POST /api/v1/sync/prices rejects missing bearer token', async () => {
    const response = await postSync('/api/v1/sync/prices');
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('GET /api/v1/sync/status requires admin bearer token', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/sync/status')
    );
    expect(response.status).toBe(401);
  });
});

describe('POST /api/v1/sync/prices history prune', () => {
  const token = 'unit-test-admin-sync-token';
  const syncResult = {
    changed: false,
    rowCount: 10,
    productCount: 5,
    hash: 'abc',
    source: 'cardmarket' as const,
    gameId: 22,
    exportCreatedAt: '2026-09-26T00:00:00Z',
    cardmarketIdsBackfilled: 0,
  };

  function pricesRoutes(overrides: Partial<Env>, pruneImpl?: () => Promise<unknown>) {
    const pruneCalls: unknown[] = [];
    const prices = {
      syncFromCardmarket: () => Promise.resolve(syncResult),
      pruneHistory: (retention: unknown) => {
        pruneCalls.push(retention);
        return pruneImpl
          ? pruneImpl()
          : Promise.resolve({
              deleted: 3,
              wouldDelete: 3,
              retainDays: 90,
              retainSnapshotsPerSlot: 30,
              dryRun: false,
            });
      },
    } as unknown as PriceCacheService;
    const cards = { invalidateSearchCache: () => {} } as unknown as CardCacheService;
    const routes = createSyncRoutes(
      {} as SyncEngine,
      prices,
      cards,
      env({ ADMIN_SYNC_TOKEN: token, ...overrides })
    );
    const post = () =>
      routes.handle(
        new Request('http://localhost/api/v1/sync/prices', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      );
    return { post, pruneCalls };
  }

  test('prunes price history with configured retention after syncing', async () => {
    const { post, pruneCalls } = pricesRoutes({
      PRICE_HISTORY_RETAIN_DAYS: 45,
      PRICE_HISTORY_RETAIN_SNAPSHOTS: 12,
    });
    const response = await post();
    expect(response.status).toBe(200);
    expect(pruneCalls).toEqual([{ retainDays: 45, retainSnapshotsPerSlot: 12 }]);
  });

  test('still returns the sync result when prune fails', async () => {
    const { post } = pricesRoutes({}, () => Promise.reject(new Error('prune boom')));
    const response = await post();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: typeof syncResult };
    expect(body.data).toEqual(syncResult);
  });
});
