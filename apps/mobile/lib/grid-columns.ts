/** Floor so dense grids stay readable and tappable (px). */
export const GRID_TILE_MIN_WIDTH = 96;

/** Historical compact max tile width (px) for callers that omit a size preset. */
export const GRID_TILE_MAX_WIDTH = 148;

export type GridCardSize = 'large' | 'medium' | 'small';

/** Max tile width per Settings → Card size preset (px). */
export const GRID_CARD_SIZE_MAX_WIDTH: Record<GridCardSize, number> = {
  large: 220,
  medium: 180,
  small: GRID_TILE_MAX_WIDTH,
};

export const DEFAULT_GRID_CARD_SIZE: GridCardSize = 'large';

export const GRID_CARD_SIZE_OPTIONS: readonly {
  value: GridCardSize;
  label: string;
  description: string;
}[] = [
  { value: 'large', label: 'Large', description: 'Fewer cards per row' },
  { value: 'medium', label: 'Medium', description: 'Balanced density' },
  { value: 'small', label: 'Small', description: 'More cards per row' },
] as const;

const MIN_GRID_COLUMNS = 2;
const MAX_GRID_COLUMNS = 12;

export function isGridCardSize(value: unknown): value is GridCardSize {
  return value === 'large' || value === 'medium' || value === 'small';
}

export function resolveGridTileMaxWidth(
  size: GridCardSize = DEFAULT_GRID_CARD_SIZE
): number {
  return GRID_CARD_SIZE_MAX_WIDTH[size];
}

/** Pack columns with ceil so tile width stays ≤ maxTileWidth instead of stretching past it. */
export function computeMaxCappedGridColumns(
  available: number,
  gap: number,
  maxTileWidth = GRID_TILE_MAX_WIDTH,
  minTileWidth = GRID_TILE_MIN_WIDTH
): number {
  if (available <= 0) return MIN_GRID_COLUMNS;

  let numColumns = Math.ceil((available + gap) / (maxTileWidth + gap));
  numColumns = Math.max(MIN_GRID_COLUMNS, Math.min(MAX_GRID_COLUMNS, numColumns));

  while (
    numColumns > MIN_GRID_COLUMNS &&
    (available - gap * (numColumns - 1)) / numColumns < minTileWidth
  ) {
    numColumns -= 1;
  }

  return numColumns;
}
