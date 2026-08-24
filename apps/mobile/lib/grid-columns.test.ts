import { describe, expect, test } from 'bun:test';
import { Layout } from '@/constants/Layout';
import {
  GRID_TILE_MIN_WIDTH,
  computeMaxCappedGridColumns,
  resolveGridTileMaxWidth,
} from '@/lib/grid-columns';

const gap = Layout.gridGap;

function tileWidthFor(available: number, columns: number) {
  return (available - gap * (columns - 1)) / columns;
}

describe('computeMaxCappedGridColumns', () => {
  test('large cards keep phone grids readable without packing too dense', () => {
    const available = 390;
    const maxTileWidth = resolveGridTileMaxWidth('large');
    const columns = computeMaxCappedGridColumns(available, gap, maxTileWidth);
    expect(columns).toBe(2);
    expect(tileWidthFor(available, columns)).toBeLessThanOrEqual(maxTileWidth);
    expect(tileWidthFor(available, columns)).toBeGreaterThanOrEqual(
      GRID_TILE_MIN_WIDTH
    );
  });

  test('medium cards keep phone catalogs around 3 columns', () => {
    const available = 390;
    const maxTileWidth = resolveGridTileMaxWidth('medium');
    const columns = computeMaxCappedGridColumns(available, gap, maxTileWidth);
    expect(columns).toBe(3);
    expect(tileWidthFor(available, columns)).toBeLessThanOrEqual(maxTileWidth);
  });

  test('large cards land around 5-up on landscape tablet instead of 8', () => {
    const available = 1194;
    const maxTileWidth = resolveGridTileMaxWidth('large');
    const columns = computeMaxCappedGridColumns(available, gap, maxTileWidth);
    expect(columns).toBeGreaterThanOrEqual(5);
    expect(columns).toBeLessThanOrEqual(6);
    expect(tileWidthFor(available, columns)).toBeLessThanOrEqual(maxTileWidth);
  });

  test('small cards allow denser tablet grids', () => {
    const available = 1194;
    const large = computeMaxCappedGridColumns(
      available,
      gap,
      resolveGridTileMaxWidth('large')
    );
    const small = computeMaxCappedGridColumns(
      available,
      gap,
      resolveGridTileMaxWidth('small')
    );
    expect(small).toBeGreaterThan(large);
  });

  test('does not drop below two columns on very narrow widths', () => {
    expect(
      computeMaxCappedGridColumns(200, gap, resolveGridTileMaxWidth('large'))
    ).toBe(2);
  });
});
