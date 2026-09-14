/**
 * Pure responsive layout math shared by screens, sheets and grids.
 * Everything here is width/height arithmetic with no React Native runtime imports, so it is unit-tested in bun.
 */
import type { LayoutRectangle, ScaledSize } from 'react-native';

// ─── Breakpoints & shared geometry ───

/**
 * Pure layout breakpoints shared by hooks, sheets and grids.
 * Width classes follow window width (not device type) so iPad Split View / Slide Over,
 * Stage Manager and resized desktop windows all resolve like a phone of the same width.
 */

export const BREAKPOINTS = {
  /** Below this, treat as a narrow phone (iPhone SE, Slide Over). */
  compact: 360,
  /** Wide enough for centered, width-capped sheets and forms (large phones in landscape, iPad). */
  medium: 600,
  /** iPad portrait and up. */
  tablet: 768,
  /** Desktop side rail + split detail layout (web only). */
  desktop: 1024,
} as const;

/** Max width for bottom sheets on wide windows so rows and footers do not stretch edge to edge. */
export const SHEET_MAX_WIDTH = 640;

/** Readable column width for settings / auth / forms on tablets and desktop. */
export const FORM_MAX_WIDTH = 720;

export type WidthClass = 'compact' | 'regular' | 'medium' | 'tablet' | 'desktop';

export function widthClassFor(width: number): WidthClass {
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  if (width >= BREAKPOINTS.medium) return 'medium';
  if (width >= BREAKPOINTS.compact) return 'regular';
  return 'compact';
}

/** Desktop rail + split catalog layouts are pointer/hover-first, so they stay web-only. */
export function showSideRailFor(width: number, isWeb: boolean): boolean {
  return isWeb && width >= BREAKPOINTS.desktop;
}

export function isTabletWidth(width: number): boolean {
  return width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
}

/** Horizontal gutter for screen content — matches ScreenLayout `px-4 sm:px-6` (sm = 640). */
export function screenGutterFor(width: number, showRail: boolean): number {
  if (showRail) return 16;
  return width >= 640 ? 24 : 16;
}

/**
 * Side margins that center a sheet at `maxWidth` on wide windows while
 * always clearing horizontal safe-area insets (landscape notch / rounded corners).
 */
export function centeredSheetMargins(
  windowWidth: number,
  insets: { left: number; right: number },
  maxWidth = SHEET_MAX_WIDTH
): { marginLeft: number; marginRight: number } {
  const spare =
    windowWidth >= BREAKPOINTS.medium ? Math.max(0, windowWidth - maxWidth) / 2 : 0;
  return {
    marginLeft: Math.max(spare, insets.left),
    marginRight: Math.max(spare, insets.right),
  };
}

/** Fit an aspect-locked box (e.g. card art, width / height = ratio) inside a bounding box. */
export function fitAspectBox(
  maxWidth: number,
  maxHeight: number,
  ratio: number
): { width: number; height: number } {
  const safeW = Math.max(0, maxWidth);
  const safeH = Math.max(0, maxHeight);
  const widthFromHeight = safeH * ratio;
  if (widthFromHeight <= safeW) {
    return { width: widthFromHeight, height: safeH };
  }
  return { width: safeW, height: safeW / ratio };
}

// ─── Form column (settings / verify / invite) ───

/**
 * ScreenLayout `contentClassName` for settings / verify / invite forms: a readable,
 * centered column on iPad and desktop instead of 2000px-wide inputs.
 * Literal class (Tailwind scans source) — must stay in sync with FORM_MAX_WIDTH (above; enforced by test).
 */
export const FORM_COLUMN_CLASS = 'max-w-[720px] self-center';

/** Parse the `max-w-[Npx]` arbitrary value out of a class string (null when absent). */
export function maxWidthPxFromClass(className: string): number | null {
  const match = /(?:^|\s)max-w-\[(\d+)px\](?:\s|$)/.exec(className);
  return match ? Number(match[1]) : null;
}

// ─── Popover placement ───

export type LayoutPosition = {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

/** Vertical placement for top/bottom popovers, clamped inside the window's safe area. */
export function getVerticalSidePosition({
  side,
  triggerPosition,
  contentLayout,
  sideOffset,
  insetTop,
  insetBottom,
  avoidCollisions,
  dimensions,
}: {
  side: 'top' | 'bottom';
  triggerPosition: LayoutPosition;
  contentLayout: LayoutRectangle;
  sideOffset: number;
  insetTop: number;
  insetBottom: number;
  avoidCollisions: boolean;
  dimensions: ScaledSize;
}): { top?: number } {
  const positionTop = triggerPosition.pageY - sideOffset - contentLayout.height;
  const positionBottom = triggerPosition.pageY + triggerPosition.height + sideOffset;

  if (!avoidCollisions) {
    return {
      top: side === 'top' ? positionTop : positionBottom,
    };
  }

  // Never place above the top inset: content taller than the window would otherwise
  // start off-screen; the caller caps maxHeight from the resolved top instead.
  if (side === 'top') {
    return {
      top: Math.max(
        insetTop,
        Math.min(
          Math.max(insetTop, positionTop),
          dimensions.height - insetBottom - contentLayout.height
        )
      ),
    };
  }

  // For bottom placement, flip upward when there is more room above.
  const spaceBelow = dimensions.height - insetBottom - positionBottom;
  const spaceAbove = triggerPosition.pageY - insetTop - sideOffset;

  if (contentLayout.height > spaceBelow && spaceAbove > spaceBelow) {
    return {
      top: Math.max(insetTop, positionTop),
    };
  }

  return {
    top: Math.max(
      insetTop,
      Math.min(dimensions.height - insetBottom - contentLayout.height, positionBottom)
    ),
  };
}

// ─── Catalog detail header ───

/** Detail header card thumbnail width on regular phones, tablets and the desktop panel. */
export const CATALOG_DETAIL_THUMB_WIDTH = 128;

/**
 * Shrink the detail header thumbnail on narrow phones (iPhone SE 320/375, Slide Over) so the
 * card name column keeps a readable width next to it.
 */
export function catalogDetailThumbWidthFor(windowWidth: number): number {
  if (windowWidth < BREAKPOINTS.compact) return 96;
  if (windowWidth < 400) return 112;
  return CATALOG_DETAIL_THUMB_WIDTH;
}

// ─── Catalog desktop toolbar density ───

/**
 * Desktop catalog toolbar density. The toolbar sits in the catalog column, which is only
 * ~550px wide at 1024–1430px web windows (rail + detail panel), so the right action group
 * (collection nav, Quick add, sort) must shed labels before it starves the filter triggers.
 *
 * Thresholds are estimates of the single-row width at 13px labels:
 * - filter triggers (Colors … Stats) ≈ 435px
 * - full actions (labeled nav + Quick add + full sort label) ≈ 520px
 * - medium actions (labeled nav + icon Quick add + short sort label) ≈ 390px
 * - row padding + gaps + divider ≈ 30px
 */
export type CatalogToolbarDensity = 'full' | 'medium' | 'compact';

export const CATALOG_TOOLBAR_FULL_MIN_WIDTH = 1000;
export const CATALOG_TOOLBAR_MEDIUM_MIN_WIDTH = 860;

/** `width` is the measured toolbar width; unmeasured (null/0) keeps the full layout. */
export function catalogToolbarDensityFor(
  width: number | null | undefined
): CatalogToolbarDensity {
  if (!width || width >= CATALOG_TOOLBAR_FULL_MIN_WIDTH) return 'full';
  if (width >= CATALOG_TOOLBAR_MEDIUM_MIN_WIDTH) return 'medium';
  return 'compact';
}

// ─── Deck builder workspace ───

/**
 * Desktop deck-builder workspace: [info drawer] [catalog] [composition list].
 * Pure width math so the drawer can default closed where it would starve the catalog
 * (e.g. 1024px web windows leave ~296px for card tiles with both side panels open).
 */

/** Below this the catalog grid drops to one or two cramped columns. */
export const DECK_BUILDER_MIN_CATALOG_WIDTH = 480;

export interface DeckBuilderWorkspaceSizes {
  drawerWidth: number;
  listWidth: number;
  gap: number;
}

/** Width left for the center (catalog) column. */
export function deckBuilderCatalogWidth(
  contentWidth: number,
  infoDrawerOpen: boolean,
  { drawerWidth, listWidth, gap }: DeckBuilderWorkspaceSizes
): number {
  const drawer = infoDrawerOpen ? drawerWidth + gap : 0;
  return Math.max(0, contentWidth - listWidth - gap - drawer);
}

/** Whether the info drawer can be open without shrinking the catalog below its minimum. */
export function deckBuilderInfoDrawerFits(
  contentWidth: number,
  sizes: DeckBuilderWorkspaceSizes,
  minCatalogWidth = DECK_BUILDER_MIN_CATALOG_WIDTH
): boolean {
  return deckBuilderCatalogWidth(contentWidth, true, sizes) >= minCatalogWidth;
}

// ─── Owned decks grid ───

/** Owned-decks grid: tile width for a flex-wrap row measured from the real content width. */
export const DECK_GRID_GAP = 12;
export const DECK_GRID_MIN_TILE = 280;
export const DECK_GRID_MAX_COLUMNS = 3;

export function deckGridTileWidth(
  available: number,
  {
    gap = DECK_GRID_GAP,
    minTile = DECK_GRID_MIN_TILE,
    maxColumns = DECK_GRID_MAX_COLUMNS,
  }: { gap?: number; minTile?: number; maxColumns?: number } = {}
): { columns: number; tileWidth: number } {
  const width = Math.max(0, available);
  const columns = Math.max(
    1,
    Math.min(maxColumns, Math.floor((width + gap) / (minTile + gap)))
  );
  // Floor so sub-pixel rounding never pushes the last tile onto a new row.
  const tileWidth = Math.floor((width - gap * (columns - 1)) / columns);
  return { columns, tileWidth: Math.max(0, tileWidth) };
}

// ─── Desktop deck rows ───

/**
 * Wide (desktop web) deck row: [legend rail] [identity 17rem] [secondary 11rem+] [readout 11.5rem] [actions 7.75rem].
 * The card clips with overflow-hidden, so at 1024–1190px windows the actions column would be cut off.
 * Given the measured card width, drop the low-priority secondary column (timestamps / community stats),
 * then shrink the legend rail, and finally fall back to the stacked (phone) card.
 */

const IDENTITY = 272; // w-[17rem]
const SECONDARY_MIN = 176; // min-w-[11rem]
const READOUT = 184; // w-[11.5rem]
const ACTIONS = 124; // w-[7.75rem]
const GAP = 24; // gap-6
const PADDING = 28; // p-3.5 × 2
const BORDER = 2;

export const DECK_ROW_RAIL_MIN = 160;

export interface DeckRowLayout {
  /** Render the phone-style stacked card instead of the wide row. */
  stacked: boolean;
  showSecondary: boolean;
  railWidth: number;
}

export function deckRowLayout(cardWidth: number, railWide: number): DeckRowLayout {
  const full = { stacked: false, showSecondary: true, railWidth: railWide };
  // Unmeasured: keep the designed layout for the first frame.
  if (!(cardWidth > 0)) return full;

  const core = BORDER + PADDING + IDENTITY + READOUT + ACTIONS + GAP * 2;
  const withSecondary = core + SECONDARY_MIN + GAP;

  if (cardWidth >= withSecondary + railWide) return full;
  if (cardWidth >= core + railWide) {
    return { stacked: false, showSecondary: false, railWidth: railWide };
  }
  const rail = Math.floor(cardWidth - core);
  if (rail >= DECK_ROW_RAIL_MIN) {
    return { stacked: false, showSecondary: false, railWidth: rail };
  }
  return { stacked: true, showSecondary: false, railWidth: railWide };
}

// ─── Play score seats ───

/**
 * Score-tracker seat density from the measured seat box. Seats clip with overflow-hidden,
 * so short windows (568pt phones, short web) and narrow 3–4 player grids on 320pt phones
 * step down to tighter padding / smaller numerals instead of cutting off the XP row.
 */
export type PlaySeatDensity = 'regular' | 'compact' | 'tight';

export interface PlaySeatLayout {
  density: PlaySeatDensity;
  /** Horizontal content padding (pt) — mirrors px-5 / px-2. */
  paddingX: number;
  /** Drop the "XP" caption when the stepper row would not fit. */
  showXpLabel: boolean;
}

/** Stacked content heights incl. vertical padding and the "Final point" / "Victory" cue. */
export const PLAY_SEAT_MIN_HEIGHT = {
  regular: 250,
  compact: 220,
} as const;

const PAD_X_WIDE = 20;
export const PLAY_SEAT_PAD_X_NARROW = 8;
/** Below this seat width, px-5 eats too much of the XP row. */
const NARROW_SEAT_WIDTH = 200;
/** XP caption + two steppers + value + gaps. */
const XP_ROW_WITH_LABEL = 132;

export function playSeatLayout(
  width: number,
  height: number,
  preferCompact: boolean
): PlaySeatLayout {
  const measured = width > 0 && height > 0;
  const paddingX =
    measured && width < NARROW_SEAT_WIDTH ? PLAY_SEAT_PAD_X_NARROW : PAD_X_WIDE;
  const showXpLabel = !measured || width - paddingX * 2 >= XP_ROW_WITH_LABEL;

  if (!measured) {
    return { density: preferCompact ? 'compact' : 'regular', paddingX, showXpLabel };
  }

  let density: PlaySeatDensity;
  if (!preferCompact && height >= PLAY_SEAT_MIN_HEIGHT.regular) density = 'regular';
  else if (height >= PLAY_SEAT_MIN_HEIGHT.compact) density = 'compact';
  else density = 'tight';

  return { density, paddingX, showXpLabel };
}
