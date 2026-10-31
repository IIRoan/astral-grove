import { describe, expect, test } from 'bun:test';
import { mobileTabIdFromPathname, tabIdFromPathname } from './tab-route';

describe('tabIdFromPathname', () => {
  test('matches bare and group-prefixed tab paths', () => {
    expect(tabIdFromPathname('/collection')).toBe('collection');
    expect(tabIdFromPathname('/(tabs)/collection')).toBe('collection');
    expect(tabIdFromPathname('/decks/abc')).toBe('decks');
    expect(tabIdFromPathname('/(tabs)/decks/browse')).toBe('decks');
    expect(tabIdFromPathname('/settings')).toBe('settings');
    expect(tabIdFromPathname('/fun')).toBe('fun');
    expect(tabIdFromPathname('/(tabs)/fun')).toBe('fun');
    expect(tabIdFromPathname('/search')).toBe('search');
    expect(tabIdFromPathname('/')).toBe('search');
  });

  test('mobile tab bar files Fun under Settings', () => {
    expect(mobileTabIdFromPathname('/fun')).toBe('settings');
    expect(mobileTabIdFromPathname('/settings')).toBe('settings');
    expect(mobileTabIdFromPathname('/decks/abc')).toBe('decks');
  });
});
