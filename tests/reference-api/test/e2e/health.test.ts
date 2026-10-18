import { describe, expect, test } from 'bun:test';
import { HealthResponse } from '@riftbound/contracts';
import { apiFetch, apiJson } from './support.js';

describe('health', () => {
  test('GET /api/v1/health returns ok with database connected', async () => {
    const json = await apiJson<unknown>('/api/v1/health');
    const parsed = HealthResponse.parse(json);

    expect(parsed.data.status).toBe('ok');
    expect(parsed.data.db).toBe('ok');
    expect(typeof parsed.data.emailVerificationRequired).toBe('boolean');
  });
});

describe('sync status', () => {
  test('GET /api/v1/sync/status requires admin bearer token', async () => {
    const res = await apiFetch('/api/v1/sync/status');
    expect(res.status).toBe(401);
  });
});
