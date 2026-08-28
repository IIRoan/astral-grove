import { describe, expect, test } from 'bun:test';
import {
  contentTypeForKey,
  isSafeImageKey,
  objectKeyFromUrl,
  rewriteImageUrl,
} from '../../src/lib/s3.js';
import type { Env } from '../../src/env.js';

const s3Env: Env = {
  NODE_ENV: 'test',
  PORT: 7000,
  HOST: '::',
  DATABASE_URL: 'postgres://localhost/db',
  PA_API_KEY: 'ak_test',
  PA_BASE_URL: 'https://piltoverarchive.com/api/external',
  ADMIN_SYNC_TOKEN: 'dev-sync-token-change-me',
  SYNC_CRON_ENABLED: false,
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:7000',
  TRUSTED_ORIGINS: [],
  PUBLIC_APP_URL: 'http://localhost:7001',
  CATALOG_WARMUP_ON_START: false,
  EMBEDDING_PROVIDER: 'none',
  DB_POOL_MAX: 5,
  S3_ENDPOINT: 'https://account.eu.r2.cloudflarestorage.com',
  S3_REGION: 'auto',
  S3_BUCKET: 'riftbound',
  S3_ACCESS_KEY_ID: 'test-key',
  S3_SECRET_ACCESS_KEY: 'test-secret',
};

describe('s3 helpers', () => {
  test('objectKeyFromUrl extracts path from CDN URL', () => {
    expect(objectKeyFromUrl('https://cdn.piltoverarchive.com/cards/UNL-099.webp')).toBe(
      'cards/UNL-099.webp'
    );
  });

  test('rewriteImageUrl maps CDN URL to API route', () => {
    expect(
      rewriteImageUrl(s3Env, 'https://cdn.piltoverarchive.com/cards/SFD-198.webp')
    ).toBe('http://localhost:7000/api/v1/images/cards/SFD-198.webp');
  });

  test('isSafeImageKey allows cached thumb derivatives', () => {
    expect(isSafeImageKey('thumbs/w160/cards/UNL-099.webp')).toBe(true);
    expect(isSafeImageKey('thumbs/w999/cards/UNL-099.webp')).toBe(false);
    expect(isSafeImageKey('cards/evil.svg')).toBe(false);
    expect(isSafeImageKey('colors/logo.svg')).toBe(false);
  });

  test('contentTypeForKey maps webp extension', () => {
    expect(contentTypeForKey('cards/UNL-099.webp')).toBe('image/webp');
  });
});
