import { describe, expect, test } from 'bun:test';
import {
  APP_ICON_WEIGHT,
  appIconWeightForSize,
  iconPixelSize,
  iconSizeFromStyle,
  iconStyleWithoutBoxSize,
} from './iconDefaults';

describe('iconDefaults', () => {
  test('uses bold as the global chrome weight', () => {
    expect(APP_ICON_WEIGHT).toBe('bold');
  });

  test('uses regular for tiny chrome icons', () => {
    expect(appIconWeightForSize(12)).toBe('regular');
    expect(appIconWeightForSize(16)).toBe('regular');
    expect(appIconWeightForSize(18)).toBe('bold');
  });

  test('snaps sizes to whole pixels for cleaner SVG AA', () => {
    expect(iconPixelSize(15.4)).toBe(15);
    expect(iconPixelSize(15.6)).toBe(16);
    expect(iconPixelSize(undefined)).toBe(24);
  });

  test('reads size from Uniwind box style', () => {
    expect(iconSizeFromStyle({ width: 14, height: 14, color: '#fff' })).toBe(14);
    expect(iconSizeFromStyle({ height: 18 })).toBe(18);
    expect(iconSizeFromStyle(undefined)).toBeUndefined();
  });

  test('strips width/height so Phosphor size owns metrics', () => {
    expect(
      iconStyleWithoutBoxSize({ width: 14, height: 14, color: '#abc', opacity: 1 })
    ).toEqual({
      color: '#abc',
      opacity: 1,
    });
  });
});
