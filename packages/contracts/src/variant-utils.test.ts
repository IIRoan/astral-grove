import { describe, expect, test } from 'bun:test';
import {
  isTokenCard,
  isTokenVariantNumber,
  isUnresolvedDeckVariant,
  unresolvedDeckVariantNumber,
} from './variant-utils.js';

describe('isTokenCard', () => {
  test('detects tokens by super or token printing number', () => {
    expect(isTokenCard({ super: 'Token', variantNumber: 'OGN-273' })).toBe(true);
    expect(isTokenCard({ super: null, variantNumber: 'SFD-T03' })).toBe(true);
    expect(isTokenCard({ super: 'Champion', variantNumber: 'OGN-030' })).toBe(false);
  });
});

describe('isTokenVariantNumber', () => {
  test('detects token printings', () => {
    expect(isTokenVariantNumber('SFD-T03')).toBe(true);
    expect(isTokenVariantNumber('UNL-T05')).toBe(true);
  });

  test('allows normal cards', () => {
    expect(isTokenVariantNumber('OGN-164')).toBe(false);
    expect(isTokenVariantNumber('SFD-121-Foil')).toBe(false);
    expect(isTokenVariantNumber('OGN-271')).toBe(false);
  });
});

describe('unresolved deck variants', () => {
  test('marks and builds placeholder variant numbers', () => {
    const placeholder = unresolvedDeckVariantNumber('abc-123');
    expect(placeholder).toBe('unknown:abc-123');
    expect(isUnresolvedDeckVariant(placeholder)).toBe(true);
    expect(isUnresolvedDeckVariant('SFD-001')).toBe(false);
  });
});
