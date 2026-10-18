import { describe, expect, mock, test } from 'bun:test';
import { Elysia } from 'elysia';
import { createSearchRoutes } from '../../src/routes/search.js';

function createSearchApp(
  globalSearch: (query: {
    q: string;
    types?: string;
    limit: number;
    page: number;
  }) => Promise<{
    data: {
      cards?: {
        hits: Array<{
          kind: 'card';
          variantNumber: string;
          name: string;
          imageUrl: string;
          setCode: string;
          type: string;
          rarity: string;
        }>;
        total: number;
      };
      decks?: {
        hits: Array<{ kind: 'deck'; id: string; name: string }>;
        total: number;
      };
    };
    meta: { tookMs: number; catalogHash: string };
  }>
) {
  return new Elysia().use(createSearchRoutes({ globalSearch } as never));
}

describe('search routes', () => {
  test('GET /api/v1/search parses query defaults before calling the service', async () => {
    const globalSearch = mock(async (_query) => ({
      data: {
        cards: {
          hits: [
            {
              kind: 'card' as const,
              variantNumber: 'OGN-001',
              name: 'Ahri',
              imageUrl: 'https://example.com/ahri.webp',
              setCode: 'OGN',
              type: 'Legend',
              rarity: 'Rare',
            },
          ],
          total: 1,
        },
      },
      meta: {
        tookMs: 4,
        catalogHash: 'catalog-123',
      },
    }));

    const app = createSearchApp(globalSearch);
    const response = await app.handle(
      new Request('http://localhost/api/v1/search?q=Ahri')
    );

    expect(response.status).toBe(200);
    expect(globalSearch).toHaveBeenCalledWith({
      q: 'Ahri',
      limit: 10,
      page: 1,
    });
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=60, stale-while-revalidate=30'
    );
  });
});
