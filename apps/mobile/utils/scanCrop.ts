/**
 * Geometry for the card scanner.
 *
 * The card is recognized by its picture, so the whole card face has to be in view and
 * reasonably square-on. The camera preview is locked to a known aspect ratio and a
 * guide frame tells the user where to hold the card; cropping to that guide before
 * anything else keeps a second card lying on the table out of the comparison.
 */

/** Card face, width / height. */
export const CARD_ASPECT = 5 / 7;
/** The camera container's aspect, width / height. Fixed so preview ↔ frame maps cleanly. */
export const PREVIEW_ASPECT = 3 / 4;
/** Guide frame width, as a fraction of the container width. */
export const GUIDE_WIDTH = 0.8;

export type NormalizedRect = { x: number; y: number; width: number; height: number };

/**
 * The guide frame, normalized (0–1) within the preview container. Doubles as the card
 * crop: everything outside it is background the matcher should never see.
 */
export function guideRect(): NormalizedRect {
  const width = GUIDE_WIDTH;
  const height = (width / CARD_ASPECT) * PREVIEW_ASPECT;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/** Alias that reads better at the call site where we crop to the card itself. */
export const cardRect = guideRect;

/**
 * Convert a top-left normalized rect to Vision's `regionOfInterest` convention, which
 * is normalized with the origin at the bottom-left.
 */
export function toVisionRegion(rect: NormalizedRect): NormalizedRect {
  return {
    x: rect.x,
    y: 1 - (rect.y + rect.height),
    width: rect.width,
    height: rect.height,
  };
}

/** Map the aspect-filled preview's Vision region into an oriented camera buffer. */
export function previewRegionToFrameRegion(
  region: {
    regionX: number;
    regionY: number;
    regionWidth: number;
    regionHeight: number;
  },
  frame: { width: number; height: number; orientation: string }
) {
  'worklet';
  const rotated = frame.orientation === 'left' || frame.orientation === 'right';
  const width = rotated ? frame.height : frame.width;
  const height = rotated ? frame.width : frame.height;
  const aspect = width / height;
  const visibleW = aspect > PREVIEW_ASPECT ? PREVIEW_ASPECT / aspect : 1;
  const visibleH = aspect < PREVIEW_ASPECT ? aspect / PREVIEW_ASPECT : 1;
  return {
    regionX: (1 - visibleW) / 2 + region.regionX * visibleW,
    regionY: (1 - visibleH) / 2 + region.regionY * visibleH,
    regionWidth: region.regionWidth * visibleW,
    regionHeight: region.regionHeight * visibleH,
  };
}
