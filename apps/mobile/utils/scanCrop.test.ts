import { describe, expect, test } from 'bun:test';
import {
  codeBandRect,
  guideRect,
  previewRectToPhotoCrop,
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

describe('codeBandRect', () => {
  test('sits at the bottom of the guide and shares its width', () => {
    const guide = guideRect();
    const band = codeBandRect();
    expect(band.x).toBeCloseTo(guide.x, 5);
    expect(band.width).toBeCloseTo(guide.width, 5);
    expect(band.y + band.height).toBeCloseTo(guide.y + guide.height, 5);
    expect(band.height).toBeLessThan(guide.height * 0.2);
  });
});

describe('previewRectToPhotoCrop', () => {
  const full = { x: 0, y: 0, width: 1, height: 1 };

  test('maps the whole container to the whole photo when aspects match', () => {
    const photo = { width: 3000, height: 4000 };
    expect(previewRectToPhotoCrop(full, photo)).toEqual({
      originX: 0,
      originY: 0,
      width: 3000,
      height: 4000,
    });
  });

  test('adds back the horizontal margin the cover crop hides', () => {
    // 1:1 photo is wider than the 3:4 container, so the sides are off-screen.
    const photo = { width: 4000, height: 4000 };
    const crop = previewRectToPhotoCrop(full, photo);
    expect(crop.width).toBe(Math.round(PREVIEW_ASPECT * 4000));
    expect(crop.originX).toBe(Math.round((4000 - crop.width) / 2));
    expect(crop.originY).toBe(0);
    expect(crop.height).toBe(4000);
  });

  test('adds back the vertical margin for a tall photo', () => {
    // 1:2 photo is taller than 3:4, so top and bottom are off-screen.
    const photo = { width: 2000, height: 4000 };
    const crop = previewRectToPhotoCrop(full, photo);
    expect(crop.height).toBe(Math.round(2000 / PREVIEW_ASPECT));
    expect(crop.originY).toBe(Math.round((4000 - crop.height) / 2));
    expect(crop.originX).toBe(0);
    expect(crop.width).toBe(2000);
  });

  test('keeps the code band inside the photo bounds', () => {
    for (const photo of [
      { width: 3000, height: 4000 },
      { width: 4000, height: 3000 },
      { width: 1080, height: 1920 },
    ]) {
      const crop = previewRectToPhotoCrop(codeBandRect(), photo);
      expect(crop.originX).toBeGreaterThanOrEqual(0);
      expect(crop.originY).toBeGreaterThanOrEqual(0);
      expect(crop.originX + crop.width).toBeLessThanOrEqual(photo.width);
      expect(crop.originY + crop.height).toBeLessThanOrEqual(photo.height);
      expect(crop.width).toBeGreaterThan(0);
      expect(crop.height).toBeGreaterThan(0);
    }
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

  test('keeps the code band inside the unit square', () => {
    const band = toVisionRegion(codeBandRect());
    expect(band.y).toBeGreaterThanOrEqual(0);
    expect(band.y + band.height).toBeLessThanOrEqual(1);
  });
});

describe('previewRegionToFrameRegion', () => {
  test('crops away off-screen background from a rotated 16:9 camera buffer', () => {
    const guide = toVisionRegion(guideRect());
    const crop = previewRegionToFrameRegion(
      {
        regionX: guide.x,
        regionY: guide.y,
        regionWidth: guide.width,
        regionHeight: guide.height,
      },
      { width: 1920, height: 1080, orientation: 'right' }
    );
    expect(crop.regionX).toBeCloseTo(0.1);
    expect(crop.regionY).toBeCloseTo(0.185);
    expect(crop.regionWidth).toBeCloseTo(0.8);
    expect(crop.regionHeight).toBeCloseTo(0.63);
  });

  test('maps the collector strip to the same visible pixels as the photo engine', () => {
    const band = codeBandRect();
    const vision = toVisionRegion(band);
    for (const [width, height] of [
      [1080, 1920],
      [1920, 1080],
      [3000, 4000],
    ]) {
      const frame = { width: width!, height: height!, orientation: 'up' };
      const crop = previewRegionToFrameRegion(
        {
          regionX: vision.x,
          regionY: vision.y,
          regionWidth: vision.width,
          regionHeight: vision.height,
        },
        frame
      );
      const photo = previewRectToPhotoCrop(band, frame);
      expect(Math.round(crop.regionX * frame.width)).toBe(photo.originX);
      expect(Math.round((1 - crop.regionY - crop.regionHeight) * frame.height)).toBe(
        photo.originY
      );
      expect(Math.round(crop.regionWidth * frame.width)).toBe(photo.width);
      expect(Math.round(crop.regionHeight * frame.height)).toBe(photo.height);
    }
  });
});
