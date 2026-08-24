import { describe, expect, test } from 'bun:test';
import { DeckValidateResponse } from '@riftbound/contracts';
import { apiFetch } from './support.js';

describe('images', () => {
  test('GET /api/v1/images rejects path traversal with 404', async () => {
    const res = await apiFetch('/api/v1/images/cards/../secrets.txt');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('NOT_FOUND');
  });

  test('GET /api/v1/images rejects direct thumbs access with 404', async () => {
    const res = await apiFetch('/api/v1/images/thumbs/w160/cards/OGN-001.webp');
    expect(res.status).toBe(404);
  });
});

describe('deck-rules over HTTP', () => {
  test('GET /api/v1/deck-rules returns canonical section targets', async () => {
    const res = await apiFetch('/api/v1/deck-rules');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.rules.sections.runes.target).toBe(12);
    expect(body.data.rules.sections.mainDeck.target).toBe(39);
  });

  test('POST /api/v1/deck-rules/validate reports missing legend', async () => {
    const res = await apiFetch('/api/v1/deck-rules/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        legend: null,
        champion: null,
        mainDeck: [],
        runes: [],
        battlefields: [],
        sideboard: [],
      }),
    });
    expect(res.status).toBe(200);
    const body = DeckValidateResponse.parse(await res.json());
    expect(body.data.hasErrors).toBe(true);
    expect(
      body.data.messages.some((message) => message.code === 'missing_legend')
    ).toBe(true);
  });
});
