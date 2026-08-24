import { describe, expect, test } from 'bun:test';
import {
  catalogToolbarButtonClasses,
  catalogToolbarIconColor,
  catalogToolbarSegmentClasses,
  CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS,
  CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS_MOBILE,
  CATALOG_TOOLBAR_CONTROL_CLASS,
  CATALOG_TOOLBAR_CONTROL_CLASS_MOBILE,
  CATALOG_TOOLBAR_LABELED_CONTROL_CLASS,
  CATALOG_TOOLBAR_MOBILE_ROW_CLASS,
  CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS,
  CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS_MOBILE,
} from '@/constants/catalogToolbar';

describe('catalogToolbarIconColor', () => {
  test('active tone uses foreground for legibility on panel backgrounds', () => {
    expect(catalogToolbarIconColor('active')).toBe('foreground');
  });

  test('inactive tone uses muted-foreground', () => {
    expect(catalogToolbarIconColor('inactive')).toBe('muted-foreground');
  });

  test('primary tone uses foreground (Factory chalk — no chromatic chrome)', () => {
    expect(catalogToolbarIconColor('primary')).toBe('foreground');
  });
});

describe('catalogToolbarButtonClasses', () => {
  test('idle button uses base control shell without active modifier', () => {
    const classes = catalogToolbarButtonClasses(false);
    expect(classes).toContain(CATALOG_TOOLBAR_CONTROL_CLASS);
    expect(classes).not.toContain(CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS);
  });

  test('active button adds panel background and ash border', () => {
    const classes = catalogToolbarButtonClasses(true);
    expect(classes).toContain(CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS);
    expect(classes).toContain('size-11');
    expect(classes).toContain('border-border');
    expect(classes).toContain('bg-card-panel');
  });

  test('mobile idle button uses bordered card shell for contrast', () => {
    const classes = catalogToolbarButtonClasses(false, true);
    expect(classes).toContain(CATALOG_TOOLBAR_CONTROL_CLASS_MOBILE);
    expect(classes).toContain('border-border');
    expect(classes).toContain('size-11');
    expect(classes).toContain('shrink-0');
  });

  test('mobile active button uses ash border and panel fill', () => {
    const classes = catalogToolbarButtonClasses(true, true);
    expect(classes).toContain(CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS_MOBILE);
    expect(classes).toContain('border-border');
    expect(classes).toContain('bg-card-panel');
    expect(classes).toContain('size-11');
  });

  test('labeled desktop button uses compact squared shell without size-11', () => {
    const classes = catalogToolbarButtonClasses(false, false, true);
    expect(classes).toContain(CATALOG_TOOLBAR_LABELED_CONTROL_CLASS);
    expect(classes).not.toContain('size-11');
    expect(classes).toContain('h-10');
    expect(classes).toContain('rounded-[3px]');
    expect(classes).toContain('px-3');
  });
});

describe('catalogToolbarSegmentClasses', () => {
  test('selected segment gets panel fill', () => {
    expect(catalogToolbarSegmentClasses(true)).toContain(
      CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS
    );
  });

  test('unselected segment stays transparent with press feedback', () => {
    const classes = catalogToolbarSegmentClasses(false);
    expect(classes).not.toContain(CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS);
    expect(classes).toContain('active:opacity-70');
  });

  test('mobile selected segment gets panel fill on bordered track', () => {
    expect(catalogToolbarSegmentClasses(true, true)).toContain(
      CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS_MOBILE
    );
  });
});

describe('CATALOG_TOOLBAR_MOBILE_ROW_CLASS', () => {
  test('lays out leading prefs and trailing tools in one full-width row', () => {
    expect(CATALOG_TOOLBAR_MOBILE_ROW_CLASS).toContain('w-full');
    expect(CATALOG_TOOLBAR_MOBILE_ROW_CLASS).toContain('flex-row');
    expect(CATALOG_TOOLBAR_MOBILE_ROW_CLASS).toContain('gap-2');
    expect(CATALOG_TOOLBAR_MOBILE_ROW_CLASS).toContain('justify-between');
  });
});
