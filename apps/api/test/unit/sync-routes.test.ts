import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/app.js';
import type { Env } from '../../src/env.js';

function env(overrides: Partial<Env> = {}): Env {
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
