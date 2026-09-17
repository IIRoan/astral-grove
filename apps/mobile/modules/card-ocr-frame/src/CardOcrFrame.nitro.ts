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
   * Normalized within the oriented frame, origin bottom-left (Vision's convention).
   */
  regionX: number;
  regionY: number;
  regionWidth: number;
  regionHeight: number;
  /**
   * Read the whole card straight away. Normally the collector strip is read first and
   * the rest only when that finds no code — the strip is a fraction of the work, and
   * with the artwork recognized the code is all that is left to learn. Set when the
   * quick read did not settle it, so the name gets a say.
   */
  wholeCard: boolean;
}

/** A catalog image the card in frame looks like. */
export interface ImageMatch {
  /** The key the image was registered under in `setIndex`. */
  key: string;
  /** Cosine similarity to the straightened card: 1 is identical, 0 unrelated. */
  score: number;
}

export interface FrameScanResult {
  /** One entry per recognized line: ranked readings, best first. */
  lines: string[][];
  /**
   * Whether a card-shaped quadrilateral was located and straightened. When false the
   * lines came from the fallback region instead, and are far less reliable.
   */
  cardDetected: boolean;
  /**
   * Nearest catalog images, best first. Empty until `setIndex` has been called.
   * Whole-card fallback passes match the visible guide when card edges are missing.
   */
  matches: ImageMatch[];
  /** False when only the collector strip was read, so `lines` holds no card name. */
  wholeCard: boolean;
  /** Milliseconds spent locating, recognizing and reading. Reported in dev builds. */
  locateMs: number;
  matchMs: number;
  readMs: number;
}

export interface CardOcrFrame extends HybridObject<{ ios: 'swift' }> {
  /** Return a completed scan, or submit this frame to the native worker when idle. */
  pollScan(frame: Frame, options: FrameScanOptions): FrameScanResult | undefined;

  /** Discard results from before a pause, confirmation, or camera remount. */
  resetScan(): void;

  /**
   * Locate the card in the frame, straighten it, read it with Apple Vision text
   * recognition and look its artwork up in the index — all on the frame's own buffer.
   */
  scan(frame: Frame, options: FrameScanOptions): FrameScanResult;

  /**
   * Which embedding this OS produces. Vectors from different versions are not
   * comparable, so a stored index is only good for the version it was built with.
   */
  readonly embeddingVersion: string;

  /**
   * Download an image and embed it: a unit-length `Float32Array` in an ArrayBuffer.
   * Runs the same code path as `scan`, so reference art and camera frames always match.
   */
  embedImage(url: string): Promise<ArrayBuffer>;

  /**
   * Install the reference vectors `scan` searches: `keys.length` rows of equal width,
   * packed row after row as float32. An empty `keys` clears the index.
   */
  setIndex(keys: string[], vectors: ArrayBuffer): void;
}
