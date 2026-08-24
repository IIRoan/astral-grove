import { Elysia } from 'elysia';
import { toApiErrorResponse } from '../lib/api-error.js';
import { logActionFailure } from '../lib/logger.js';

export function createErrorPlugin() {
  return new Elysia({ name: 'error-handler' }).error(({ error, set, request }) => {
    const response = toApiErrorResponse(error);

    if (response.status >= 500) {
      logActionFailure('api.unhandled', error, {
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
      });
    }

    set.status = response.status;
    return { error: response.error, message: response.message };
  });
}

export const errorPlugin = createErrorPlugin();
