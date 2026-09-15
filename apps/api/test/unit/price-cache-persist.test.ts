import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pricesFingerprint } from '../../src/lib/hash.js';
import { mapPriceGuideExportToRows } from '../../src/lib/cardmarket-price-rows.js';
import { CardmarketPriceGuideExportSchema } from '../../src/upstream/cardmarket-export.js';
import { PriceCacheService } from '../../src/services/price-cache.js';

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
});
