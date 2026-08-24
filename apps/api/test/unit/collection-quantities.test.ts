import { describe, expect, test } from 'bun:test';
import { CollectionService } from '../../src/services/collection-service.js';
import type { Database } from '../../src/db/client.js';

function createCollectionHarness(
  rows: Array<{ variantNumber: string; quantity: number; isFoil?: boolean }>
) {
  const db = {
    select: () => ({
      from: () => ({
        where: async () =>
          rows.map((row) => ({
            variantNumber: row.variantNumber,
            quantity: row.quantity,
            isFoil: row.isFoil ?? false,
          })),
      }),
    }),
  } as unknown as Database;

  const service = new CollectionService(db, {} as never, {} as never, {} as never);

  return service;
}

describe('CollectionService.quantitiesForVariants', () => {
  test('returns zero for missing variants and deduplicates input', async () => {
    const service = createCollectionHarness([
      { variantNumber: 'OGN-001', quantity: 3 },
    ]);

    const result = await service.quantitiesForVariants('collection-1', [
      'OGN-001',
      'OGN-001',
      'OGN-999',
    ]);

    expect(result).toEqual([
      { variantNumber: 'OGN-001', isFoil: false, quantity: 3 },
      { variantNumber: 'OGN-999', isFoil: false, quantity: 0 },
    ]);
  });

  test('returns an empty array for no variant numbers', async () => {
    const service = createCollectionHarness([]);

    expect(await service.quantitiesForVariants('collection-1', [])).toEqual([]);
  });

  test('returns separate rows for standard and foil finishes of the same VN', async () => {
    const service = createCollectionHarness([
      { variantNumber: 'VEN-074', quantity: 2, isFoil: false },
      { variantNumber: 'VEN-074', quantity: 5, isFoil: true },
    ]);

    expect(await service.quantitiesForVariants('collection-1', ['VEN-074'])).toEqual([
      { variantNumber: 'VEN-074', isFoil: false, quantity: 2 },
      { variantNumber: 'VEN-074', isFoil: true, quantity: 5 },
    ]);
  });
});
