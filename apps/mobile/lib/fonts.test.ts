import { describe, expect, test } from 'bun:test';
import {
  FONT_MONO,
  FONT_SANS,
  WEB_FONT_MONO_FAMILY,
  WEB_FONT_SANS_FAMILY,
  fontFamilyForClassName,
  textFontStyleForClassName,
} from './fonts';

describe('fontFamilyForClassName', () => {
  test('maps weight classes to honest Lato faces (native names)', () => {
    expect(fontFamilyForClassName('font-sans font-normal')).toBe('Lato-Regular');
    expect(fontFamilyForClassName('font-medium')).toBe('Lato-Medium');
    expect(fontFamilyForClassName('font-semibold')).toBe('Lato-SemiBold');
    expect(fontFamilyForClassName('font-bold')).toBe('Lato-Bold');
    expect(fontFamilyForClassName('font-extrabold')).toBe('Lato-Bold');
    expect(fontFamilyForClassName('font-black')).toBe('Lato-Black');
    expect(FONT_SANS.normal).toBe('Lato-Regular');
  });

  test('maps mono + weight to GeistMono faces', () => {
    expect(fontFamilyForClassName('font-mono')).toBe('GeistMono-Regular');
    expect(fontFamilyForClassName('font-mono font-medium')).toBe('GeistMono-Medium');
    expect(fontFamilyForClassName('font-mono font-semibold')).toBe(
      'GeistMono-SemiBold'
    );
    expect(fontFamilyForClassName('font-mono font-black')).toBe(FONT_MONO.bold);
  });

  test('exports unified web family constants', () => {
    expect(WEB_FONT_SANS_FAMILY).toBe('Lato');
    expect(WEB_FONT_MONO_FAMILY).toBe('Geist Mono');
  });
});

describe('textFontStyleForClassName', () => {
  test('resets CSS weight on native so the face file is used as-is', () => {
    expect(textFontStyleForClassName('font-semibold text-foreground')).toEqual({
      fontFamily: FONT_SANS.semibold,
      fontWeight: 'normal',
      fontStyle: 'normal',
    });
  });
});
