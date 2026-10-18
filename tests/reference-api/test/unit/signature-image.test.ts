import { describe, expect, test } from 'bun:test';
import {
  isPiltoverArchiveImageUrl,
  resolveSignedOvernumberedImageUrl,
} from '../../src/lib/signature-image.js';
import { CDN_BASE_URL } from '../../src/lib/s3.js';

describe('isPiltoverArchiveImageUrl', () => {
  test('accepts PA CDN hosts', () => {
    expect(
      isPiltoverArchiveImageUrl('https://cdn.piltoverarchive.com/cards/VEN-189.webp')
    ).toBe(true);
    expect(
      isPiltoverArchiveImageUrl('https://images.piltoverarchive.com/cards/VEN-189.webp')
    ).toBe(true);
  });

  test('rejects non-PA hosts and invalid URLs', () => {
    expect(isPiltoverArchiveImageUrl('https://example.com/VEN-189.webp')).toBe(false);
    expect(isPiltoverArchiveImageUrl('not-a-url')).toBe(false);
  });
});

describe('resolveSignedOvernumberedImageUrl', () => {
  test('returns the first PA candidate that exists', async () => {
    const originalFetch = globalThis.fetch;
    const hit = `${CDN_BASE_URL}/cards/VEN-189S.webp`;
    const seen: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string' || input instanceof URL ? String(input) : input.url;
      seen.push(url);
      if (url === hit) {
        return new Response(null, {
          status: 200,
          headers: { 'content-type': 'image/webp' },
        });
      }
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    try {
      const url = await resolveSignedOvernumberedImageUrl('Akali', 'VEN-189*');
      expect(seen.length).toBeGreaterThan(0);
      expect(url).toBe(hit);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('returns null when no PA signed asset exists', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(null, { status: 404 })) as typeof fetch;

    try {
      const url = await resolveSignedOvernumberedImageUrl('Akali', 'VEN-189*');
      expect(url).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
