import { describe, expect, test } from 'bun:test';
import {
  resolveCorsOrigins,
  resolveTrustedOrigins,
} from '../../src/lib/trusted-origins.js';
import type { Env } from '../../src/env.js';

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'production',
    PORT: 7000,
    DATABASE_URL: 'postgres://riftbound:riftbound@localhost:5433/riftbound',
    PA_API_KEY: 'ak_test_key_1234567890',
    PA_BASE_URL: 'https://piltoverarchive.com/api/external',
    ADMIN_SYNC_TOKEN: 'sync-token-12345678',
    SYNC_CRON_ENABLED: true,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'https://api.astral-grove.com',
    TRUSTED_ORIGINS: ['https://astral-grove.com'],
    PUBLIC_APP_URL: 'https://astral-grove.com',
    CATALOG_WARMUP_ON_START: false,
    EMBEDDING_PROVIDER: 'none',
    CARDMARKET_GAME_ID: 22,
    DB_POOL_MAX: 5,
    ...overrides,
  };
}

describe('resolveTrustedOrigins', () => {
  test('production includes app scheme and configured origins, not Expo tunnels', () => {
    const origins = resolveTrustedOrigins(baseEnv());
    expect(origins).toContain('astral-grove://');
    expect(origins).toContain('https://astral-grove.com');
    expect(origins).toContain('https://api.astral-grove.com');
    expect(origins).not.toContain('exp://');
    expect(origins).not.toContain('https://u.expo.dev');
    expect(origins).not.toContain('https://*.u.expo.dev');
  });

  test('adds localhost and Expo origins outside production', () => {
    const origins = resolveTrustedOrigins(baseEnv({ NODE_ENV: 'development' }));
    expect(origins).toContain('http://localhost:7000');
    expect(origins).toContain('http://localhost:7001');
    expect(origins).toContain('http://localhost:7011');
    expect(origins).toContain('exp://');
    expect(origins).toContain('astral-grove-dev://');
  });
});

describe('resolveCorsOrigins', () => {
  test('allows all origins outside production', () => {
    expect(resolveCorsOrigins(baseEnv({ NODE_ENV: 'development' }))).toBe(true);
    expect(resolveCorsOrigins(baseEnv({ NODE_ENV: 'test' }))).toBe(true);
  });

  test('returns browser origins in production', () => {
    expect(resolveCorsOrigins(baseEnv())).toEqual([
      'https://astral-grove.com',
      'https://api.astral-grove.com',
    ]);
  });

  test('includes PUBLIC_APP_URL when TRUSTED_ORIGINS is empty', () => {
    expect(
      resolveCorsOrigins(
        baseEnv({
          TRUSTED_ORIGINS: [],
          PUBLIC_APP_URL: 'https://rift.solace.onl',
          BETTER_AUTH_URL: 'https://riftapi.solace.onl',
        })
      ).sort()
    ).toEqual(['https://rift.solace.onl', 'https://riftapi.solace.onl'].sort());
  });
});
