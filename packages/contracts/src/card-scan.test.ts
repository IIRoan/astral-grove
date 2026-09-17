import { describe, expect, test } from 'bun:test';
import {
  confidentArt,
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
