import { describe, expect, test } from 'bun:test';
import {
  guideRect,
  previewRegionToFrameRegion,
  PREVIEW_ASPECT,
  toVisionRegion,
} from '@/utils/scanCrop';

describe('guideRect', () => {
  test('is a centred card-shaped frame that fits the container', () => {
    const guide = guideRect();
    expect(guide.width).toBeCloseTo(0.8, 5);
    expect(guide.height).toBeCloseTo(0.84, 5);
    expect(guide.x).toBeCloseTo((1 - guide.width) / 2, 5);
    expect(guide.y).toBeCloseTo((1 - guide.height) / 2, 5);
    expect(guide.y + guide.height).toBeLessThanOrEqual(1);
  });
});

describe('toVisionRegion', () => {
  test('flips the origin to bottom-left and keeps the size', () => {
    const flipped = toVisionRegion({ x: 0.1, y: 0.2, width: 0.5, height: 0.3 });
    expect(flipped).toEqual({ x: 0.1, y: 0.5, width: 0.5, height: 0.3 });
  });

  test('round-trips back to the original rect', () => {
    const rect = guideRect();
    expect(toVisionRegion(toVisionRegion(rect))).toEqual(rect);
  });
});

describe('previewRegionToFrameRegion', () => {
  const guide = toVisionRegion(guideRect());
  const region = {
    regionX: guide.x,
    regionY: guide.y,
    regionWidth: guide.width,
    regionHeight: guide.height,
  };

  test('crops away off-screen background from a rotated 16:9 camera buffer', () => {
    const crop = previewRegionToFrameRegion(region, {
      width: 1920,
      height: 1080,
      orientation: 'right',
    });
    expect(crop.regionX).toBeCloseTo(0.1);
    expect(crop.regionY).toBeCloseTo(0.185);
    expect(crop.regionWidth).toBeCloseTo(0.8);
    expect(crop.regionHeight).toBeCloseTo(0.63);
  });

  test('leaves the region alone when the buffer already matches the preview', () => {
    const crop = previewRegionToFrameRegion(region, {
      width: 3000,
      height: 3000 / PREVIEW_ASPECT,
      orientation: 'up',
    });
    expect(crop).toEqual(region);
  });

  test('stays inside the buffer whatever its shape', () => {
    for (const [width, height, orientation] of [
      [1080, 1920, 'up'],
      [1920, 1080, 'up'],
      [1280, 720, 'right'],
      [3000, 4000, 'left'],
    ] as const) {
      const crop = previewRegionToFrameRegion(region, { width, height, orientation });
      expect(crop.regionX).toBeGreaterThanOrEqual(0);
      expect(crop.regionY).toBeGreaterThanOrEqual(0);
      expect(crop.regionX + crop.regionWidth).toBeLessThanOrEqual(1);
      expect(crop.regionY + crop.regionHeight).toBeLessThanOrEqual(1);
    }
  });
});
