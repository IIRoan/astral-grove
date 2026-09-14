import { describe, expect, test } from 'bun:test';
import { runeSizeForShortSide, runeSizeForWindow } from '@/lib/rune-size';

describe('runeSizeForShortSide', () => {
  test('uses lg on very small phones and xl otherwise', () => {
    expect(runeSizeForShortSide(320)).toBe('lg');
    expect(runeSizeForShortSide(359)).toBe('lg');
    expect(runeSizeForShortSide(360)).toBe('xl');
    expect(runeSizeForShortSide(390)).toBe('xl');
  });
});

describe('runeSizeForWindow', () => {
  test('narrow portrait phones use lg', () => {
    expect(runeSizeForWindow(320, 568)).toBe('lg');
  });

  test('regular portrait phones and tablets use xl', () => {
    expect(runeSizeForWindow(375, 667)).toBe('xl');
    expect(runeSizeForWindow(390, 844)).toBe('xl');
    expect(runeSizeForWindow(1024, 1366)).toBe('xl');
    expect(runeSizeForWindow(1440, 900)).toBe('xl');
  });

  test('short windows use lg even when the short side is wide enough', () => {
    expect(runeSizeForWindow(667, 375)).toBe('lg');
    expect(runeSizeForWindow(844, 390)).toBe('lg');
    expect(runeSizeForWindow(1280, 480)).toBe('lg');
    expect(runeSizeForWindow(1280, 559)).toBe('lg');
    expect(runeSizeForWindow(1280, 560)).toBe('xl');
  });
});
