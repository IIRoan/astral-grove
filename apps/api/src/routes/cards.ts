import { Elysia } from 'elysia';
import {
  CardDetailResponse,
  CardsBatchRequest,
  CardsBatchResponse,
  CardsDetailQuery,
  CardsListQuery,
  CardsListResponse,
  CatalogIndexResponse,
  VariantNumber,
} from '@riftbound/contracts';
import type { CardCacheService } from '../services/card-cache.js';
import type { Env } from '../env.js';
import { isAdminAuthorization } from '../lib/admin-token.js';
import { parseRequest } from '../lib/request-validation.js';

export function createCardsRoutes(cards: CardCacheService, env: Env) {
  return new Elysia({ prefix: '/api/v1/cards' })
    .get('/', { detail: { tags: ['cards'] } }, async ({ query, set, request }) => {
      const parsed = parseRequest(CardsListQuery, query);
      const refresh =
        parsed.refresh === true &&
        isAdminAuthorization(env, request.headers.get('authorization'));
      const result = await cards.search({ ...parsed, refresh });
      const totalPages = Math.ceil(result.total / parsed.limit) || 1;

      if (!refresh) {
        set.headers['cache-control'] = 'public, max-age=300, stale-while-revalidate=60';
      }

      return CardsListResponse.parse({
        data: result.items,
        meta: {
          pagination: {
            total: result.total,
            page: parsed.page,
            limit: parsed.limit,
            totalPages,
            hasNext: parsed.page < totalPages,
            hasPrevious: parsed.page > 1,
          },
          source: result.source,
          catalogHash: result.catalogHash,
        },
      });
    })
    .get('/index', { detail: { tags: ['cards'] } }, async ({ set }) => {
      const result = await cards.listIndex();
      set.headers['cache-control'] = 'public, max-age=300, stale-while-revalidate=60';
      return CatalogIndexResponse.parse({
        data: result.items,
        meta: {
          catalogHash: result.catalogHash,
          pricesCatalogHash: result.pricesCatalogHash,
          total: result.total,
          source: 'cache',
        },
      });
    })
    .get(
      '/:variantNumber',
      { detail: { tags: ['cards'] } },
      async ({ params, query, request }) => {
        const variantNumber = parseRequest(VariantNumber, params.variantNumber);
        const parsed = parseRequest(CardsDetailQuery, query);
        const refresh =
          parsed.refresh === true &&
          isAdminAuthorization(env, request.headers.get('authorization'));
        const result = await cards.getByVariantNumber(variantNumber, { refresh });
        return CardDetailResponse.parse({
          data: result.detail,
          meta: { source: result.source, contentHash: result.contentHash },
        });
      }
    )
    .post('/batch', { detail: { tags: ['cards'] } }, async ({ body }) => {
      const { variantNumbers } = parseRequest(CardsBatchRequest, body);
      const result = await cards.batchGet(variantNumbers);
      return CardsBatchResponse.parse({
        data: result.found,
        meta: {
          found: result.found.length,
          notFound: result.notFound,
          source: result.source,
        },
      });
    });
}
