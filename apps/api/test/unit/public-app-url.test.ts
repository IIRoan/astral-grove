import { describe, expect, test } from 'bun:test';
import { loadEnv, resolvePublicAppUrl } from '../../src/env.js';

describe('resolvePublicAppUrl', () => {
  test('prefers an explicit PUBLIC_APP_URL', () => {
    expect(
      resolvePublicAppUrl({
        publicAppUrl: 'https://riftbounddev.roan.dev/',
        betterAuthUrl: 'http://localhost:7000',
        nodeEnv: 'development',
      })
    ).toBe('https://riftbounddev.roan.dev');
  });

  test('production refuses to boot without PUBLIC_APP_URL', () => {
    const saved = { ...process.env };
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      PA_API_KEY: 'ak_test',
      ADMIN_SYNC_TOKEN: 'x'.repeat(16),
      BETTER_AUTH_SECRET: 'x'.repeat(32),
    });
    delete process.env.PUBLIC_APP_URL;
    try {
      expect(() => loadEnv()).toThrow('PUBLIC_APP_URL is required in production');
    } finally {
      for (const key of Object.keys(process.env)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  });

  test('follows a non-loopback BETTER_AUTH_URL in development', () => {
    expect(
      resolvePublicAppUrl({
        betterAuthUrl: 'https://riftbounddev.roan.dev',
        nodeEnv: 'development',
      })
    ).toBe('https://riftbounddev.roan.dev');
  });

  test('falls back to local Expo web for localhost Better Auth', () => {
    expect(
      resolvePublicAppUrl({
        betterAuthUrl: 'http://localhost:7000',
        nodeEnv: 'development',
      })
    ).toBe('http://localhost:7001');
  });
});
