import { and, desc, eq, gte, inArray, ne, notInArray, sql } from 'drizzle-orm';
import type {
  PaPriceRow,
  PriceDailyPoint,
  PriceRow,
  PriceStats,
} from '@riftbound/contracts';
import {
  CARDMARKET_PRICE_SCOPE_NOTE,
  cardmarketPriceScopeLabel,
} from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { priceDaily, priceHistory, prices, syncState, variants } from '../db/schema.js';
import {
  mapPriceGuideExportToRows,
  type CardmarketPriceRow,
} from '../lib/cardmarket-price-rows.js';
import { pricesFingerprint } from '../lib/hash.js';
import {
  computePriceStats,
  type DailyPricePoint,
  utcDateString,
} from '../lib/price-stats.js';
import {
  baseVariantNumberForCardmarket,
  resolveCardmarketIdFromMap,
} from '../lib/variant-cardmarket.js';
import {
  fetchCardmarketPriceGuide,
  priceGuideDownloadUrl,
} from '../upstream/cardmarket-export.js';
import { CardmarketIdBackfillService } from './cardmarket-id-backfill.js';

export type PriceSyncTrigger = 'http' | 'cron' | 'script' | 'test';

function toNumber(value: string | null): number | null {
  return value === null ? null : Number(value);
}

function toPriceRow(row: typeof prices.$inferSelect): PriceRow {
  return {
    id: row.id,
    cardmarketId: row.cardmarketId,
    isFoil: row.isFoil,
    provider: 'cardmarket',
    currency: 'EUR',
    lowPrice: toNumber(row.lowPrice),
    marketPrice: toNumber(row.marketPrice),
    midPrice: toNumber(row.midPrice),
    highPrice: toNumber(row.highPrice),
    avg1Day: toNumber(row.avg1Day),
    avg7Day: toNumber(row.avg7Day),
    avg30Day: toNumber(row.avg30Day),
    lastUpdated: row.upstreamLastUpdated.toISOString(),
  };
}

function toDailyPoint(row: typeof priceDaily.$inferSelect): PriceDailyPoint {
  return {
    cardmarketId: row.cardmarketId,
    isFoil: row.isFoil,
    provider: 'cardmarket',
    currency: 'EUR',
    priceDate: row.priceDate,
    lowPrice: toNumber(row.lowPrice),
    marketPrice: toNumber(row.marketPrice),
    midPrice: toNumber(row.midPrice),
    highPrice: toNumber(row.highPrice),
  };
}

function sinceDate(days: number): string {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return utcDateString(since);
}

const PRICE_SYNC_CHUNK_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export class PriceCacheService {
  constructor(private readonly db: Database) {}

  async getRowsForCardmarketIds(cardmarketIds: number[]): Promise<PaPriceRow[]> {
    const unique = [...new Set(cardmarketIds)];
    if (unique.length === 0) return [];

    const rows = [];
    for (const batch of chunk(unique, PRICE_SYNC_CHUNK_SIZE)) {
      const batchRows = await this.db
        .select()
        .from(prices)
        .where(inArray(prices.cardmarketId, batch));
      rows.push(...batchRows);
    }

    return rows.map((r) => ({
      id: r.id,
      cardmarketId: r.cardmarketId,
      tcgPlayerId: null,
      provider: r.provider,
      isFoil: r.isFoil,
      currency: r.currency,
      lowPrice: r.lowPrice,
      marketPrice: r.marketPrice,
      midPrice: r.midPrice,
      highPrice: r.highPrice,
      directLowPrice: null,
      avg1Day: r.avg1Day,
      avg7Day: r.avg7Day,
      avg30Day: r.avg30Day,
      lastUpdated: r.upstreamLastUpdated.toISOString(),
    }));
  }

  async list(filters?: {
    cardmarketId?: number;
    isFoil?: boolean;
  }): Promise<{ rows: PriceRow[]; catalogHash: string; lastSyncedAt: string | null }> {
    const conditions = [];
    if (filters?.cardmarketId !== undefined) {
      conditions.push(eq(prices.cardmarketId, filters.cardmarketId));
    }
    if (filters?.isFoil !== undefined) {
      conditions.push(eq(prices.isFoil, filters.isFoil));
    }

    const rows =
      conditions.length > 0
        ? await this.db
            .select()
            .from(prices)
            .where(and(...conditions))
        : await this.db.select().from(prices);

    const sync = await this.db.query.syncState.findFirst({
      where: eq(syncState.key, 'prices'),
    });

    return {
      rows: rows.map(toPriceRow),
      catalogHash: sync?.contentHash ?? '',
      lastSyncedAt: sync?.lastSuccessAt?.toISOString() ?? null,
    };
  }

  async dailyHistory(filters: {
    cardmarketId: number;
    isFoil?: boolean;
    days: number;
  }): Promise<{ rows: PriceDailyPoint[] }> {
    const conditions = [
      eq(priceDaily.cardmarketId, filters.cardmarketId),
      gte(priceDaily.priceDate, sinceDate(filters.days)),
    ];

    if (filters.isFoil !== undefined) {
      conditions.push(eq(priceDaily.isFoil, filters.isFoil));
    }

    const rows = await this.db
      .select()
      .from(priceDaily)
      .where(and(...conditions))
      .orderBy(priceDaily.priceDate);

    return { rows: rows.map(toDailyPoint) };
  }

  async statsForVariant(input: {
    variantNumber: string;
    cardmarketId: number | null;
    isFoil: boolean;
    days: number;
    targetPriceCents?: number | null;
  }): Promise<PriceStats> {
    const priceSlot =
      input.cardmarketId == null
        ? null
        : await this.resolvePriceSlot(input.cardmarketId, input.isFoil);

    const points =
      priceSlot == null
        ? []
        : (
            await this.dailyHistory({
              cardmarketId: priceSlot.cardmarketId,
              isFoil: priceSlot.isFoil,
              days: input.days,
            })
          ).rows;

    const resolvedPoints = await this.ensureCurrentDailyPoint(
      priceSlot?.cardmarketId ?? null,
      priceSlot?.isFoil ?? input.isFoil,
      points
    );
    const stats = computePriceStats(resolvedPoints as DailyPricePoint[]);
    const belowTarget =
      input.targetPriceCents != null && stats.currentPrice != null
        ? stats.currentPrice * 100 <= input.targetPriceCents
        : undefined;

    const resolvedIsFoil = priceSlot?.isFoil ?? input.isFoil;

    return {
      variantNumber: input.variantNumber,
      cardmarketId: input.cardmarketId,
      isFoil: resolvedIsFoil,
      currency: 'EUR',
      currentPrice: stats.currentPrice,
      baselinePrice: stats.baselinePrice,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      avgPrice: stats.avgPrice,
      listingLow: stats.listingLow,
      changePercent: stats.changePercent,
      trend: stats.trend,
      points: stats.points.map((point) => ({
        cardmarketId: input.cardmarketId ?? 0,
        isFoil: resolvedIsFoil,
        provider: 'cardmarket' as const,
        currency: 'EUR' as const,
        priceDate: point.priceDate,
        lowPrice: point.lowPrice,
        marketPrice: point.marketPrice,
        midPrice: point.midPrice,
        highPrice: point.highPrice,
      })),
      days: input.days,
      priceFilterLabel: cardmarketPriceScopeLabel(resolvedIsFoil),
      priceSourceNote: CARDMARKET_PRICE_SCOPE_NOTE,
      ...(input.targetPriceCents !== undefined
        ? { targetPriceCents: input.targetPriceCents }
        : {}),
      ...(belowTarget !== undefined ? { belowTarget } : {}),
    };
  }

  private async resolvePriceSlot(
    cardmarketId: number,
    isFoil: boolean
  ): Promise<{ cardmarketId: number; isFoil: boolean }> {
    if (await this.hasUsablePriceGuide(cardmarketId, isFoil)) {
      return { cardmarketId, isFoil };
    }
    // Showcase / signed / foil-only products often publish only one finish in the guide.
    if (!isFoil && (await this.hasUsablePriceGuide(cardmarketId, true))) {
      return { cardmarketId, isFoil: true };
    }
    if (isFoil && (await this.hasUsablePriceGuide(cardmarketId, false))) {
      return { cardmarketId, isFoil: false };
    }
    return { cardmarketId, isFoil };
  }

  private async hasUsablePriceGuide(
    cardmarketId: number,
    isFoil: boolean
  ): Promise<boolean> {
    const [row] = await this.db
      .select({
        marketPrice: prices.marketPrice,
        midPrice: prices.midPrice,
      })
      .from(prices)
      .where(and(eq(prices.cardmarketId, cardmarketId), eq(prices.isFoil, isFoil)))
      .orderBy(desc(prices.fetchedAt))
      .limit(1);

    if (!row) return false;

    const market = toNumber(row.marketPrice);
    const mid = toNumber(row.midPrice);
    return (market != null && market > 0) || mid != null;
  }

  async statsBatch(
    items: {
      variantNumber: string;
      isFoil?: boolean;
      targetPriceCents?: number | null;
    }[],
    days: number
  ): Promise<PriceStats[]> {
    if (items.length === 0) return [];

    const variantNumbers = [
      ...new Set(
        items.flatMap((item) => {
          const numbers = [item.variantNumber];
          const base = baseVariantNumberForCardmarket(item.variantNumber);
          if (base != null) numbers.push(base);
          return numbers;
        })
      ),
    ];
    const variantRows = await this.db
      .select({
        variantNumber: variants.variantNumber,
        cardmarketId: variants.cardmarketId,
      })
      .from(variants)
      .where(
        sql`lower(${variants.variantNumber}) in (${sql.join(
          variantNumbers.map((value) => sql`${value.toLowerCase()}`),
          sql`, `
        )})`
      );

    const variantByNumber = new Map(
      variantRows.map(
        (row) => [row.variantNumber.toLowerCase(), row.cardmarketId] as const
      )
    );

    return Promise.all(
      items.map((item) => {
        const resolved: {
          variantNumber: string;
          cardmarketId: number | null;
          isFoil: boolean;
          days: number;
          targetPriceCents?: number | null;
        } = {
          variantNumber: item.variantNumber,
          cardmarketId: resolveCardmarketIdFromMap(item.variantNumber, variantByNumber),
          isFoil: item.isFoil ?? false,
          days,
        };
        if (item.targetPriceCents !== undefined) {
          resolved.targetPriceCents = item.targetPriceCents;
        }
        return this.statsForVariant(resolved);
      })
    );
  }

  private async ensureCurrentDailyPoint(
    cardmarketId: number | null,
    isFoil: boolean,
    points: PriceDailyPoint[]
  ): Promise<DailyPricePoint[]> {
    if (cardmarketId == null) return points;

    const today = utcDateString(new Date());
    if (points.some((point) => point.priceDate === today)) {
      return points;
    }

    const [current] = await this.db
      .select()
      .from(prices)
      .where(and(eq(prices.cardmarketId, cardmarketId), eq(prices.isFoil, isFoil)))
      .limit(1);

    if (!current) return points;

    return [
      ...points,
      {
        priceDate: today,
        lowPrice: toNumber(current.lowPrice),
        marketPrice: toNumber(current.marketPrice),
        midPrice: toNumber(current.midPrice),
        highPrice: toNumber(current.highPrice),
      },
    ];
  }

  async syncFromCardmarket(
    gameId: number,
    options?: { trigger?: PriceSyncTrigger }
  ): Promise<{
    changed: boolean;
    rowCount: number;
    productCount: number;
    hash: string;
    source: 'cardmarket';
    gameId: number;
    exportCreatedAt: string;
    cardmarketIdsBackfilled: number;
  }> {
    const trigger = options?.trigger ?? 'http';
    const startedAt = Date.now();
    const downloadUrl = priceGuideDownloadUrl(gameId);

    console.log(
      `[prices] Cardmarket sync starting (trigger=${trigger}, game=${String(gameId)})`
    );
    await this.setSyncStatus('running');

    try {
      console.log(`[prices] Downloading price guide: ${downloadUrl}`);
      const exportData = await fetchCardmarketPriceGuide(gameId);
      console.log(
        `[prices] Downloaded price guide: createdAt=${exportData.createdAt} products=${String(exportData.priceGuides.length)} version=${String(exportData.version)}`
      );

      const upstream = mapPriceGuideExportToRows(exportData);
      console.log(
        `[prices] Mapped ${String(upstream.length)} foil/non-foil rows; persisting to database…`
      );

      const result = await this.persistPriceRows(upstream, {
        hashInput: upstream.map((row) => ({
          cardmarketId: row.cardmarketId,
          isFoil: row.isFoil,
          lastUpdated: row.lastUpdated.toISOString(),
          marketPrice: row.marketPrice,
        })),
        productCount: exportData.priceGuides.length,
        sourceMeta: {
          source: 'cardmarket' as const,
          gameId,
          exportCreatedAt: exportData.createdAt,
        },
        trigger,
        startedAt,
      });

      const backfill = new CardmarketIdBackfillService(this.db);
      const backfillResult = await backfill.backfillMissingIds(gameId);
      if (backfillResult.updated > 0) {
        console.log(
          `[prices] Backfilled ${String(backfillResult.updated)} missing Cardmarket product ids (${String(backfillResult.skipped)} still unmapped)`
        );
      }
      if (backfillResult.syntheticsCreated > 0) {
        console.log(
          `[prices] Materialized ${String(backfillResult.syntheticsCreated)} local Overnumbered Signed variants from unmatched Cardmarket SKUs`
        );
      }

      return {
        ...result,
        cardmarketIdsBackfilled:
          backfillResult.updated + backfillResult.syntheticsCreated,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[prices] Cardmarket sync failed (trigger=${trigger}, game=${String(gameId)}, elapsedMs=${String(Date.now() - startedAt)}):`,
        err
      );
      await this.setSyncStatus('failed', { lastError: message });
      throw err;
    }
  }

  private async setSyncStatus(
    status: 'idle' | 'running' | 'failed',
    extra?: {
      contentHash?: string;
      rowCount?: number;
      lastSuccessAt?: Date;
      lastError?: string | null;
    }
  ) {
    const now = new Date();
    await this.db
      .insert(syncState)
      .values({
        key: 'prices',
        status,
        contentHash: extra?.contentHash ?? '',
        rowCount: extra?.rowCount ?? 0,
        lastAttemptAt: now,
        lastSuccessAt: extra?.lastSuccessAt ?? null,
        lastError: extra?.lastError ?? null,
      })
      .onConflictDoUpdate({
        target: syncState.key,
        set: {
          status,
          lastAttemptAt: now,
          ...(extra?.contentHash !== undefined
            ? { contentHash: extra.contentHash }
            : {}),
          ...(extra?.rowCount !== undefined ? { rowCount: extra.rowCount } : {}),
          ...(extra?.lastSuccessAt !== undefined
            ? { lastSuccessAt: extra.lastSuccessAt }
            : {}),
          ...(extra?.lastError !== undefined ? { lastError: extra.lastError } : {}),
        },
      });
  }

  async persistPriceRows(
    upstream: CardmarketPriceRow[],
    meta: {
      hashInput: {
        cardmarketId: number;
        isFoil: boolean;
        lastUpdated: string;
        marketPrice: string | null;
      }[];
      productCount: number;
      sourceMeta: {
        source: 'cardmarket';
        gameId: number;
        exportCreatedAt: string;
      };
      trigger?: PriceSyncTrigger;
      startedAt?: number;
    }
  ): Promise<{
    changed: boolean;
    rowCount: number;
    productCount: number;
    hash: string;
    source: 'cardmarket';
    gameId: number;
    exportCreatedAt: string;
  }> {
    const hash = pricesFingerprint(meta.hashInput);

    const existing = await this.db.query.syncState.findFirst({
      where: eq(syncState.key, 'prices'),
    });

    const now = new Date();
    const priceDate = utcDateString(now);
    const changed = existing?.contentHash !== hash;
    const trigger = meta.trigger ?? 'http';

    console.log(
      `[prices] Persisting ${String(upstream.length)} rows (changed=${String(changed)}, previousHash=${existing?.contentHash?.slice(0, 12) ?? 'none'}, newHash=${hash.slice(0, 12)})`
    );

    const dailyRows = upstream.map((row) => ({
      cardmarketId: row.cardmarketId,
      isFoil: row.isFoil,
      priceDate,
      provider: row.provider,
      currency: row.currency,
      lowPrice: row.lowPrice,
      marketPrice: row.marketPrice,
      midPrice: row.midPrice,
      highPrice: row.highPrice,
      syncedAt: now,
    }));

    const currentRows = upstream.map((row) => ({
      id: row.id,
      cardmarketId: row.cardmarketId,
      isFoil: row.isFoil,
      provider: row.provider,
      currency: row.currency,
      lowPrice: row.lowPrice,
      marketPrice: row.marketPrice,
      midPrice: row.midPrice,
      highPrice: row.highPrice,
      avg1Day: row.avg1Day,
      avg7Day: row.avg7Day,
      avg30Day: row.avg30Day,
      upstreamLastUpdated: row.lastUpdated,
      contentHash: row.contentHash,
      fetchedAt: now,
    }));

    const historyRows = upstream.map((row) => ({
      cardmarketId: row.cardmarketId,
      isFoil: row.isFoil,
      provider: row.provider,
      currency: row.currency,
      lowPrice: row.lowPrice,
      marketPrice: row.marketPrice,
      midPrice: row.midPrice,
      highPrice: row.highPrice,
      avg1Day: row.avg1Day,
      avg7Day: row.avg7Day,
      avg30Day: row.avg30Day,
      upstreamLastUpdated: row.lastUpdated,
      contentHash: row.contentHash,
      capturedAt: now,
    }));

    await this.db.transaction(async (tx) => {
      for (const batch of chunk(dailyRows, PRICE_SYNC_CHUNK_SIZE)) {
        await tx
          .insert(priceDaily)
          .values(batch)
          .onConflictDoUpdate({
            target: [priceDaily.cardmarketId, priceDaily.isFoil, priceDaily.priceDate],
            set: {
              lowPrice: sql`excluded.low_price`,
              marketPrice: sql`excluded.market_price`,
              midPrice: sql`excluded.mid_price`,
              highPrice: sql`excluded.high_price`,
              syncedAt: sql`excluded.synced_at`,
            },
          });
      }

      for (const batch of chunk(currentRows, PRICE_SYNC_CHUNK_SIZE)) {
        for (const row of batch) {
          await tx
            .delete(prices)
            .where(
              and(
                eq(prices.cardmarketId, row.cardmarketId),
                eq(prices.isFoil, row.isFoil),
                ne(prices.id, row.id)
              )
            );
        }

        await tx
          .insert(prices)
          .values(batch)
          .onConflictDoUpdate({
            target: prices.id,
            set: {
              lowPrice: sql`excluded.low_price`,
              marketPrice: sql`excluded.market_price`,
              midPrice: sql`excluded.mid_price`,
              highPrice: sql`excluded.high_price`,
              avg1Day: sql`excluded.avg_1_day`,
              avg7Day: sql`excluded.avg_7_day`,
              avg30Day: sql`excluded.avg_30_day`,
              upstreamLastUpdated: sql`excluded.upstream_last_updated`,
              contentHash: sql`excluded.content_hash`,
              fetchedAt: sql`excluded.fetched_at`,
            },
          });
      }

      const upstreamIds = upstream.map((row) => row.id);
      if (upstreamIds.length > 0) {
        await tx.delete(prices).where(notInArray(prices.id, upstreamIds));
      }

      if (changed) {
        for (const batch of chunk(historyRows, PRICE_SYNC_CHUNK_SIZE)) {
          await tx.insert(priceHistory).values(batch).onConflictDoNothing();
        }
      }

      await tx
        .insert(syncState)
        .values({
          key: 'prices',
          contentHash: hash,
          rowCount: upstream.length,
          lastSuccessAt: now,
          lastAttemptAt: now,
          status: 'idle',
          lastError: null,
        })
        .onConflictDoUpdate({
          target: syncState.key,
          set: {
            contentHash: hash,
            rowCount: upstream.length,
            lastSuccessAt: now,
            lastAttemptAt: now,
            status: 'idle',
            lastError: null,
          },
        });
    });

    const elapsed =
      meta.startedAt !== undefined
        ? ` elapsedMs=${String(Date.now() - meta.startedAt)}`
        : '';
    console.log(
      `[prices] Cardmarket sync complete: trigger=${trigger} game=${String(meta.sourceMeta.gameId)} products=${String(meta.productCount)} rows=${String(upstream.length)} changed=${String(changed)} export=${meta.sourceMeta.exportCreatedAt}${elapsed}`
    );

    return {
      changed,
      rowCount: upstream.length,
      productCount: meta.productCount,
      hash,
      ...meta.sourceMeta,
    };
  }
}
