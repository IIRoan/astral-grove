import { useMemo, useRef } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Layout } from '@/constants/Layout';
import { useTheme } from '@/context/ThemeContext';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import {
  GRID_TILE_MAX_WIDTH,
  GRID_TILE_MIN_WIDTH,
  computeMaxCappedGridColumns,
  resolveGridTileMaxWidth,
  type GridCardSize,
} from '@/lib/grid-columns';

export {
  GRID_TILE_MAX_WIDTH,
  GRID_TILE_MIN_WIDTH,
  computeMaxCappedGridColumns,
  resolveGridTileMaxWidth,
  type GridCardSize,
} from '@/lib/grid-columns';

const MIN_GRID_COLUMNS = 2;
const MAX_GRID_COLUMNS = 12;
const TARGET_GRID_COLUMNS = 8;
const DESKTOP_MAX_WIDTH = 1600;
const LIST_MAX_WIDTH = 640;

function computeGridLayout(
  contentWidth: number,
  fillAvailable = false,
  subtractScreenPadding = true,
  maxTileWidth = GRID_TILE_MAX_WIDTH
) {
  const horizontalPad = subtractScreenPadding ? Layout.screenPaddingHorizontal * 2 : 0;
  const gap = Layout.gridGap;
  const available = contentWidth - horizontalPad;

  let numColumns = Math.max(
    MIN_GRID_COLUMNS,
    Math.floor((available + gap) / (maxTileWidth + gap))
  );
  numColumns = Math.min(MAX_GRID_COLUMNS, numColumns);

  if (!fillAvailable) {
    const minForEight =
      TARGET_GRID_COLUMNS * maxTileWidth + (TARGET_GRID_COLUMNS - 1) * gap;
    if (available >= minForEight) {
      numColumns = Math.max(TARGET_GRID_COLUMNS, numColumns);
    }
  }

  let tileWidth = (available - gap * (numColumns - 1)) / numColumns;

  if (fillAvailable) {
    tileWidth = Math.max(GRID_TILE_MIN_WIDTH, tileWidth);
    return { numColumns, tileWidth, gap };
  }

  if (tileWidth > maxTileWidth) {
    numColumns = Math.max(
      MIN_GRID_COLUMNS,
      Math.floor((available + gap) / (maxTileWidth + gap))
    );
    tileWidth = (available - gap * (numColumns - 1)) / numColumns;
  }

  tileWidth = Math.max(GRID_TILE_MIN_WIDTH, Math.min(maxTileWidth, tileWidth));

  return { numColumns, tileWidth, gap };
}

/** Mobile / tablet catalog grids — hard-cap tile size, grow columns with width. */
function computeMobileGridLayout(
  contentWidth: number,
  fillAvailable = false,
  subtractScreenPadding = true,
  maxTileWidth = GRID_TILE_MAX_WIDTH
) {
  const horizontalPad = subtractScreenPadding ? Layout.screenPaddingHorizontal * 2 : 0;
  const gap = Layout.gridGap;
  const available = contentWidth - horizontalPad;
  const numColumns = computeMaxCappedGridColumns(available, gap, maxTileWidth);

  let tileWidth = (available - gap * (numColumns - 1)) / numColumns;
  if (fillAvailable) {
    tileWidth = Math.max(GRID_TILE_MIN_WIDTH, tileWidth);
  } else {
    tileWidth = Math.max(GRID_TILE_MIN_WIDTH, Math.min(maxTileWidth, tileWidth));
  }

  return { numColumns, tileWidth, gap };
}

type ResponsiveColumnOptions = {
  /** Pixels to subtract from window width (side rail, detail panel, outer gutters). */
  reservedWidth?: number;
  /** Measured catalog column width — used in split layout for accurate column math. */
  measuredWidth?: number | null;
  /** Expand tiles to fill the measured column (split catalog + detail layout). */
  fillAvailable?: boolean;
  /** Override Settings → Card size for this grid. */
  gridCardSize?: GridCardSize;
};

export type ResponsiveColumnResult = ReturnType<typeof useResponsiveColumns>;

type StableResponsiveColumnOptions = ResponsiveColumnOptions & {
  /** When true, freeze column math until window resize or layout mode change. */
  measurementReady?: boolean;
};

type StableResponsiveColumnCache = {
  windowWidth: number;
  layout: 'grid' | 'list';
  gridCardSize: GridCardSize;
  values: ResponsiveColumnResult;
};

export function useResponsiveColumns(
  layout: 'grid' | 'list',
  options?: ResponsiveColumnOptions
) {
  const { width } = useWindowDimensions();
  const isMobile = useMobileLayout();
  const { gridCardSize: settingGridCardSize } = useTheme();
  const gridCardSize = options?.gridCardSize ?? settingGridCardSize;
  const maxTileWidth = resolveGridTileMaxWidth(gridCardSize);
  const reservedWidth = options?.reservedWidth ?? 0;
  const measuredWidth = options?.measuredWidth;
  const fillAvailable = options?.fillAvailable ?? false;

  return useMemo(() => {
    const isMeasured = measuredWidth != null && measuredWidth > 0;
    const contentWidth = isMeasured
      ? measuredWidth
      : Math.max(320, Math.min(width, DESKTOP_MAX_WIDTH) - reservedWidth);
    const subtractScreenPadding = !isMeasured;

    if (layout === 'list') {
      const horizontalPad = subtractScreenPadding
        ? Layout.screenPaddingHorizontal * 2
        : 0;
      return {
        numColumns: 1,
        contentWidth,
        tileWidth: Math.min(contentWidth - horizontalPad, LIST_MAX_WIDTH),
        gap: Layout.gridGap,
        listMaxWidth: LIST_MAX_WIDTH,
        compact: false,
      };
    }

    if (isMobile) {
      const grid = computeMobileGridLayout(
        contentWidth,
        fillAvailable,
        subtractScreenPadding,
        maxTileWidth
      );
      return {
        contentWidth,
        listMaxWidth: LIST_MAX_WIDTH,
        compact: true,
        ...grid,
      };
    }

    const grid = computeGridLayout(
      contentWidth,
      fillAvailable,
      subtractScreenPadding,
      maxTileWidth
    );
    return {
      contentWidth,
      listMaxWidth: LIST_MAX_WIDTH,
      compact: grid.tileWidth < 160,
      ...grid,
    };
  }, [
    layout,
    width,
    reservedWidth,
    measuredWidth,
    fillAvailable,
    isMobile,
    maxTileWidth,
  ]);
}

/** Like useResponsiveColumns, but freezes after measure so search/filter transitions don't resize tiles. */
export function useStableResponsiveColumns(
  layout: 'grid' | 'list',
  options?: StableResponsiveColumnOptions
) {
  const { width: windowWidth } = useWindowDimensions();
  const { gridCardSize: settingGridCardSize } = useTheme();
  const gridCardSize = options?.gridCardSize ?? settingGridCardSize;
  const measurementReady = options?.measurementReady ?? true;
  const live = useResponsiveColumns(layout, options);
  const cacheRef = useRef<StableResponsiveColumnCache | null>(null);

  if (!measurementReady) {
    return live;
  }

  const cache = cacheRef.current;
  const shouldRefresh =
    cache == null ||
    cache.windowWidth !== windowWidth ||
    cache.layout !== layout ||
    cache.gridCardSize !== gridCardSize;

  if (shouldRefresh) {
    cacheRef.current = {
      windowWidth,
      layout,
      gridCardSize,
      values: live,
    };
    return live;
  }

  return cache.values;
}

export function useIsDesktopLayout() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 768;
}
