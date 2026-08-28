import { Elysia } from 'elysia';
import {
  PriceHistoryQuery,
  PriceHistoryResponse,
  PriceStatsBatchRequest,
  PriceStatsBatchResponse,
  PricesListQuery,
  PricesListResponse,
} from '@riftbound/contracts';
import type { PriceCacheService } from '../services/price-cache.js';
import { sql } from 'drizzle-orm';
import { variants } from '../db/schema.js';
import type { Database } from '../db/client.js';
import {
  baseVariantNumberForCardmarket,
  resolveCardmarketIdFromMap,
} from '../lib/variant-cardmarket.js';
import { parseRequest } from '../lib/request-validation.js';

async function resolveCardmarketId(
  db: Database,
  variantNumber: string | undefined,
  cardmarketId: number | undefined
): Promise<number | undefined> {
  if (!variantNumber || cardmarketId !== undefined) return cardmarketId;

  const numbers = [variantNumber];
  const base = baseVariantNumberForCardmarket(variantNumber);
  if (base != null) numbers.push(base);

  const rows = await db
    .select({
      variantNumber: variants.variantNumber,
      cardmarketId: variants.cardmarketId,
    })
    .from(variants)
    .where(
      sql`lower(${variants.variantNumber}) in (${sql.join(
        numbers.map((value) => sql`${value.toLowerCase()}`),
        sql`, `
      )})`
    );

  const byNumber = new Map(
    rows.map((row) => [row.variantNumber.toLowerCase(), row.cardmarketId] as const)
  );
  return resolveCardmarketIdFromMap(variantNumber, byNumber) ?? undefined;
}

export function createPricesRoutes(prices: PriceCacheService, db: Database) {
  return new Elysia({ prefix: '/api/v1/prices' })
    .get('/', { detail: { tags: ['prices'] } }, async ({ query }) => {
      const parsed = parseRequest(PricesListQuery, query);
      const cardmarketId = await resolveCardmarketId(
        db,
        parsed.variantNumber,
        parsed.cardmarketId
      );

      const listQuery: { cardmarketId?: number; isFoil?: boolean } = {};
      if (cardmarketId !== undefined) listQuery.cardmarketId = cardmarketId;
      if (parsed.isFoil !== undefined) listQuery.isFoil = parsed.isFoil;

      const result = await prices.list(listQuery);

      return PricesListResponse.parse({
        data: result.rows,
        meta: {
          pricesCatalogHash: result.catalogHash,
          lastSyncedAt: result.lastSyncedAt,
          rowCount: result.rows.length,
        },
      });
    })
    .get('/history', { detail: { tags: ['prices'] } }, async ({ query }) => {
      const parsed = parseRequest(PriceHistoryQuery, query);
      const cardmarketId = await resolveCardmarketId(
        db,
        parsed.variantNumber,
        parsed.cardmarketId
      );

      if (cardmarketId === undefined) {
        return PriceHistoryResponse.parse({
          data: [],
          meta: {
            cardmarketId: null,
            isFoil: parsed.isFoil ?? null,
            days: parsed.days,
            rowCount: 0,
          },
        });
      }

      const historyQuery: {
        cardmarketId: number;
        isFoil?: boolean;
        days: number;
      } = {
        cardmarketId,
        days: parsed.days,
      };
      if (parsed.isFoil !== undefined) historyQuery.isFoil = parsed.isFoil;

      const result = await prices.dailyHistory(historyQuery);

      return PriceHistoryResponse.parse({
        data: result.rows,
        meta: {
          cardmarketId,
          isFoil: parsed.isFoil ?? null,
          days: parsed.days,
          rowCount: result.rows.length,
        },
      });
    })
    .post('/stats/batch', { detail: { tags: ['prices'] } }, async ({ body }) => {
      const parsed = parseRequest(PriceStatsBatchRequest, body);
      const stats = await prices.statsBatch(
        parsed.items.map((item) => {
          const row: {
            variantNumber: string;
            isFoil?: boolean;
            targetPriceCents?: number | null;
          } = { variantNumber: item.variantNumber };
          if (item.isFoil !== undefined) row.isFoil = item.isFoil;
          if (item.targetPriceCents !== undefined) {
            row.targetPriceCents = item.targetPriceCents;
          }
          return row;
        }),
        parsed.days
      );

      return PriceStatsBatchResponse.parse({
        data: stats,
        meta: {
          days: parsed.days,
          rowCount: stats.length,
        },
      });
    });
}
