import { describe, expect, test } from 'bun:test';
import { GlobalSearchResponse } from '@riftbound/contracts';
import { authFetch } from './helpers/auth.js';

describe('GET /api/v1/search', () => {
  test('returns card hits for a text query', async () => {
    const res = await authFetch('/api/v1/search?q=vi&limit=5');
    expect(res.ok).toBe(true);
    const json = GlobalSearchResponse.parse(await res.json());
    expect(json.data.cards).toBeDefined();
    expect(json.meta.tookMs).toBeGreaterThanOrEqual(0);
  });

  test('returns empty deck stub when types=decks', async () => {
    const res = await authFetch('/api/v1/search?q=deck&types=decks&limit=5');
    expect(res.ok).toBe(true);
    const json = GlobalSearchResponse.parse(await res.json());
    expect(json.data.decks).toEqual({ hits: [], total: 0 });
  });
});
