import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pricesFingerprint } from '../../src/lib/hash.js';
import { mapPriceGuideExportToRows } from '../../src/lib/cardmarket-price-rows.js';
import { CardmarketPriceGuideExportSchema } from '../../src/upstream/cardmarket-export.js';
import {
  PriceCacheService,
  PRICES_UNIQUE_SLOT,
} from '../../src/services/price-cache.js';
import { prices } from '../../src/db/schema.js';

describe('PriceCacheService.persistPriceRows', () => {
  test('skips database transaction when price guide hash is unchanged', async () => {
    const raw = await readFile(
      join(import.meta.dir, '../fixtures/cardmarket-price-guide-riftbound.json'),
      'utf8'
    );
    const exportData = CardmarketPriceGuideExportSchema.parse(JSON.parse(raw));
    const mapped = mapPriceGuideExportToRows(exportData).slice(0, 8);
    const hashInput = mapped.map((row) => ({
      cardmarketId: row.cardmarketId,
      isFoil: row.isFoil,
      lastUpdated: row.lastUpdated.toISOString(),
      marketPrice: row.marketPrice,
    }));
    const hash = pricesFingerprint(hashInput);

    let transactionCalls = 0;
    let syncStateWrites = 0;

    const db = {
      query: {
        syncState: {
          findFirst: async () => ({
            key: 'prices',
            contentHash: hash,
            rowCount: mapped.length,
            lastSuccessAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
      },
      transaction: async () => {
        transactionCalls += 1;
      },
      insert: () => ({
        values: () => ({
          onConflictDoUpdate: async () => {
            syncStateWrites += 1;
          },
        }),
      }),
    };

    const service = new PriceCacheService(db as never);
    const result = await service.persistPriceRows(mapped, {
      hashInput,
      productCount: exportData.priceGuides.length,
      sourceMeta: {
        source: 'cardmarket',
        gameId: 22,
        exportCreatedAt: exportData.createdAt,
      },
      trigger: 'test',
    });

    expect(result.changed).toBe(false);
    expect(result.rowCount).toBe(mapped.length);
    expect(transactionCalls).toBe(0);
    expect(syncStateWrites).toBe(1);
  });

  test('upserts current prices on (cardmarket_id, is_foil) and deletes stale slots in one pass', async () => {
    const raw = await readFile(
      join(import.meta.dir, '../fixtures/cardmarket-price-guide-riftbound.json'),
      'utf8'
    );
    const exportData = CardmarketPriceGuideExportSchema.parse(JSON.parse(raw));
    const mapped = mapPriceGuideExportToRows(exportData).slice(0, 8);
    const hashInput = mapped.map((row) => ({
      cardmarketId: row.cardmarketId,
      isFoil: row.isFoil,
      lastUpdated: row.lastUpdated.toISOString(),
      marketPrice: row.marketPrice,
    }));

    const conflictTargets: unknown[] = [];
    let priceDeletes = 0;
    let siblingDeletes = 0;

    const tx = {
      insert: (table: unknown) => ({
        values: () => ({
          onConflictDoUpdate: async (opts: { target: unknown }) => {
            conflictTargets.push({ table, target: opts.target });
          },
          onConflictDoNothing: async () => {},
        }),
      }),
      delete: (table: unknown) => ({
        where: async () => {
          if (table === prices) priceDeletes += 1;
        },
      }),
      execute: async () => {
        siblingDeletes += 1;
      },
    };

    const db = {
      query: {
        syncState: {
          findFirst: async () => ({
            key: 'prices',
            contentHash: 'stale-hash',
            rowCount: 0,
            lastSuccessAt: null,
          }),
        },
      },
      transaction: async (fn: (inner: typeof tx) => Promise<void>) => fn(tx),
    };

    const service = new PriceCacheService(db as never);
    const result = await service.persistPriceRows(mapped, {
      hashInput,
      productCount: exportData.priceGuides.length,
      sourceMeta: {
        source: 'cardmarket',
        gameId: 22,
        exportCreatedAt: exportData.createdAt,
      },
      trigger: 'test',
    });

    expect(result.changed).toBe(true);
    expect(siblingDeletes).toBe(0);
    expect(priceDeletes).toBe(1);
    expect(
      conflictTargets.some(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'target' in entry &&
          (entry as { target: unknown }).target === PRICES_UNIQUE_SLOT
      )
    ).toBe(true);
    expect(PRICES_UNIQUE_SLOT).toEqual([prices.cardmarketId, prices.isFoil]);
  });
});
