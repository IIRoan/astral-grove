import { describe, expect, test } from 'bun:test';
import { ImageStoreService } from '../../src/services/image-store.js';
import type { Env } from '../../src/env.js';

const baseEnv: Env = {
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
};

describe('ImageStoreService', () => {
  test('isEnabled is false when S3 env is incomplete', () => {
    const store = new ImageStoreService(baseEnv);
    expect(store.isEnabled()).toBe(false);
  });

  test('isEnabled is true when S3 env is fully configured', () => {
    const store = new ImageStoreService({
      ...baseEnv,
      S3_ENDPOINT: 'https://account.eu.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
      S3_BUCKET: 'riftbound',
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    expect(store.isEnabled()).toBe(true);
  });

  test('rewriteImageUrl delegates to s3 helper', () => {
    const store = new ImageStoreService({
      ...baseEnv,
      S3_ENDPOINT: 'https://account.eu.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
      S3_BUCKET: 'riftbound',
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
    });
    expect(
      store.rewriteImageUrl('https://cdn.piltoverarchive.com/cards/OGN-001.webp')
    ).toBe('http://localhost:7000/api/v1/images/cards/OGN-001.webp');
  });

  test('serveImage rejects path traversal and empty keys', async () => {
    const store = new ImageStoreService(baseEnv);
    expect(await store.serveImage('')).toBeNull();
    expect(await store.serveImage('cards/../secrets.txt')).toBeNull();
    expect(await store.serveImage('not-a-valid-prefix/foo.webp')).toBeNull();
  });

  test('serveImage rejects direct thumbs/ access (derivatives are internal only)', async () => {
    const store = new ImageStoreService(baseEnv);
    expect(await store.serveImage('thumbs/w160/cards/OGN-001.webp')).toBeNull();
  });
});
