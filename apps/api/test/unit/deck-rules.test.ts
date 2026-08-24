import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/app.js';
import type { Env } from '../../src/env.js';

function env(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    PORT: 7000,
    HOST: '127.0.0.1',
    DATABASE_URL: 'postgres://riftbound:riftbound@localhost:5433/riftbound_test',
    PA_API_KEY: 'ak_test_key_1234567890',
    PA_BASE_URL: 'https://piltoverarchive.com/api/external',
    ADMIN_SYNC_TOKEN: 'sync-token-12345678',
    SYNC_CRON_ENABLED: false,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:7000',
    TRUSTED_ORIGINS: ['http://localhost:7001'],
    PUBLIC_APP_URL: 'http://localhost:7001',
    CATALOG_WARMUP_ON_START: false,
    CARDMARKET_GAME_ID: 22,
    DB_POOL_MAX: 5,
    ...overrides,
  };
}

function deckCard(overrides?: Record<string, unknown>) {
  return {
    cardId: 'card-legend',
    variantNumber: 'OGN-001',
    name: 'Jinx Rebel',
    type: 'Unit',
    super: 'Champion',
    tags: ['Jinx'],
    colors: ['Mind', 'Chaos'],
    energy: 0,
    setCode: 'OGN',
    rarity: 'Rare',
    variantType: 'Standard',
    isSignature: false,
    ...overrides,
  };
}

function deckEntry(card: ReturnType<typeof deckCard>, count = 1) {
  return { card, count };
}

describe('deck-rules routes', () => {
  const { app } = createApp(env());

  test('GET /api/v1/deck-rules returns canonical rules', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deck-rules')
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.rules.sections.runes.target).toBe(12);
    expect(body.data.rules.sections.mainDeck.target).toBe(39);
  });

  test('POST /api/v1/deck-rules/validate reports missing legend', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deck-rules/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legend: null,
          champion: null,
          mainDeck: [],
          runes: [],
          battlefields: [],
          sideboard: [],
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.hasErrors).toBe(true);
    expect(
      body.data.messages.some((m: { code: string }) => m.code === 'missing_legend')
    ).toBe(true);
  });

  test('POST /api/v1/deck-rules/validate accepts a minimal legal shell', async () => {
    const legend = deckCard({ cardId: 'legend-1', variantNumber: 'OGN-001' });
    const champion = deckCard({ cardId: 'champion-1', variantNumber: 'OGN-002' });
    const mainCard = deckCard({
      cardId: 'main-1',
      variantNumber: 'OGN-010',
      super: null,
      tags: [],
    });

    const response = await app.handle(
      new Request('http://localhost/api/v1/deck-rules/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'constructed',
          legend,
          champion,
          mainDeck: Array.from({ length: 39 }, () => deckEntry(mainCard)),
          runes: Array.from({ length: 12 }, (_, index) =>
            deckEntry(
              deckCard({
                cardId: `rune-${String(index)}`,
                variantNumber: `RUN-${String(index + 1).padStart(3, '0')}`,
                type: 'Rune',
                super: null,
                tags: [],
                colors: ['Mind'],
              })
            )
          ),
          battlefields: [
            deckEntry(
              deckCard({ cardId: 'bf-1', variantNumber: 'BF-001', type: 'Battlefield' })
            ),
            deckEntry(
              deckCard({ cardId: 'bf-2', variantNumber: 'BF-002', type: 'Battlefield' })
            ),
            deckEntry(
              deckCard({ cardId: 'bf-3', variantNumber: 'BF-003', type: 'Battlefield' })
            ),
          ],
          sideboard: [],
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.valid).toBe(true);
    expect(body.data.hasErrors).toBe(false);
  });

  test('POST /api/v1/deck-rules/validate reports wrong section counts', async () => {
    const response = await app.handle(
      new Request('http://localhost/api/v1/deck-rules/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legend: deckCard({ cardId: 'legend-1' }),
          champion: deckCard({ cardId: 'champion-1', variantNumber: 'OGN-002' }),
          mainDeck: [],
          runes: [],
          battlefields: [],
          sideboard: [],
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.valid).toBe(false);
    expect(
      body.data.messages.some((m: { code: string }) =>
        ['main_deck_count', 'rune_count', 'battlefield_count'].includes(m.code)
      )
    ).toBe(true);
  });
});
