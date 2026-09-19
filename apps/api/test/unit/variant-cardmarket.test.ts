import { describe, expect, test } from 'bun:test';
import {
  baseVariantNumberForCardmarket,
  cardmarketIdLookupCandidates,
  resolveCardmarketIdFromMap,
} from '../../src/lib/variant-cardmarket.js';

describe('baseVariantNumberForCardmarket', () => {
  test('strips a distinct -Foil SKU suffix', () => {
    expect(baseVariantNumberForCardmarket('SFD-001-Foil')).toBe('SFD-001');
    expect(baseVariantNumberForCardmarket('ogn-001-foil')).toBe('ogn-001');
  });

  test('returns null when there is no foil sibling suffix', () => {
    expect(baseVariantNumberForCardmarket('SFD-001')).toBeNull();
    expect(baseVariantNumberForCardmarket('SFD-R05a')).toBeNull();
  });
});

describe('cardmarketIdLookupCandidates', () => {
  test('includes foil base, release base, and signed base variants', () => {
    expect(cardmarketIdLookupCandidates('SFD-001-Foil')).toEqual([
      'sfd-001-foil',
      'sfd-001',
    ]);
    expect(cardmarketIdLookupCandidates('OGN-253-Release')).toEqual([
      'ogn-253-release',
      'ogn-253',
    ]);
    expect(cardmarketIdLookupCandidates('SFD-227*')).toEqual(['sfd-227*', 'sfd-227']);
    expect(cardmarketIdLookupCandidates('OGN-001a')).toEqual(['ogn-001a', 'ogn-001']);
  });
});

describe('resolveCardmarketIdFromMap', () => {
  test('uses the variant id when present', () => {
    const map = new Map<string, number | null>([
      ['sfd-001', 866723],
      ['sfd-001-foil', 999],
    ]);
    expect(resolveCardmarketIdFromMap('SFD-001-Foil', map)).toBe(999);
  });

  test('falls back to the base printing when the foil SKU has no id', () => {
    const map = new Map<string, number | null>([
      ['sfd-001', 866723],
      ['sfd-001-foil', null],
    ]);
    expect(resolveCardmarketIdFromMap('SFD-001-Foil', map)).toBe(866723);
  });

  test('falls back from Release promos to the standard printing id', () => {
    const map = new Map<string, number | null>([
      ['ogn-253', 845001],
      ['ogn-253-release', null],
    ]);
    expect(resolveCardmarketIdFromMap('OGN-253-Release', map)).toBe(845001);
  });

  test('returns null when no candidate is mapped', () => {
    expect(resolveCardmarketIdFromMap('SFD-001-Foil', new Map())).toBeNull();
  });
});
