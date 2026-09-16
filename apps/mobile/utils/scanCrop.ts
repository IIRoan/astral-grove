/**
 * Geometry for the card scanner.
 *
 * The collector code is ~12px of text at the bottom of a card. Handing Vision a full
 * 4032px photo and asking it to find that line is both slow and unreliable, so the
 * camera preview is locked to a known aspect ratio, a guide frame tells the user where
 * to hold the card, and we crop to just the band where the code lives before OCR.
 */

/** Card face, width / height. */
export const CARD_ASPECT = 5 / 7;
/** The camera container's aspect, width / height. Fixed so preview ↔ photo maps cleanly. */
export const PREVIEW_ASPECT = 3 / 4;
/** Guide frame width, as a fraction of the container width. */
export const GUIDE_WIDTH = 0.8;
/** Where the collector line starts, as a fraction down the card face. */
const CODE_BAND_TOP = 0.84;

export type NormalizedRect = { x: number; y: number; width: number; height: number };
export type CropRect = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

/**
 * The guide frame, normalized (0–1) within the preview container. Doubles as the card
 * crop: everything outside it is background the OCR pass should never see.
 */
export function guideRect(): NormalizedRect {
  const width = GUIDE_WIDTH;
  const height = (width / CARD_ASPECT) * PREVIEW_ASPECT;
  return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
}

/** The slice of the guide frame holding the printed code, normalized in container space. */
export function codeBandRect(): NormalizedRect {
  const guide = guideRect();
  return {
    x: guide.x,
    y: guide.y + guide.height * CODE_BAND_TOP,
    width: guide.width,
    height: guide.height * (1 - CODE_BAND_TOP),
  };
}

/**
 * Map a normalized rect in the preview container to pixel coordinates in the captured
 * photo.
 *
 * In practice the aspects already agree: expo-camera crops every capture to the preview
 * layer's aspect ratio before handing it over (`CameraPhotoCapture.processImageData`
 * → `AVMakeRect(aspectRatio: previewSize, …)`), and the container's ratio is pinned to
 * `PREVIEW_ASPECT`, so this reduces to a scale. The cover-margin arithmetic is kept as
 * the safety net for any device or SDK where that stops holding.
 */
export function previewRectToPhotoCrop(
  rect: NormalizedRect,
  photo: { width: number; height: number }
): CropRect {
  const photoAspect = photo.width / photo.height;

  // Fraction of the photo actually visible in the container, and where it starts.
  let visibleW = 1;
  let visibleH = 1;
  if (photoAspect > PREVIEW_ASPECT) {
    visibleW = PREVIEW_ASPECT / photoAspect;
  } else if (photoAspect < PREVIEW_ASPECT) {
    visibleH = photoAspect / PREVIEW_ASPECT;
  }
  const offsetX = (1 - visibleW) / 2;
  const offsetY = (1 - visibleH) / 2;

  const originX = (offsetX + rect.x * visibleW) * photo.width;
  const originY = (offsetY + rect.y * visibleH) * photo.height;
  const width = rect.width * visibleW * photo.width;
  const height = rect.height * visibleH * photo.height;

  // Native crop wants integers, and a zero-size rect throws.
  return {
    originX: Math.max(0, Math.round(originX)),
    originY: Math.max(0, Math.round(originY)),
    width: Math.max(1, Math.min(Math.round(width), photo.width)),
    height: Math.max(1, Math.min(Math.round(height), photo.height)),
  };
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
