import { describe, expect, test } from 'bun:test';
import { apiFetch } from './support.js';

describe('sync admin auth', () => {
  test('POST /api/v1/sync/catalog rejects missing bearer token', async () => {
    const res = await apiFetch('/api/v1/sync/catalog', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('POST /api/v1/sync/catalog rejects invalid bearer token', async () => {
    const res = await apiFetch('/api/v1/sync/catalog', {
      method: 'POST',
      headers: { Authorization: 'Bearer not-the-real-token' },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('POST /api/v1/sync/prices rejects missing bearer token', async () => {
    const res = await apiFetch('/api/v1/sync/prices', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('UNAUTHORIZED');
  });

  test('GET /api/v1/sync/status requires admin bearer token', async () => {
    const res = await apiFetch('/api/v1/sync/status');
    expect(res.status).toBe(401);
  });
});
