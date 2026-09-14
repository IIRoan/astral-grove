import { describe, expect, test } from 'bun:test';
import {
  BREAKPOINTS,
  CATALOG_DETAIL_THUMB_WIDTH,
  CATALOG_TOOLBAR_FULL_MIN_WIDTH,
  CATALOG_TOOLBAR_MEDIUM_MIN_WIDTH,
  catalogDetailThumbWidthFor,
  catalogToolbarDensityFor,
  centeredSheetMargins,
  DECK_ROW_RAIL_MIN,
  deckBuilderCatalogWidth,
  deckBuilderInfoDrawerFits,
  deckGridTileWidth,
  deckRowLayout,
  fitAspectBox,
  FORM_COLUMN_CLASS,
  FORM_MAX_WIDTH,
  getVerticalSidePosition,
  isTabletWidth,
  maxWidthPxFromClass,
  playSeatLayout,
  screenGutterFor,
  SHEET_MAX_WIDTH,
  showSideRailFor,
  widthClassFor,
} from '@/lib/responsive-layout';

// ─── Breakpoints & shared geometry ───

/** Common window widths in points/CSS px. */
const DEVICES = {
  iphoneSE1: 320,
  iphoneSE3: 375,
  iphone15: 393,
  iphoneProMax: 430,
  ipadSlideOver: 320,
  ipadSplitThird: 507,
  ipadMiniPortrait: 744,
  ipadPortrait: 820,
  ipadLandscape: 1180,
  ipadPro13Landscape: 1366,
  desktop: 1440,
} as const;

describe('widthClassFor', () => {
  test('classifies by window width, not device type', () => {
    expect(widthClassFor(DEVICES.iphoneSE1)).toBe('compact');
    expect(widthClassFor(DEVICES.ipadSlideOver)).toBe('compact');
    expect(widthClassFor(DEVICES.iphoneSE3)).toBe('regular');
    expect(widthClassFor(DEVICES.iphoneProMax)).toBe('regular');
    expect(widthClassFor(DEVICES.ipadSplitThird)).toBe('regular');
    expect(widthClassFor(DEVICES.ipadMiniPortrait)).toBe('medium');
    expect(widthClassFor(DEVICES.ipadPortrait)).toBe('tablet');
    expect(widthClassFor(DEVICES.ipadLandscape)).toBe('desktop');
  });

  test('boundaries are inclusive at the lower edge', () => {
    expect(widthClassFor(BREAKPOINTS.compact - 1)).toBe('compact');
    expect(widthClassFor(BREAKPOINTS.compact)).toBe('regular');
    expect(widthClassFor(BREAKPOINTS.tablet)).toBe('tablet');
    expect(widthClassFor(BREAKPOINTS.desktop)).toBe('desktop');
  });
});

describe('showSideRailFor', () => {
  test('desktop rail only on wide web windows', () => {
    expect(showSideRailFor(DEVICES.desktop, true)).toBe(true);
    expect(showSideRailFor(BREAKPOINTS.desktop, true)).toBe(true);
    expect(showSideRailFor(BREAKPOINTS.desktop - 1, true)).toBe(false);
  });

  test('native tablets keep the touch tab bar at any width', () => {
    expect(showSideRailFor(DEVICES.ipadPro13Landscape, false)).toBe(false);
  });
});

describe('isTabletWidth', () => {
  test('covers iPad portrait but not phones or desktop', () => {
    expect(isTabletWidth(DEVICES.ipadPortrait)).toBe(true);
    expect(isTabletWidth(DEVICES.iphoneProMax)).toBe(false);
    expect(isTabletWidth(DEVICES.desktop)).toBe(false);
  });
});

describe('screenGutterFor', () => {
  test('matches ScreenLayout px-4 / sm:px-6', () => {
    expect(screenGutterFor(DEVICES.iphone15, false)).toBe(16);
    expect(screenGutterFor(639, false)).toBe(16);
    expect(screenGutterFor(640, false)).toBe(24);
    expect(screenGutterFor(DEVICES.desktop, true)).toBe(16);
  });
});

describe('centeredSheetMargins', () => {
  const none = { left: 0, right: 0 };

  test('phones get full-width sheets', () => {
    expect(centeredSheetMargins(DEVICES.iphone15, none)).toEqual({
      marginLeft: 0,
      marginRight: 0,
    });
  });

  test('wide windows center the sheet at the max width', () => {
    const margins = centeredSheetMargins(DEVICES.ipadLandscape, none);
    expect(margins.marginLeft).toBe((DEVICES.ipadLandscape - SHEET_MAX_WIDTH) / 2);
    expect(DEVICES.ipadLandscape - margins.marginLeft - margins.marginRight).toBe(
      SHEET_MAX_WIDTH
    );
  });

  test('never covers side safe-area insets (landscape notch)', () => {
    expect(centeredSheetMargins(DEVICES.iphone15, { left: 59, right: 59 })).toEqual({
      marginLeft: 59,
      marginRight: 59,
    });
  });

  test('windows barely wider than the cap do not go negative', () => {
    expect(centeredSheetMargins(SHEET_MAX_WIDTH - 20, none)).toEqual({
      marginLeft: 0,
      marginRight: 0,
    });
  });
});

describe('fitAspectBox', () => {
  const CARD = 5 / 7;

  test('height-bound on tall narrow windows would overflow width — clamps to width', () => {
    // iPhone SE: 343 wide available, 560 tall budget → 400 wide from height; must clamp.
    const box = fitAspectBox(343, 560, CARD);
    expect(box.width).toBe(343);
    expect(box.height).toBeCloseTo(343 / CARD);
    expect(box.height).toBeLessThanOrEqual(560);
  });

  test('height-bound on wide short windows (landscape)', () => {
    const box = fitAspectBox(1000, 300, CARD);
    expect(box.height).toBe(300);
    expect(box.width).toBeCloseTo(300 * CARD);
  });

  test('never negative', () => {
    expect(fitAspectBox(-10, -10, CARD)).toEqual({ width: 0, height: 0 });
  });
});

// ─── Form column (settings / verify / invite) ───

describe('FORM_COLUMN_CLASS', () => {
  test('caps the column at FORM_MAX_WIDTH', () => {
    expect(maxWidthPxFromClass(FORM_COLUMN_CLASS)).toBe(FORM_MAX_WIDTH);
  });

  test('centers the column', () => {
    expect(FORM_COLUMN_CLASS.split(' ')).toContain('self-center');
  });
});

describe('maxWidthPxFromClass', () => {
  test('returns null without an arbitrary max width', () => {
    expect(maxWidthPxFromClass('w-full self-center')).toBeNull();
    expect(maxWidthPxFromClass('max-w-md')).toBeNull();
  });
});

// ─── Popover placement ───

const dimensions = { width: 375, height: 667, scale: 2, fontScale: 1 };
const trigger = { pageX: 16, pageY: 400, width: 120, height: 40 };

function place(side: 'top' | 'bottom', contentHeight: number) {
  return getVerticalSidePosition({
    side,
    triggerPosition: trigger,
    contentLayout: { x: 0, y: 0, width: 200, height: contentHeight },
    sideOffset: 4,
    insetTop: 20,
    insetBottom: 34,
    avoidCollisions: true,
    dimensions,
  }).top!;
}

describe('getVerticalSidePosition', () => {
  test('places a short popover below the trigger', () => {
    expect(place('bottom', 100)).toBe(444);
  });

  test('flips above when there is more room', () => {
    expect(place('bottom', 300)).toBe(96);
  });

  test('content taller than the window never starts above the top inset', () => {
    expect(place('bottom', 900)).toBe(20);
    expect(place('top', 900)).toBe(20);
  });
});

// ─── Catalog detail header ───

describe('catalogDetailThumbWidthFor', () => {
  test('narrowest phones get the smallest thumbnail', () => {
    expect(catalogDetailThumbWidthFor(320)).toBe(96);
    expect(catalogDetailThumbWidthFor(359)).toBe(96);
  });

  test('375pt phones get a slightly reduced thumbnail', () => {
    expect(catalogDetailThumbWidthFor(360)).toBe(112);
    expect(catalogDetailThumbWidthFor(375)).toBe(112);
  });

  test('regular phones, tablets and desktop keep the full thumbnail', () => {
    expect(catalogDetailThumbWidthFor(400)).toBe(CATALOG_DETAIL_THUMB_WIDTH);
    expect(catalogDetailThumbWidthFor(430)).toBe(CATALOG_DETAIL_THUMB_WIDTH);
    expect(catalogDetailThumbWidthFor(1440)).toBe(CATALOG_DETAIL_THUMB_WIDTH);
  });
});

// ─── Catalog desktop toolbar density ───

describe('catalogToolbarDensityFor', () => {
  test('keeps full layout before the toolbar is measured', () => {
    expect(catalogToolbarDensityFor(null)).toBe('full');
    expect(catalogToolbarDensityFor(undefined)).toBe('full');
    expect(catalogToolbarDensityFor(0)).toBe('full');
  });

  test('full at and above the full threshold', () => {
    expect(catalogToolbarDensityFor(CATALOG_TOOLBAR_FULL_MIN_WIDTH)).toBe('full');
    expect(catalogToolbarDensityFor(1400)).toBe('full');
  });

  test('medium between thresholds', () => {
    expect(catalogToolbarDensityFor(CATALOG_TOOLBAR_FULL_MIN_WIDTH - 1)).toBe('medium');
    expect(catalogToolbarDensityFor(CATALOG_TOOLBAR_MEDIUM_MIN_WIDTH)).toBe('medium');
  });

  test('compact for narrow catalog columns (web 1024–1430 split layout)', () => {
    expect(catalogToolbarDensityFor(CATALOG_TOOLBAR_MEDIUM_MIN_WIDTH - 1)).toBe(
      'compact'
    );
    expect(catalogToolbarDensityFor(552)).toBe('compact');
  });
});

// ─── Deck builder workspace ───

const sizes = { drawerWidth: 280, listWidth: 320, gap: 16 };

describe('deckBuilderCatalogWidth', () => {
  test('1024px web window (rail + gutters → 928 content) with both panels', () => {
    expect(deckBuilderCatalogWidth(928, true, sizes)).toBe(296);
  });

  test('closing the drawer returns its width and gap to the catalog', () => {
    expect(deckBuilderCatalogWidth(928, false, sizes)).toBe(592);
  });

  test('never negative', () => {
    expect(deckBuilderCatalogWidth(200, true, sizes)).toBe(0);
  });
});

describe('deckBuilderInfoDrawerFits', () => {
  test('stays closed at 1024 wide', () => {
    expect(deckBuilderInfoDrawerFits(928, sizes)).toBe(false);
  });

  test('opens on wide desktop windows', () => {
    expect(deckBuilderInfoDrawerFits(1344, sizes)).toBe(true);
  });

  test('boundary at the minimum catalog width', () => {
    // 480 + 320 + 16 + 280 + 16 = 1112
    expect(deckBuilderInfoDrawerFits(1112, sizes)).toBe(true);
    expect(deckBuilderInfoDrawerFits(1111, sizes)).toBe(false);
  });
});

// ─── Owned decks grid ───

describe('deckGridTileWidth', () => {
  test('768 iPad portrait with sm:px-6 gutters (720 content) keeps two columns', () => {
    const { columns, tileWidth } = deckGridTileWidth(720);
    expect(columns).toBe(2);
    expect(tileWidth * 2 + 12).toBeLessThanOrEqual(720);
  });

  test('phones fall back to one full-width column', () => {
    expect(deckGridTileWidth(343)).toEqual({ columns: 1, tileWidth: 343 });
    expect(deckGridTileWidth(288)).toEqual({ columns: 1, tileWidth: 288 });
  });

  test('caps at three columns on wide desktop', () => {
    expect(deckGridTileWidth(1600).columns).toBe(3);
  });

  test('tiles never overflow the row after flooring', () => {
    for (const width of [572, 573, 600, 877, 878, 1001]) {
      const { columns, tileWidth } = deckGridTileWidth(width);
      expect(tileWidth * columns + 12 * (columns - 1)).toBeLessThanOrEqual(width);
    }
  });

  test('guards against zero / negative widths', () => {
    expect(deckGridTileWidth(0)).toEqual({ columns: 1, tileWidth: 0 });
  });
});

// ─── Desktop deck rows ───

const RAIL = 300;

describe('deckRowLayout', () => {
  test('unmeasured cards keep the full row', () => {
    expect(deckRowLayout(0, RAIL)).toEqual({
      stacked: false,
      showSecondary: true,
      railWidth: RAIL,
    });
  });

  test('wide desktop fits every column (min 1158 incl. border)', () => {
    expect(deckRowLayout(1158, RAIL).showSecondary).toBe(true);
    expect(deckRowLayout(1400, RAIL).railWidth).toBe(RAIL);
  });

  test('drops the secondary column first', () => {
    expect(deckRowLayout(1157, RAIL)).toEqual({
      stacked: false,
      showSecondary: false,
      railWidth: RAIL,
    });
    expect(deckRowLayout(958, RAIL).railWidth).toBe(RAIL);
  });

  test('then shrinks the rail (1024px window → 928 card)', () => {
    expect(deckRowLayout(928, RAIL)).toEqual({
      stacked: false,
      showSecondary: false,
      railWidth: 270,
    });
  });

  test('falls back to the stacked card when the rail would be too thin', () => {
    const core = 958 - RAIL;
    expect(deckRowLayout(core + DECK_ROW_RAIL_MIN, RAIL).stacked).toBe(false);
    expect(deckRowLayout(core + DECK_ROW_RAIL_MIN - 1, RAIL).stacked).toBe(true);
  });
});

// ─── Play score seats ───

describe('playSeatLayout', () => {
  test('unmeasured seats keep the caller hint', () => {
    expect(playSeatLayout(0, 0, false)).toEqual({
      density: 'regular',
      paddingX: 20,
      showXpLabel: true,
    });
    expect(playSeatLayout(0, 0, true).density).toBe('compact');
  });

  test('tall 2-player seats stay regular', () => {
    expect(playSeatLayout(390, 360, false).density).toBe('regular');
  });

  test('568pt phone 2-player seats (~208pt) step down to tight', () => {
    expect(playSeatLayout(320, 208, false).density).toBe('tight');
  });

  test('mid-height seats use compact even without the hint', () => {
    expect(playSeatLayout(375, 230, false).density).toBe('compact');
  });

  test('compact hint never upgrades to regular', () => {
    expect(playSeatLayout(700, 500, true).density).toBe('compact');
  });

  test('narrow 4-player seats on 320pt phones tighten padding so the XP row fits', () => {
    const layout = playSeatLayout(160, 240, true);
    expect(layout.paddingX).toBe(8);
    expect(layout.showXpLabel).toBe(true);
  });

  test('drops the XP caption only when even tight padding cannot fit it', () => {
    expect(playSeatLayout(140, 240, true).showXpLabel).toBe(false);
  });
});
