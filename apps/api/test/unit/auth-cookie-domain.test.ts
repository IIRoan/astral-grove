import { describe, expect, test } from 'bun:test';
import { resolveAuthCookieDomain } from '../../src/lib/auth-cookie-domain.js';
import type { Env } from '../../src/env.js';

function env(overrides: Partial<Env>): Env {
  return {
    NODE_ENV: 'production',
    PORT: 7000,
    DATABASE_URL: 'postgres://localhost/db',
    PA_API_KEY: 'ak_test',
    PA_BASE_URL: 'https://piltoverarchive.com/api/external',
    ADMIN_SYNC_TOKEN: 'dev-sync-token-change-me',
    SYNC_CRON_ENABLED: true,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'https://api.example.com',
    TRUSTED_ORIGINS: ['https://app.example.com'],
    PUBLIC_APP_URL: 'https://app.example.com',
    CATALOG_WARMUP_ON_START: false,
    EMBEDDING_PROVIDER: 'none',
    DB_POOL_MAX: 5,
    ...overrides,
  };
}

describe('resolveAuthCookieDomain', () => {
  test('uses explicit AUTH_COOKIE_DOMAIN when set', () => {
    expect(resolveAuthCookieDomain(env({ AUTH_COOKIE_DOMAIN: 'example.com' }))).toBe(
      'example.com'
    );
  });

  test('derives shared parent from API and trusted frontend origins', () => {
    expect(
      resolveAuthCookieDomain(
        env({
          BETTER_AUTH_URL: 'https://riftapi.solace.onl',
          TRUSTED_ORIGINS: ['https://rift.solace.onl'],
        })
      )
    ).toBe('solace.onl');
  });

  test('derives parent domain from API host alone', () => {
    expect(resolveAuthCookieDomain(env({ TRUSTED_ORIGINS: [] }))).toBe('example.com');
  });

  test('returns undefined in development', () => {
    expect(resolveAuthCookieDomain(env({ NODE_ENV: 'development' }))).toBeUndefined();
  });
});
