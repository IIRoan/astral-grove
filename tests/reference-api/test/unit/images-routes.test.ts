import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { createImagesRoutes } from '../../src/routes/images.js';
import type {
  ImageStoreService,
  ServeImageResult,
} from '../../src/services/image-store.js';

function createImagesApp(serve: ImageStoreService['serveImage']) {
  const images = { serveImage: serve } as ImageStoreService;
  return new Elysia().use(createImagesRoutes(images));
}

describe('images routes', () => {
  test('GET /api/v1/images/* returns 404 when key is missing', async () => {
    const app = createImagesApp(async () => null);
    const response = await app.handle(new Request('http://localhost/api/v1/images/'));
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('NOT_FOUND');
  });

  test('GET /api/v1/images/* returns image body with cache headers', async () => {
    const body = new TextEncoder().encode('webp-bytes').buffer;
    const result: ServeImageResult = {
      kind: 'body',
      body,
      contentType: 'image/webp',
      source: 'memory',
      etag: '"cards/OGN-001.webp:9"',
    };
    const app = createImagesApp(async () => result);

    const response = await app.handle(
      new Request('http://localhost/api/v1/images/cards/OGN-001.webp')
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('etag')).toBe('"cards/OGN-001.webp:9"');
    expect(response.headers.get('x-image-source')).toBe('memory');
    expect(await response.arrayBuffer()).toEqual(body);
  });

  test('GET /api/v1/images/* returns 304 when If-None-Match matches etag', async () => {
    const result: ServeImageResult = {
      kind: 'body',
      body: new ArrayBuffer(8),
      contentType: 'image/webp',
      source: 'memory',
      etag: '"cards/OGN-002.webp:8"',
    };
    const app = createImagesApp(async () => result);

    const response = await app.handle(
      new Request('http://localhost/api/v1/images/cards/OGN-002.webp', {
        headers: { 'if-none-match': '"cards/OGN-002.webp:8"' },
      })
    );
    expect(response.status).toBe(304);
    expect(response.headers.get('etag')).toBe('"cards/OGN-002.webp:8"');
  });

  test('GET /api/v1/images/* redirects to CDN when store returns redirect', async () => {
    const app = createImagesApp(async () => ({
      kind: 'redirect',
      url: 'https://cdn.piltoverarchive.com/cards/OGN-003.webp',
    }));

    const response = await app.handle(
      new Request('http://localhost/api/v1/images/cards/OGN-003.webp')
    );
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://cdn.piltoverarchive.com/cards/OGN-003.webp'
    );
    expect(response.headers.get('x-image-source')).toBe('cdn-redirect');
  });
});
