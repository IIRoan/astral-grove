import { describe, expect, test } from 'bun:test';
import {
  CARD_HEIGHT_FOR_WIDTH,
  LEGEND_ART_WINDOW,
  legendFullCardHeight,
  legendListArtLayout,
} from '@/lib/legend-list-art';

describe('legendListArtLayout', () => {
  test('returns empty layout until the rail has a size', () => {
    expect(legendListArtLayout(0, 220)).toEqual({
      cardWidth: 0,
      cardHeight: 0,
      offsetX: 0,
      offsetY: 0,
    });
  });

  test('covers a landscape rail with the illustration window, not the card chrome', () => {
    const railWidth = 320;
    const railHeight = 248;
    const layout = legendListArtLayout(railWidth, railHeight);

    expect(layout.cardWidth).toBeGreaterThan(railWidth);
    expect(layout.cardHeight).toBe(
      Math.round(layout.cardWidth * CARD_HEIGHT_FOR_WIDTH)
    );
    expect(layout.offsetX).toBeLessThan(0);
    expect(layout.offsetY).toBeLessThan(0);

    const windowLeft = layout.offsetX + LEGEND_ART_WINDOW.left * layout.cardWidth;
    const windowTop = layout.offsetY + LEGEND_ART_WINDOW.top * layout.cardHeight;
    const windowRight =
      layout.offsetX +
      (LEGEND_ART_WINDOW.left + LEGEND_ART_WINDOW.width) * layout.cardWidth;
    const windowBottom =
      layout.offsetY +
      (LEGEND_ART_WINDOW.top + LEGEND_ART_WINDOW.height) * layout.cardHeight;

    expect(windowLeft).toBeLessThanOrEqual(1);
    expect(windowTop).toBeLessThanOrEqual(1);
    expect(windowRight).toBeGreaterThanOrEqual(railWidth - 1);
    expect(windowBottom).toBeGreaterThanOrEqual(railHeight - 2);
  });

  test('keeps a square-ish compact rail covered without letterboxing', () => {
    const layout = legendListArtLayout(176, 160);
    expect(layout.cardWidth).toBeGreaterThan(176);
    expect(layout.offsetX).toBeLessThan(0);
  });

  test('sizes a full card rail to the printed 5:7 ratio', () => {
    expect(legendFullCardHeight(176)).toBe(Math.round(176 * CARD_HEIGHT_FOR_WIDTH));
  });
});
