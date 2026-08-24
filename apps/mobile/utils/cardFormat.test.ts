import { describe, expect, test } from 'bun:test';
import { formatCardPrice, formatStat } from '@/utils/cardFormat';

describe('formatStat', () => {
  test('shows em dash for zero or negative stats', () => {
    expect(formatStat(0)).toBe('—');
    expect(formatStat(-1)).toBe('—');
  });

  test('stringifies positive stats', () => {
    expect(formatStat(3)).toBe('3');
    expect(formatStat(12)).toBe('12');
  });
});

describe('formatCardPrice', () => {
  test('formats trend price for matching foil/non-foil row', () => {
    const price = formatCardPrice(
      [
        { market: 1.25, low: 0.5, isFoil: false },
        { market: 4.5, low: 3, isFoil: true },
      ],
      { variantNumber: 'OGN-001', variantLabel: 'Standard', variantType: 'Standard' }
    );
    expect(price).toBe('€1.25');
  });

  test('returns null when no market price exists', () => {
    const price = formatCardPrice([{ market: null, low: 0.02, isFoil: false }], {
      variantNumber: 'OGN-001',
      variantLabel: 'Standard',
    });
    expect(price).toBeNull();
  });
});
