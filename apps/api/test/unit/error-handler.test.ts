import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { createErrorPlugin } from '../../src/plugins/error-handler.js';
import { parseRequest } from '../../src/lib/request-validation.js';

function createApp() {
  return createErrorPlugin()
    .get('/unauthorized', () => {
      throw new Error('Unauthorized');
    })
    .get('/missing', () => {
      throw new Error('Card not found');
    })
    .get('/bad-request', () => {
      parseRequest(
        z.object({
          q: z.string().min(1),
        }),
        {}
      );
    })
    .get('/invalid', () => {
      throw new z.ZodError([
        {
          code: 'custom',
          message: 'response mismatch',
          path: ['data', 'id'],
        },
      ]);
    })
    .get('/boom', () => {
      throw new Error('database exploded');
    });
}

describe('errorPlugin', () => {
  test('maps Unauthorized to 401', async () => {
    const res = await createApp().handle(new Request('http://localhost/unauthorized'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('maps not-found messages to 404', async () => {
    const res = await createApp().handle(new Request('http://localhost/missing'));
    expect(res.status).toBe(404);
  });

  test('maps request validation errors to 422', async () => {
    const res = await createApp().handle(new Request('http://localhost/bad-request'));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Request validation failed');
  });

  test('maps plain zod errors to 500', async () => {
    const res = await createApp().handle(new Request('http://localhost/invalid'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred');
  });

  test('maps unknown failures to 500', async () => {
    const res = await createApp().handle(new Request('http://localhost/boom'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred');
  });

  test('maps validation errors from nested route plugins', async () => {
    const nested = new Elysia({ prefix: '/nested' }).get('/bad', () => {
      parseRequest(z.object({ q: z.string().min(1) }), {});
    });
    const res = await createErrorPlugin()
      .use(nested)
      .handle(new Request('http://localhost/nested/bad'));
    expect(res.status).toBe(422);
  });
});
