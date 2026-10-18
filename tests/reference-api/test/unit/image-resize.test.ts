import { describe, expect, test } from 'bun:test';
import {
  ALLOWED_THUMB_WIDTHS,
  canResizeKey,
  parseThumbWidth,
  thumbStorageKey,
} from '../../src/lib/image-resize.js';

describe('image resize helpers', () => {
  test('parseThumbWidth accepts whitelisted sizes only', () => {
    expect(parseThumbWidth('160')).toBe(160);
    expect(parseThumbWidth('96')).toBe(96);
    expect(parseThumbWidth('200')).toBeUndefined();
    expect(parseThumbWidth('')).toBeUndefined();
    expect(parseThumbWidth('abc')).toBeUndefined();
  });

  test('thumbStorageKey nests under thumbs/w{width}', () => {
    expect(thumbStorageKey('cards/OGN-001.webp', 160)).toBe(
      'thumbs/w160/cards/OGN-001.webp'
    );
  });

  test('canResizeKey is limited to card art', () => {
    expect(canResizeKey('cards/OGN-001.webp')).toBe(true);
    expect(canResizeKey('colors/mind.webp')).toBe(false);
  });

  test('ALLOWED_THUMB_WIDTHS includes list tile default', () => {
    expect(ALLOWED_THUMB_WIDTHS).toContain(160);
  });
});
