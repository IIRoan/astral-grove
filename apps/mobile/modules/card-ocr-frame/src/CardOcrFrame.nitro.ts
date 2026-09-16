import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

/** Tuning for one recognition pass over a camera frame. */
export interface FrameScanOptions {
  /** `fast` or `accurate`. */
  recognitionLevel: string;
  /** Off for collector codes — they are serial numbers, not words. */
  usesLanguageCorrection: boolean;
  /** How many ranked readings to return per line. */
  maxCandidates: number;
  /**
   * How the frame's pixel data is rotated, straight from `frame.orientation`.
   * Frames are not rotated up-front because rotating buffers is expensive, so the
   * consumer has to interpret them — Vision takes this as an orientation flag.
   */
  orientation: string;
  /**
   * Width the located card is rectified to before reading. Bigger means the printed
   * code covers more pixels, at the cost of a slower recognition pass.
   */
  rectifiedWidth: number;
  /**
   * Fallback region of interest, used only when no card is located in the frame.
   * Normalized, origin bottom-left (Vision's convention).
   */
  regionX: number;
  regionY: number;
  regionWidth: number;
  regionHeight: number;
}

export interface FrameScanResult {
  /** One entry per recognized line: ranked readings, best first. */
  lines: string[][];
  /**
   * Whether a card-shaped quadrilateral was located and straightened. When false the
   * lines came from the fallback region instead, and are far less reliable.
   */
  cardDetected: boolean;
}

export interface CardOcrFrame extends HybridObject<{ ios: 'swift' }> {
  /**
   * Locate the card in the frame, straighten it, and run Apple Vision text
   * recognition over it — all on the frame's own pixel buffer.
   */
  scan(frame: Frame, options: FrameScanOptions): FrameScanResult;
}
