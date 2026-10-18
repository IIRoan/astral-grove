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

  test('serveImage does not buffer oversized CDN responses', async () => {
    const store = new ImageStoreService(baseEnv, { maxImageBytes: 8 });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(new Uint8Array(32), {
        status: 200,
        headers: { 'content-type': 'image/webp', 'content-length': '32' },
      });
    try {
      const result = await store.serveImage('cards/OGN-001.webp', {
        clientIp: '203.0.113.9',
      });
      expect(result).toEqual({
        kind: 'redirect',
        url: 'https://cdn.piltoverarchive.com/cards/OGN-001.webp',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('serveImage rate-limits CDN misses per client IP', async () => {
    const store = new ImageStoreService(baseEnv, {
      cdnMissPerIpMax: 1,
      cdnMissGlobalMax: 10,
    });
    let fetches = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetches += 1;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/webp' },
      });
    };
    try {
      const first = await store.serveImage('cards/OGN-001.webp', {
        clientIp: '203.0.113.9',
      });
      const second = await store.serveImage('cards/OGN-002.webp', {
        clientIp: '203.0.113.9',
      });
      expect(first?.kind).toBe('body');
      expect(second).toEqual({
        kind: 'redirect',
        url: 'https://cdn.piltoverarchive.com/cards/OGN-002.webp',
      });
      expect(fetches).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('serveImage serves memory hits without another CDN fetch', async () => {
    const store = new ImageStoreService(baseEnv, { cdnMissPerIpMax: 1 });
    let fetches = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      fetches += 1;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/webp' },
      });
    };
    try {
      const first = await store.serveImage('cards/OGN-001.webp', {
        clientIp: '203.0.113.9',
      });
      fetches = 0;
      const second = await store.serveImage('cards/OGN-001.webp', {
        clientIp: '203.0.113.9',
      });
      expect(first?.kind).toBe('body');
      expect(second?.kind).toBe('body');
      expect(second && 'source' in second ? second.source : null).toBe('memory');
      expect(fetches).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
