import { Elysia } from 'elysia';
import { parseThumbWidth } from '../lib/image-resize.js';
import type { ImageStoreService } from '../services/image-store.js';
import { notFoundResponse, setApiError } from '../lib/api-error.js';

const BODY_CACHE_CONTROL = 'public, max-age=604800, immutable';
const REDIRECT_CACHE_CONTROL = 'public, max-age=300';

export function createImagesRoutes(images: ImageStoreService) {
  return new Elysia({ prefix: '/api/v1/images' }).get('/*', { detail: { tags: ['images'] } }, async ({ params, query, request, set }) => {
    const key = params['*'];
    if (!key) {
      return setApiError(set, notFoundResponse('Image not found'));
    }

    const width = parseThumbWidth(typeof query.w === 'string' ? query.w : undefined);
    const result = await images.serveImage(key, width != null ? { width } : undefined);
    if (!result) {
      return setApiError(set, notFoundResponse('Image not found'));
    }

    if (result.kind === 'redirect') {
      return new Response(null, {
        status: 302,
        headers: {
          location: result.url,
          'cache-control': REDIRECT_CACHE_CONTROL,
          'x-image-source': 'cdn-redirect',
        },
      });
    }

    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === result.etag) {
      return new Response(null, {
        status: 304,
        headers: {
          etag: result.etag,
          'cache-control': BODY_CACHE_CONTROL,
          'x-image-source': result.source,
        },
      });
    }

    return new Response(result.body, {
      headers: {
        'content-type': result.contentType,
        'cache-control': BODY_CACHE_CONTROL,
        etag: result.etag,
        'x-image-source': result.source,
      },
    });
  });
}
