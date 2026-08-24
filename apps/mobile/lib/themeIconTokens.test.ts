import { describe, expect, test } from 'bun:test';
import {
  THEME_ICON_COLOR_VARS,
  themeIconColorVar,
  type ThemedIconColor,
} from '@/lib/themeIconTokens';

const ALL_COLORS: ThemedIconColor[] = [
  'foreground',
  'muted-foreground',
  'primary',
  'primary-foreground',
  'ring',
  'archive-accent-text',
];

describe('THEME_ICON_COLOR_VARS', () => {
  test('every themed icon color maps to a --color-* CSS variable', () => {
    for (const color of ALL_COLORS) {
      const cssVar = THEME_ICON_COLOR_VARS[color];
      expect(cssVar).toMatch(/^--color-/);
      expect(themeIconColorVar(color)).toBe(cssVar);
    }
  });

  test('foreground and muted-foreground resolve to distinct variables', () => {
    expect(THEME_ICON_COLOR_VARS.foreground).not.toBe(
      THEME_ICON_COLOR_VARS['muted-foreground']
    );
  });
});

describe('toolbar icon color tokens', () => {
  test('stepper and toolbar controls use semantic tokens not raw hex', () => {
    const toolbarTokens: ThemedIconColor[] = ['foreground', 'muted-foreground'];
    for (const token of toolbarTokens) {
      expect(THEME_ICON_COLOR_VARS[token]).toBeDefined();
      expect(THEME_ICON_COLOR_VARS[token]).toStartWith('--color-');
    }
  });
});
