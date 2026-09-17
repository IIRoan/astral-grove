import { describe, expect, test } from 'bun:test';
import {
  buildScanCatalog,
  confidentArt,
  decideScan,
  decideCollectorScan,
  IMAGE_MATCH_FLOOR,
  IMAGE_TIE_MARGIN,
  nameSimilarity,
  narrowByArt,
  normalizeScannedName,
  parseScannedCardCode,
  scannedNameCandidates,
} from './card-scan.js';

const SETS = ['OGN', 'UNL', 'VEN', 'ARC', 'SFD', 'OGS'];

describe('parseScannedCardCode', () => {
  test('reads every printed layout', () => {
    expect(parseScannedCardCode(['OGN • 179/298'], SETS)).toBe('OGN-179');
    expect(parseScannedCardCode(['UNL • 131/219'], SETS)).toBe('UNL-131');
    expect(parseScannedCardCode(['VEN • 150/166 • EN'], SETS)).toBe('VEN-150');
    expect(parseScannedCardCode(['ARC-001/006'], SETS)).toBe('ARC-001');
    expect(parseScannedCardCode(['OGN • 166b/298'], SETS)).toBe('OGN-166b');
  });

  test('reads a lettered series and the signed star', () => {
    expect(parseScannedCardCode(['VEN • SP1/006 • EN'], SETS)).toBe('VEN-SP1');
    expect(parseScannedCardCode(['SFD • 227*/221'], SETS)).toBe('SFD-227*');
  });

  test('passes over a reading that names no real card', () => {
    const real = new Set(['OGN-179']);
    const isKnown = (variantNumber: string) => real.has(variantNumber);
    // Vision ranked a misread first each time; the second reading is the card.
    expect(
      parseScannedCardCode([['OGN • 779/298', 'OGN • 179/298']], SETS, isKnown)
    ).toBe('OGN-179');
    expect(
      parseScannedCardCode([['OGN • I79/298', 'OGN • 179/298']], SETS, isKnown)
    ).toBe('OGN-179');
    expect(parseScannedCardCode(['OGN • 779/298'], SETS, isKnown)).toBeNull();
  });

  test('zero-pads short numbers to match stored variant numbers', () => {
    expect(parseScannedCardCode(['OGN • 7/298'], SETS)).toBe('OGN-007');
    expect(parseScannedCardCode(['OGN • 29/298'], SETS)).toBe('OGN-029');
  });

  test('survives a dropped separator and stray spacing', () => {
    expect(parseScannedCardCode(['OGN 179/298'], SETS)).toBe('OGN-179');
    expect(parseScannedCardCode(['UNL  ·  131 / 219'], SETS)).toBe('UNL-131');
  });

  test('corrects glyph confusions in the set prefix', () => {
    expect(parseScannedCardCode(['0GN • 179/298'], SETS)).toBe('OGN-179');
    expect(parseScannedCardCode(['VEH • 150/166'], SETS)).toBe('VEN-150');
  });

  test('falls through to a lower-ranked reading when the best one is unusable', () => {
    // Vision's top candidate mangles the number; its second is clean.
    const line = ['OGN • I79/Z98', 'OGN • 179/298'];
    expect(parseScannedCardCode([line], SETS)).toBe('OGN-179');
  });

  test('takes the first reading that resolves, across lines and candidates', () => {
    const lines = [
      ['Each player kills one of their gear.'],
      ['"Never liked that sword anyway."'],
      ['0GN . 179 298', 'OGN • 179/298'],
      ['Kudos Productions • ©2025RGI'],
    ];
    expect(parseScannedCardCode(lines, SETS)).toBe('OGN-179');
  });

  test('rejects rules text that merely contains a fraction', () => {
    expect(parseScannedCardCode(['Deal 2/3 damage to a unit.'], SETS)).toBeNull();
    expect(parseScannedCardCode(['see 1/2'], SETS)).toBeNull();
  });

  test('rejects unknown and ambiguous set prefixes', () => {
    expect(parseScannedCardCode(['ZZZ • 179/298'], SETS)).toBeNull();
    // One edit from both OGN and OGS — guessing either would be a wrong card.
    expect(parseScannedCardCode(['OGX • 017/298'], SETS)).toBeNull();
  });

  test('returns null without a catalog to validate against', () => {
    expect(parseScannedCardCode(['OGN • 179/298'], [])).toBeNull();
    expect(parseScannedCardCode([], SETS)).toBeNull();
  });
});

describe('scannedNameCandidates', () => {
  test('returns plausible names longest first, ignoring numeric chrome', () => {
    const lines = [
      ['1'],
      ['SPELL'],
      ['Acceptable Losses'],
      ['OGN • 179/298'],
      ['©2025RGI'],
    ];
    expect(scannedNameCandidates(lines)).toEqual(['Acceptable Losses', 'SPELL']);
  });

  test('includes lower-ranked readings as separate candidates', () => {
    const names = scannedNameCandidates([['Acceptabie Losses', 'Acceptable Losses']]);
    expect(names).toContain('Acceptable Losses');
    expect(names).toContain('Acceptabie Losses');
  });

  test('deduplicates readings that normalize to the same name', () => {
    expect(scannedNameCandidates([['Ahri, Nine-Tailed', 'Ahri Nine Tailed']])).toEqual([
      'Ahri, Nine-Tailed',
    ]);
  });
});

describe('nameSimilarity', () => {
  test('ignores punctuation and case', () => {
    expect(nameSimilarity('Ahri, Nine-Tailed', 'ahri nine tailed')).toBe(1);
  });

  test('scores a one-glyph OCR slip as very close', () => {
    expect(nameSimilarity('Acceptabie Losses', 'Acceptable Losses')).toBeGreaterThan(
      0.9
    );
  });

  test('scores unrelated names low', () => {
    expect(nameSimilarity('Acceptable Losses', 'Riptide Rex')).toBeLessThan(0.5);
  });

  test('is zero when either side is empty after normalizing', () => {
    expect(nameSimilarity('©2025', 'Riptide Rex')).toBe(0);
  });
});

describe('normalizeScannedName', () => {
  test('strips everything but letters and digits', () => {
    expect(normalizeScannedName('Ahri, Nine-Tailed!')).toBe('ahrininetailed');
  });
});

describe('narrowByArt', () => {
  const standard = { variantNumber: 'OGN-066', imageUrl: 'ogn-066.webp' };
  const altArt = { variantNumber: 'OGN-066a', imageUrl: 'ogn-066a.webp' };
  const launch = { variantNumber: 'OGN-066-Launch', imageUrl: 'ogn-066.webp' };

  test('picks the printing whose art the camera saw', () => {
    const matches = [
      { key: 'ogn-066a.webp', score: 0.91 },
      { key: 'ogn-066.webp', score: 0.7 },
    ];
    expect(narrowByArt([standard, altArt], matches)).toEqual([altArt]);
  });

  test('keeps every printing that shares the winning art', () => {
    const matches = [{ key: 'ogn-066.webp', score: 0.9 }];
    expect(narrowByArt([standard, altArt, launch], matches)).toEqual([
      standard,
      launch,
    ]);
  });

  test('keeps near-ties rather than guessing between them', () => {
    const matches = [
      { key: 'ogn-066.webp', score: 0.9 },
      { key: 'ogn-066a.webp', score: 0.9 - IMAGE_TIE_MARGIN / 2 },
    ];
    expect(narrowByArt([standard, altArt], matches)).toEqual([standard, altArt]);
  });

  test('is empty when the art is not among the matches', () => {
    expect(narrowByArt([standard], [{ key: 'other.webp', score: 0.95 }])).toEqual([]);
    expect(narrowByArt([standard], [])).toEqual([]);
    expect(narrowByArt([], [{ key: 'ogn-066.webp', score: 0.95 }])).toEqual([]);
  });
});

describe('confidentArt', () => {
  test('trusts a strong match that stands clear of the runner-up', () => {
    expect(
      confidentArt([
        { key: 'a', score: IMAGE_MATCH_FLOOR + 0.1 },
        { key: 'b', score: IMAGE_MATCH_FLOOR },
      ])
    ).toBe('a');
    expect(confidentArt([{ key: 'a', score: IMAGE_MATCH_FLOOR + 0.1 }])).toBe('a');
  });

  test('refuses a weak best match', () => {
    expect(confidentArt([{ key: 'a', score: IMAGE_MATCH_FLOOR - 0.01 }])).toBeNull();
    expect(confidentArt([])).toBeNull();
  });

  test('refuses when the runner-up is too close to call', () => {
    expect(
      confidentArt([
        { key: 'a', score: 0.95 },
        { key: 'b', score: 0.95 - IMAGE_TIE_MARGIN / 2 },
      ])
    ).toBeNull();
  });
});

describe('decideScan', () => {
  // The shapes the real catalog throws up: a unique card, a standard/alt-art pair with
  // their own pictures, and a rune reprinted across sets under one picture.
  const card = (variantNumber: string, name: string, image = variantNumber) => ({
    variantNumber,
    name,
    setCode: variantNumber.split('-')[0]!,
    imageUrl: `${image}.webp`,
  });
  const abandon = card('UNL-131', 'Abandon');
  const ahri = card('OGN-066', 'Ahri, Alluring');
  const ahriAlt = card('OGN-066a', 'Ahri, Alluring');
  const fury = card('OGN-007', 'Fury Rune');
  const furySfd = card('SFD-R01', 'Fury Rune', 'OGN-007');
  const annie = card('OGN-119', 'Annie, Fiery');
  const catalog = buildScanCatalog([abandon, ahri, ahriAlt, fury, furySfd, annie]);

  const art = (...ranked: [string, number][]) =>
    ranked.map(([key, score]) => ({ key: `${key}.webp`, score }));

  test('a code the artwork agrees with is the one sure outcome', () => {
    const lines = ['OGN • 066a/298'];
    expect(
      decideScan(catalog, lines, art(['OGN-066a', 0.9], ['OGN-066', 0.8]))
    ).toEqual({
      kind: 'card',
      card: ahriAlt,
      via: 'code',
      sure: true,
    });
  });

  test('a code alone still identifies, but is not sure', () => {
    expect(decideScan(catalog, ['UNL • 131/219'])).toEqual({
      kind: 'card',
      card: abandon,
      via: 'code',
      sure: false,
    });
  });

  test('a misread code is overruled when artwork and name both disagree', () => {
    // 066 read as 119: a real card, but neither the picture nor the name is Annie's.
    const lines = ['Ahri, Alluring', 'OGN • 119/298'];
    const decision = decideScan(
      catalog,
      lines,
      art(['OGN-066', 0.9], ['OGN-066a', 0.7])
    );
    expect(decision).toEqual({ kind: 'card', card: ahri, via: 'art', sure: false });
  });

  test('the code stands when only one of them disagrees', () => {
    // Glare threw the artwork off, but the name vouches for the code.
    const glare = decideScan(
      catalog,
      ['Annie, Fiery', 'OGN • 119/298'],
      art(['UNL-131', 0.6])
    );
    expect(glare).toMatchObject({
      kind: 'card',
      card: annie,
      via: 'code',
      sure: false,
    });
  });

  test('a strip-only read waits for the name before crossing the artwork', () => {
    const lines = ['OGN • 119/298'];
    const matches = art(['OGN-066', 0.9]);
    expect(decideScan(catalog, lines, matches, false)).toBeNull();
    // The whole card was read and still shows no name: the code is all there is.
    expect(decideScan(catalog, lines, matches, true)).toMatchObject({ card: annie });
  });

  test('artwork picks the printing when the name has several', () => {
    const decision = decideScan(
      catalog,
      ['Ahri, Alluring'],
      art(['OGN-066a', 0.88], ['OGN-066', 0.71])
    );
    expect(decision).toEqual({ kind: 'card', card: ahriAlt, via: 'art', sure: false });
  });

  test('reprints under one picture are held for the user, narrowed by the artwork', () => {
    const alone = decideScan(catalog, ['Fury Rune']);
    expect(alone).toMatchObject({ kind: 'hold', key: 'Fury Rune' });
    expect(alone?.kind === 'hold' && alone.options).toEqual([fury, furySfd]);

    const seen = decideScan(catalog, ['Fury Rune'], art(['OGN-007', 0.93]));
    expect(seen?.kind === 'hold' && seen.options).toEqual([fury, furySfd]);
  });

  test('a unique name is enough on its own', () => {
    expect(decideScan(catalog, ['Abandon'])).toEqual({
      kind: 'card',
      card: abandon,
      via: 'name',
      sure: false,
    });
  });

  test('with nothing legible, only confident artwork is held', () => {
    const clear = decideScan(catalog, [], art(['UNL-131', 0.92], ['OGN-119', 0.6]));
    expect(clear).toEqual({
      kind: 'hold',
      key: 'UNL-131.webp',
      name: 'Abandon',
      options: [abandon],
    });
    expect(decideScan(catalog, [], art(['UNL-131', 0.5]))).toBeNull();
    expect(
      decideScan(catalog, [], art(['UNL-131', 0.9], ['OGN-119', 0.89]))
    ).toBeNull();
    expect(decideScan(catalog, [])).toBeNull();
  });
});

describe('Lux full-art recognition', () => {
  const lux = {
    variantNumber: 'OGS-014',
    name: 'Lux, Crownguard',
    setCode: 'OGS',
    imageUrl: 'lux.webp',
  };
  const illuminated = {
    ...lux,
    variantNumber: 'OGS-006',
    name: 'Lux, Illuminated',
    imageUrl: 'illuminated.webp',
  };
  const catalog = buildScanCatalog([lux, illuminated]);

  test('joins title lines and ranked alternatives when the collector strip is unreadable', () => {
    expect(
      decideScan(catalog, [
        ['LUX'],
        ['CR0WNGUARD', 'CROWNGUAR0'],
        ['Use only to play spells.'],
      ])
    ).toMatchObject({ kind: 'card', card: lux, via: 'name' });
  });

  test('joins the set and collector number when Vision splits the footer', () => {
    expect(decideScan(catalog, ['OGS', '014/024'])).toMatchObject({
      kind: 'card',
      card: lux,
      via: 'code',
    });
  });

  test('recovers digit-shaped letters only for a known collector number', () => {
    expect(decideScan(catalog, ['OGS • OI4/024'])).toMatchObject({
      kind: 'card',
      card: lux,
      via: 'code',
    });
    expect(
      parseScannedCardCode(['OGS • OI9/024'], ['OGS'], (code) => code === 'OGS-014')
    ).toBeNull();
  });

  test('weak low-light artwork does not override a readable code and title', () => {
    expect(
      decideScan(
        catalog,
        ['LUX', 'CROWNGUARD', 'OGS • 014/024'],
        [{ key: 'illuminated.webp', score: 0.55 }]
      )
    ).toMatchObject({ card: lux, via: 'code' });
  });

  test('weak artwork does not choose between same-name printings', () => {
    const alternate = {
      ...lux,
      variantNumber: 'VEN-SP6',
      setCode: 'VEN',
      imageUrl: 'alt-lux.webp',
    };
    const decision = decideScan(
      buildScanCatalog([lux, alternate]),
      ['LUX', 'CROWNGUARD'],
      [{ key: 'alt-lux.webp', score: 0.55 }]
    );
    expect(decision).toMatchObject({ kind: 'hold', options: [lux, alternate] });
  });

  test('a champion tag alone cannot pick a Lux title', () => {
    expect(decideScan(catalog, ['LUX'])).toBeNull();
  });
});

describe('collector-first camera decisions', () => {
  const lux = { variantNumber: 'OGS-014', name: 'Lux, Crownguard', setCode: 'OGS' };
  const other = { variantNumber: 'OGS-006', name: 'Lux, Illuminated', setCode: 'OGS' };
  const catalog = buildScanCatalog([lux, other]);

  test('middle text and names never identify a card', () => {
    expect(decideCollectorScan(catalog, ['Lux, Crownguard'])).toBeNull();
    expect(
      decideCollectorScan(catalog, ['Use only to play spells.', 'LUX'])
    ).toBeNull();
  });

  test('the footer code identifies the printing even if body text mentions another card', () => {
    expect(decideCollectorScan(catalog, ['Lux, Illuminated', 'OGS • 014/024'])).toEqual(
      { kind: 'card', card: lux, via: 'code', sure: false }
    );
  });

  test('split and low-light Lux footer readings resolve against the catalog', () => {
    expect(decideCollectorScan(catalog, ['OGS', '014/024'])).toMatchObject({
      card: lux,
    });
    expect(decideCollectorScan(catalog, ['OGS • OI4/024'])).toMatchObject({
      card: lux,
    });
  });

  test('conflicting valid OCR alternatives wait for a clearer frame', () => {
    expect(
      decideCollectorScan(catalog, [['OGS • 014/024', 'OGS • 006/024']])
    ).toBeNull();
  });

  test('an unknown number never falls back to a familiar name', () => {
    expect(
      decideCollectorScan(catalog, ['Lux, Crownguard', 'OGS • 999/024'])
    ).toBeNull();
  });
});
