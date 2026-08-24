import { Elysia } from 'elysia';
import { GlobalSearchQuery, GlobalSearchResponse } from '@riftbound/contracts';
import type { CardCacheService } from '../services/card-cache.js';
import { parseRequest } from '../lib/request-validation.js';

export function createSearchRoutes(cards: CardCacheService) {
  return new Elysia({ prefix: '/api/v1/search' }).get('/', { detail: { tags: ['search'] } }, async ({ query, set }) => {
    const parsed = parseRequest(GlobalSearchQuery, query);
    const result = await cards.globalSearch(parsed);
    set.headers['cache-control'] = 'public, max-age=60, stale-while-revalidate=30';
    return GlobalSearchResponse.parse(result);
  });
}
