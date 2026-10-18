import { describe, expect, test } from 'bun:test';
import { apiFetch } from './support.js';

describe('internal releases over HTTP', () => {
  test.each([
    'preview-android.fingerprint',
    'preview-ios.fingerprint',
    'production.apk',
    'private.json',
    'preview.apk',
    'preview.apk?token=invalid',
  ])('rejects inaccessible release requests: %s', async (filename) => {
    const response = await apiFetch(`/api/v1/releases/${filename}`);
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: 'NOT_FOUND',
      message: 'Build unavailable',
    });
  });
});
