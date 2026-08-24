import { Layout } from '@/constants/Layout';

const MIN_CATALOG_PAGE_SIZE = 40;
const MAX_CATALOG_PAGE_SIZE = 100;

/** Rows kept loaded beyond the visible viewport. */
export const CATALOG_SCROLL_BUFFER_ROWS = 10;
/** Extra viewport lengths to prefetch when the user scrolls down quickly. */
export const CATALOG_FAST_SCROLL_VIEWPORTS = 1.75;
/** px/ms — treat as a fast downward flick at or above this rate. */
export const CATALOG_FAST_SCROLL_VELOCITY = 0.55;
/** FlashList onEndReached threshold — start paging ~1.75 list lengths early. */
export const CATALOG_END_REACHED_THRESHOLD = 1.75;
/** Stable network page size — kept out of react-query keys. */
export const CATALOG_NETWORK_PAGE_SIZE = MAX_CATALOG_PAGE_SIZE;

/** Tray tile: art + panel (name, price, Add h-9) + gap. */
const GRID_META_HEIGHT_COMPACT = 100;
const GRID_META_HEIGHT = 104;
const LIST_ROW_HEIGHT_COMPACT = 56;
const LIST_ROW_HEIGHT = 72;

export type CatalogScrollMetrics = {
  distanceFromEnd: number;
  viewportHeight: number;
  velocityY: number;
};

/** Estimated vertical space for one catalog row. */
export function estimateCatalogRowHeight(
  layout: 'grid' | 'list',
  tileWidth: number,
  compact: boolean
): number {
  if (layout === 'list') {
    return compact ? LIST_ROW_HEIGHT_COMPACT : LIST_ROW_HEIGHT;
  }

  const imageHeight = tileWidth * (7 / 5);
  const metaHeight = compact ? GRID_META_HEIGHT_COMPACT : GRID_META_HEIGHT;
  return imageHeight + metaHeight + Layout.gridGap;
}

function rowsForViewport(
  viewportHeight: number,
  rowHeight: number,
  bufferRows: number
): number {
  const visibleRows = Math.max(1, Math.ceil(viewportHeight / rowHeight));
  return visibleRows + bufferRows;
}

/** Cards to load per page: viewport rows + buffer rows. */
export function estimateCatalogPageSize(
  numColumns: number,
  layout: 'grid' | 'list',
  viewportHeight: number,
  tileWidth: number,
  compact: boolean,
  bufferRows = CATALOG_SCROLL_BUFFER_ROWS
): number {
  const rowHeight = estimateCatalogRowHeight(layout, tileWidth, compact);
  const rows = rowsForViewport(viewportHeight, rowHeight, bufferRows);

  const batch = layout === 'list' ? rows : Math.max(numColumns, rows * numColumns);

  return Math.min(MAX_CATALOG_PAGE_SIZE, Math.max(MIN_CATALOG_PAGE_SIZE, batch));
}

/** Keep prefetching until content is at least this tall. */
export function catalogViewportTargetHeight(
  viewportHeight: number,
  layout: 'grid' | 'list',
  tileWidth: number,
  compact: boolean,
  bufferRows = CATALOG_SCROLL_BUFFER_ROWS
): number {
  const rowHeight = estimateCatalogRowHeight(layout, tileWidth, compact);
  return viewportHeight + rowHeight * bufferRows;
}

/** How far from the bottom (px) before we request the next page. */
export function catalogPrefetchDistance(
  layout: 'grid' | 'list',
  tileWidth: number,
  compact: boolean,
  options?: {
    bufferRows?: number;
    viewportHeight?: number;
    velocityY?: number;
  }
): number {
  const rowHeight = estimateCatalogRowHeight(layout, tileWidth, compact);
  const bufferRows = options?.bufferRows ?? CATALOG_SCROLL_BUFFER_ROWS;
  const viewportHeight = options?.viewportHeight ?? 0;
  const velocityY = Math.max(0, options?.velocityY ?? 0);

  let distance = rowHeight * bufferRows;

  if (viewportHeight > 0) {
    distance = Math.max(distance, viewportHeight * 0.35);
  }

  if (velocityY >= CATALOG_FAST_SCROLL_VELOCITY && viewportHeight > 0) {
    distance += viewportHeight * CATALOG_FAST_SCROLL_VIEWPORTS;
    distance += velocityY * 180;
  }

  return distance;
}

export function isFastCatalogScroll(velocityY: number): boolean {
  return velocityY >= CATALOG_FAST_SCROLL_VELOCITY;
}

/** How many upcoming list items to warm during scroll. */
export function catalogLookaheadCount(
  layout: 'grid' | 'list',
  numColumns: number,
  velocityY: number
): number {
  const base = layout === 'list' ? 24 : numColumns * 8;
  if (!isFastCatalogScroll(velocityY)) return base;
  return layout === 'list' ? 48 : numColumns * 14;
}

/** FlashList draw buffer (~1.5 viewports); native default 250 is too small for tall card tiles. */
export function catalogDrawDistance(viewportHeight: number): number {
  const height = Math.max(320, viewportHeight);
  return Math.max(900, Math.round(height * 1.5));
}

export function measureCatalogScrollVelocity(
  previous: { y: number; t: number },
  y: number,
  t: number
): number {
  const dt = Math.max(1, t - previous.t);
  const dy = y - previous.y;
  return dy / dt;
}

export function shouldPrefetchCatalog(
  metrics: CatalogScrollMetrics,
  layout: 'grid' | 'list',
  tileWidth: number,
  compact: boolean
): boolean {
  const threshold = catalogPrefetchDistance(layout, tileWidth, compact, {
    viewportHeight: metrics.viewportHeight,
    velocityY: metrics.velocityY,
  });
  return metrics.distanceFromEnd < threshold;
}
