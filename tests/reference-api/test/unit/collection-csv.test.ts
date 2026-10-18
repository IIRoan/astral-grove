import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  exportRowsToCsv,
  formatConditionLabel,
  formatLanguageLabel,
  aggregateImportItems,
  parseCollectionCsv,
  parseCollectionCsvToImportItems,
  parseConditionLabel,
  parseFoilLabel,
  parseLanguageLabel,
  serializeCollectionCsv,
} from '@riftbound/contracts';

const sampleCsvPath = join(
  import.meta.dir,
  '../fixtures/migration/collection-synthetic.csv'
);

describe('collection CSV format', () => {
  test('parses piltover sample CSV headers and rows', () => {
    const content = readFileSync(sampleCsvPath, 'utf8');
    const { rows, errors } = parseCollectionCsv(content);

    expect(errors).toEqual([]);
    expect(rows.length).toBeGreaterThan(700);
    expect(rows[0]?.['Variant Number']).toBe('OGN-001');
    expect(rows[0]?.['Card Name']).toBe('Blazing Scorcher');
    expect(rows[0]?.Condition).toBe('Near Mint');
  });

  test('handles quoted card names with commas', () => {
    const content = readFileSync(sampleCsvPath, 'utf8');
    const { rows } = parseCollectionCsv(content);
    const draven = rows.find((row) => row['Variant Number'] === 'OGN-028');
    expect(draven?.['Card Name']).toBe('Draven, Showboat');
  });

  test('translates condition and language labels', () => {
    expect(parseConditionLabel('Near Mint')).toBe('near_mint');
    expect(parseConditionLabel('')).toBe('unspecified');
    expect(parseConditionLabel('Lightly Played')).toBe('lightly_played');
    expect(formatConditionLabel('near_mint')).toBe('Near Mint');
    expect(formatConditionLabel('unspecified')).toBe('');

    expect(parseLanguageLabel('English')).toBe('en');
    expect(parseLanguageLabel('')).toBe('en');
    expect(formatLanguageLabel('en')).toBe('English');

    expect(parseFoilLabel('true')).toBe(true);
    expect(parseFoilLabel('Standard')).toBe(false);
  });

  test('keeps standard and foil rows for the same variant in separate stacks', () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'VEN-074,Test Card,Spiritforged,VEN,Rare,Standard,Standard,false,2,English,Near Mint,,,,',
      'VEN-074,Test Card,Spiritforged,VEN,Rare,Standard,Standard,true,3,English,Near Mint,,,,',
    ].join('\n');

    const parsed = parseCollectionCsvToImportItems(csv);

    expect(parsed.errors).toEqual([]);
    expect(parsed.items).toEqual([
      expect.objectContaining({ variantNumber: 'VEN-074', isFoil: false, quantity: 2 }),
      expect.objectContaining({ variantNumber: 'VEN-074', isFoil: true, quantity: 3 }),
    ]);
    expect(parsed.uniquePrintings).toBe(2);
    expect(parsed.totalCopies).toBe(5);
  });

  test('reports invalid foil values instead of silently importing the wrong finish', () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'VEN-074,Test Card,Spiritforged,VEN,Rare,Standard,Standard,sparkly,1,English,Near Mint,,,,',
    ].join('\n');

    const parsed = parseCollectionCsvToImportItems(csv);

    expect(parsed.items).toEqual([]);
    expect(parsed.errors).toEqual([{ row: 2, message: 'Invalid foil value: sparkly' }]);
  });

  test('aggregates duplicate rows with the same condition by summing quantities', () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,3,English,Near Mint,,,,',
      'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,2,English,Near Mint,,,,',
    ].join('\n');

    const { items, errors, totalCopies } = parseCollectionCsvToImportItems(csv);
    expect(errors).toEqual([]);
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(5);
    expect(totalCopies).toBe(5);
  });

  test('keeps empty condition separate from Near Mint rows', () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,3,English,Near Mint,,,,',
      'OGN-001,Blazing Scorcher,Origins,OGN,Common,Standard,Standard,false,1,English,,,,,',
    ].join('\n');

    const { items, totalCopies, uniquePrintings } =
      parseCollectionCsvToImportItems(csv);
    expect(items).toHaveLength(2);
    expect(totalCopies).toBe(4);
    expect(uniquePrintings).toBe(2);
  });

  test('round-trips export rows through CSV serializer', () => {
    const csv = exportRowsToCsv([
      {
        variantNumber: 'OGN-028',
        cardName: 'Draven, Showboat',
        setName: 'Origins',
        setPrefix: 'OGN',
        rarity: 'Rare',
        variantType: 'Standard',
        variantLabel: 'Standard',
        isFoil: true,
        quantity: 1,
        language: 'en',
        condition: 'near_mint',
        gradeCompany: null,
        gradeScore: null,
        notes: null,
      },
    ]);

    const { rows } = parseCollectionCsv(csv);
    expect(rows[0]?.['Card Name']).toBe('Draven, Showboat');
    expect(rows[0]?.Foil).toBe('true');
    expect(rows[0]?.Condition).toBe('Near Mint');
    expect(rows[0]?.Language).toBe('English');
  });

  test('aggregateImportItems sums quantities for matching keys', () => {
    const merged = aggregateImportItems([
      {
        variantNumber: 'OGN-001',
        quantity: 2,
        condition: 'near_mint',
        language: 'en',
      },
      {
        variantNumber: 'OGN-001',
        quantity: 3,
        condition: 'near_mint',
        language: 'en',
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(5);
  });

  test('parses full piltover sample with 1597 total copies', () => {
    const content = readFileSync(sampleCsvPath, 'utf8');
    const parsed = parseCollectionCsvToImportItems(content);
    expect(parsed.totalCopies).toBe(1597);
    expect(parsed.uniquePrintings).toBe(725);
    expect(parsed.rowsProcessed).toBe(725);
  });

  test('serializeCollectionCsv escapes special characters', () => {
    const csv = serializeCollectionCsv([
      {
        'Variant Number': 'X-1',
        'Card Name': 'Test "Quote"',
        Set: 'Set',
        'Set Prefix': 'X',
        Rarity: 'Common',
        'Variant Type': 'Standard',
        'Variant Label': 'Standard',
        Foil: 'false',
        Quantity: '1',
        Language: 'English',
        Condition: 'Near Mint',
        'Grading Company': '',
        'Grading Value': '',
        'Grading Label': '',
        Notes: 'Line1\nLine2',
      },
    ]);
    expect(csv).toContain('"Test ""Quote"""');
    expect(csv).toContain('"Line1\nLine2"');
  });
});
