import { describe, expect, test } from 'bun:test';
import { isCollectionVariantFoil } from '../../src/services/collection-service.js';

describe('isCollectionVariantFoil', () => {
  test('treats explicit foil siblings as foil under foil_mode=both', () => {
    expect(isCollectionVariantFoil('both', 'OGN-001-Foil', 'Foil', 'Standard')).toBe(
      true
    );
    expect(isCollectionVariantFoil('both', 'OGN-001', 'Standard', 'Standard')).toBe(
      false
    );
  });

  test('treats foil_only printings as foil even without foil in the label', () => {
    expect(
      isCollectionVariantFoil(
        'foil_only',
        'OGN-001-Nexus',
        'Nexus Night Promo',
        'Promo'
      )
    ).toBe(true);
    expect(
      isCollectionVariantFoil('foil_only', 'OGN-036', 'Standard', 'Standard')
    ).toBe(true);
  });

  test('treats nonfoil_only printings as non-foil', () => {
    expect(
      isCollectionVariantFoil('nonfoil_only', 'OGN-007', 'OGN Rune', 'Standard')
    ).toBe(false);
  });

  test('does not treat foil_mode=both as foil by itself', () => {
    expect(isCollectionVariantFoil('both', 'VEN-106', 'Standard', 'Standard')).toBe(
      false
    );
  });
});
