import { writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dir, '../..'));
import {
  parseSearchQuery,
  parseCollectionCsvToImportItems,
  parseCollectionTtsToImportItems,
  DeckValidateInput,
  validateRiftboundDeck,
} from '../../packages/contracts/src/index';
import {
  matchVariantsToProducts,
  matchUnmappedVariantsToProducts,
  buildSetExpansionMap,
  inferExpansionId,
} from '../../tests/reference-api/src/lib/cardmarket-id-match';
import { mapPriceGuideExportToRows } from '../../tests/reference-api/src/lib/cardmarket-price-rows';
import { cardmarketIdLookupCandidates } from '../../tests/reference-api/src/lib/variant-cardmarket';
import { computePriceStats } from '../../tests/reference-api/src/lib/price-stats';
const rows: Array<{ function: string; input: unknown; expected: unknown }> = [];
function add(fn: string, input: unknown, expected: unknown) {
  rows.push({ function: fn, input, expected: JSON.parse(JSON.stringify(expected)) });
}
const words = [
  'Darius',
  'Vï Æther Ørne',
  'Riftbound unit Champion',
  'the of and for',
  'x.y+[]%_',
  'fløwer ŒUVRE ß Æ',
  'ＯＧＮ-001',
  '中文 日本語',
  'i\u0307',
  '\ufeffVi',
  'legend legend VI VI',
  'Spell of the fire',
  'a',
  '\u001fTest\u007f',
];
for (const a of words)
  for (const b of words) add('search', `${a} ${b}`, parseSearchQuery(`${a} ${b}`));
for (const value of [
  'OGN-001',
  ' OGN-001-Foil ',
  'OGN-001-Release',
  'OGN-001*',
  'OGN-001a',
  'OGN-001b-Foil',
  'OGN-001A',
  'OGN-SP001a',
  'OGN-001-Release-Foil',
  'x',
  ' ',
  'OGN-001b*',
])
  add('candidates', value, cardmarketIdLookupCandidates(value));
for (const value of [
  '',
  'OGN-001-1',
  'OGN-001-2 OGN-001-3',
  'abc-r123-1;OGN-SP001-2,bad',
  '\ufeffOGN-001-1\r\nOGN-001-1',
  'OGN-001-0',
  'OGN-001-1,,; \t bad',
])
  add('tts', value, parseCollectionTtsToImportItems(value));
const headers =
  'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes';
for (const condition of [
  'Near Mint',
  'NM',
  'Mint',
  'Lightly Played',
  'damaged',
  'Unknown',
  '',
])
  for (const language of ['English', 'en', 'Japanese', 'de', 'Unknown', ''])
    for (const quantity of ['0', '1', '2', '-1', '1.5', 'invalid']) {
      const csv = `${headers}\nOGN-001,Card,Origins,OGN,Rare,Normal,Standard,Yes,${quantity},${language},${condition},,,,"hello, world"`;
      add('csv', csv, parseCollectionCsvToImportItems(csv));
    }
add(
  'csv',
  readFileSync(
    new URL(
      '../../tests/reference-api/test/fixtures/migration/collection-synthetic.csv',
      import.meta.url
    ),
    'utf8'
  ),
  parseCollectionCsvToImportItems(
    readFileSync(
      new URL(
        '../../tests/reference-api/test/fixtures/migration/collection-synthetic.csv',
        import.meta.url
      ),
      'utf8'
    )
  )
);
for (let count = 0; count < 7; count++)
  for (let productsCount = 0; productsCount < 9; productsCount++)
    for (let choice = 0; choice < 4; choice++) {
      const variants = Array.from({ length: count }, (_, i) => ({
        variantNumber: `OGN-00${i}${choice === 3 ? '-Foil' : ''}`,
        variantLabel: ['Standard', 'Alt Art', 'Overnumbered Signed', 'Foil'][choice],
        variantType: ['Normal', 'Alt Art', 'Overnumbered Signed', 'Normal'][choice],
        rarity: 'Rare',
        setCode: 'OGN',
        cardName: `Card ${i % 3}`,
        cardmarketId: 100 + i,
      }));
      const products = Array.from({ length: productsCount }, (_, i) => ({
        idProduct: 100 + i,
        name: `Card ${i % 3}`,
        idExpansion: i % 2 ? 1 : 2,
        idCategory: 22,
      }));
      const ranks = Object.fromEntries(
        products.map((p, i) => [p.idProduct, (productsCount - i) * 10])
      );
      const rankMap = new Map(
        Object.entries(ranks).map(([key, value]) => [Number(key), value])
      );
      add(
        'match',
        { variants, products, ranks },
        Object.fromEntries(matchVariantsToProducts(variants, products, rankMap))
      );
      for (const reserved of [[], [100], [100, 101, 102]])
        add(
          'unmapped',
          { variants, products, ranks, reserved, foilBase: choice === 3 ? 100 : null },
          Object.fromEntries(
            matchUnmappedVariantsToProducts(
              variants,
              products,
              new Set(reserved),
              rankMap,
              choice === 3 ? 100 : null
            )
          )
        );
      add(
        'expansion',
        { variants, products },
        Object.fromEntries(
          buildSetExpansionMap(variants, new Map(products.map((p) => [p.idProduct, p])))
        )
      );
      const groups = new Map<string, typeof products>();
      for (const product of products) {
        const key = String(product.idExpansion);
        groups.set(key, [...(groups.get(key) ?? []), product]);
      }
      add('inferExpansion', { variants, products }, inferExpansionId(variants, groups));
    }
for (let seed = 0; seed < 64; seed++) {
  const entry = {
    idProduct: 100 + seed,
    idCategory: 22,
    avg: seed % 2 ? 1.125 : null,
    low: seed % 2 ? 2.675 : null,
    trend: seed % 3 ? 4.995 : 0,
    avg1: seed % 5 ? 0 : null,
    avg7: seed % 7 ? 0.0001 : null,
    avg30: seed % 4 ? 9.999 : null,
    'avg-foil': seed % 2 ? -1.125 : null,
    'low-foil': seed % 3 ? 2.675 : null,
    'trend-foil': seed % 4 ? 0 : null,
    'avg1-foil': null,
    'avg7-foil': null,
    'avg30-foil': null,
  };
  const guide = {
    version: 1,
    createdAt: '2026-10-18T12:00:00.123456Z',
    priceGuides: [entry],
  };
  add('guide', guide, mapPriceGuideExportToRows(guide));
  const points = Array.from({ length: seed % 7 }, (_, i) => ({
    priceDate: `2026-10-${String(10 + i).padStart(2, '0')}`,
    lowPrice: i,
    marketPrice: i % 3 ? seed + i : null,
    midPrice: i % 2 ? -1 : null,
    highPrice: null,
  })).reverse();
  add('statistics', points, computePriceStats(points));
}
for (const format of ['constructed', 'pre-rift'])
  for (let seed = 0; seed < 60; seed++) {
    const card = {
      cardId: '11111111-1111-4111-8111-111111111111',
      energy: 1,
      setCode: 'OGN',
      rarity: 'Rare',
      variantType: 'Normal',
      isSignature: seed % 7 === 0,
      variantNumber: 'OGN-001',
      name: seed % 3 ? 'Darius' : 'Spiderling',
      type: 'Unit',
      super: seed % 4 ? 'Champion' : null,
      colors: seed % 5 ? ['Fury'] : ['Fury', 'Mind', 'Body'],
      tags: ['Darius'],
      maxCopies: null,
      banEffectiveDate: null,
    };
    const input = DeckValidateInput.parse({
      format,
      legend: seed % 2 ? { ...card, type: 'Legend' } : null,
      champion: seed % 3 ? card : null,
      mainDeck: seed % 5 ? [{ card, count: (seed % 42) + 1 }] : [],
      runes: [{ card: { ...card, type: 'Rune' }, count: (seed % 15) + 1 }],
      battlefields:
        seed % 4
          ? [{ card: { ...card, type: 'Battlefield' }, count: (seed % 4) + 1 }]
          : [],
      sideboard: seed % 3 ? [{ card, count: (seed % 10) + 1 }] : [],
    });
    add('deck', input, validateRiftboundDeck(input));
  }
const path = 'plans/rust-migration/baseline/business.jsonl';
if (!process.argv.includes('--check-rust')) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  console.log(`Pinned ${rows.length} business-rule cases`);
} else {
  const cases = readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const result = spawnSync('target/debug/business-parity', [], {
    input:
      cases
        .map(({ function: fn, input }) => JSON.stringify({ function: fn, input }))
        .join('\n') + '\n',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr);
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, canonical(value)])
          )
        : value;
  const actual = result.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  if (actual.length !== cases.length) throw new Error('Missing business results');
  const errors = cases.flatMap((row, i) =>
    JSON.stringify(canonical(row.expected)) === JSON.stringify(canonical(actual[i]))
      ? []
      : [{ ...row, actual: actual[i] }]
  );
  writeFileSync(
    '/tmp/astral-business-mismatches.json',
    JSON.stringify(errors, null, 2)
  );
  console.log({ checked: cases.length, mismatches: errors.length });
  if (errors.length) process.exitCode = 1;
}
