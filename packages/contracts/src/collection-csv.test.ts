import { describe, expect, test } from 'bun:test';
import {
  COLLECTION_CSV_HEADERS,
  csvRowToImportItem,
  type CollectionCsvRow,
} from './collection-csv.js';

function row(overrides: Partial<CollectionCsvRow>): CollectionCsvRow {
  const blank = Object.fromEntries(
    COLLECTION_CSV_HEADERS.map((header) => [header, ''])
  );
  return {
    ...blank,
    'Variant Number': 'OGN-001',
    Quantity: '1',
    ...overrides,
  } as CollectionCsvRow;
}

describe('csvRowToImportItem', () => {
  test('rejects a row whose fields exceed the import limits instead of failing the chunk', () => {
    expect(csvRowToImportItem(row({ Notes: 'x'.repeat(2001) }), 2)).toEqual({
      error: { row: 2, message: expect.stringContaining('notes') },
    });
    expect(
      csvRowToImportItem(row({ 'Grading Company': 'x'.repeat(65) }), 3)
    ).toMatchObject({ error: { row: 3 } });
    expect(csvRowToImportItem(row({ Notes: 'fine' }), 4)).toMatchObject({
      item: { variantNumber: 'OGN-001', notes: 'fine' },
    });
  });
});
