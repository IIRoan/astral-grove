import { describe, expect, test } from 'bun:test';
import { tabBarContentInset } from '@/constants/Layout';
import {
  listBottomInset,
  mobileTabBarVisible,
  mobileTabBarWidth,
  toastBottomOffset,
} from '@/lib/mobile-chrome';

describe('mobileTabBarVisible', () => {
  test('shows on primary tab routes', () => {
    expect(mobileTabBarVisible('/search', false)).toBe(true);
    expect(mobileTabBarVisible('/decks', false)).toBe(true);
    expect(mobileTabBarVisible('/decks/browse', false)).toBe(true);
    expect(mobileTabBarVisible('/collection', false)).toBe(true);
  });

  test('hides on deep deck builder/editor routes', () => {
    expect(mobileTabBarVisible('/decks/abc', false)).toBe(false);
    expect(mobileTabBarVisible('/decks/abc/add', false)).toBe(false);
  });

  test('hides on play, card modals, and desktop rail', () => {
    expect(mobileTabBarVisible('/play', false)).toBe(false);
    expect(mobileTabBarVisible('/play/setup', false)).toBe(false);
    expect(mobileTabBarVisible('/card/OGN-001', false)).toBe(false);
    expect(mobileTabBarVisible('/search', true)).toBe(false);
  });
});

describe('listBottomInset', () => {
  test('reserves the floating tab bar when it is visible', () => {
    expect(listBottomInset(34, true)).toBe(tabBarContentInset(34));
    expect(listBottomInset(34, true)).toBeGreaterThan(100);
  });

  test('drops tab-bar clearance when the bar is hidden', () => {
    expect(listBottomInset(34, false)).toBe(50);
    expect(listBottomInset(34, false)).toBeLessThan(tabBarContentInset(34));
  });
});

describe('toastBottomOffset', () => {
  test('floats above the tab bar when it is visible', () => {
    // bar bottom = max(34, 12) = 34, bar top = 34 + 56 = 90
    expect(toastBottomOffset(34, true)).toBe(98);
    expect(toastBottomOffset(0, true)).toBe(12 + 56 + 8);
  });

  test('clears the home indicator when the bar is hidden', () => {
    expect(toastBottomOffset(34, false)).toBe(42);
    expect(toastBottomOffset(0, false)).toBe(20);
  });
});

describe('mobileTabBarWidth', () => {
  const noInsets = { left: 0, right: 0 };

  test('caps at max width on wide windows (iPad, desktop narrow web)', () => {
    expect(mobileTabBarWidth(1024, noInsets)).toBe(400);
  });

  test('uses 16pt gutters on regular phones', () => {
    expect(mobileTabBarWidth(375, noInsets)).toBe(343);
  });

  test('tightens gutters on narrow phones so labels fit', () => {
    expect(mobileTabBarWidth(320, noInsets)).toBe(304);
  });

  test('never sits under landscape side insets', () => {
    expect(mobileTabBarWidth(390, { left: 47, right: 47 })).toBe(296);
  });

  test('never goes negative', () => {
    expect(mobileTabBarWidth(10, noInsets)).toBe(0);
  });
});
