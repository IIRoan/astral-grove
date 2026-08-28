import { describe, expect, mock, test } from 'bun:test';
import {
  API_KEEP_ALIVE_INTERVAL_MS,
  apiHealthUrl,
  pingApiKeepAlive,
} from './api-keep-alive';

describe('apiHealthUrl', () => {
  test('joins the health path without a trailing slash', () => {
    expect(apiHealthUrl('https://riftapi.solace.onl/')).toBe(
      'https://riftapi.solace.onl/api/v1/health'
    );
  });
});

describe('pingApiKeepAlive', () => {
  test('returns true when health responds ok', async () => {
    globalThis.fetch = mock(async () => new Response('ok', { status: 200 })) as typeof fetch;

    await expect(pingApiKeepAlive('https://riftapi.solace.onl')).resolves.toBe(true);
  });

  test('returns false on network failure', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;

    await expect(pingApiKeepAlive('https://riftapi.solace.onl')).resolves.toBe(false);
  });
});

describe('API_KEEP_ALIVE_INTERVAL_MS', () => {
  test('stays under Railway serverless idle window', () => {
    expect(API_KEEP_ALIVE_INTERVAL_MS).toBeLessThan(10 * 60 * 1000);
  });
});
