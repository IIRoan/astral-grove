import type { HybridObject } from 'react-native-nitro-modules';
import type { Frame } from 'react-native-vision-camera';

/** Framing for one recognition pass over a camera frame. */
export interface FrameScanOptions {
  /**
   * How the frame's pixel data is rotated, straight from `frame.orientation`.
   * Frames are not rotated up-front because rotating buffers is expensive, so the
   * consumer has to interpret them — Vision takes this as an orientation flag.
   */
  orientation: string;
  /**
   * The on-screen guide, normalized within the oriented frame, origin bottom-left
   * (Vision's convention). Cropping to it first stops a card lying on the table behind
   * the one being scanned from winning.
   */
  regionX: number;
  regionY: number;
  regionWidth: number;
  regionHeight: number;
}

/** A catalog image the card in frame looks like. */
export interface CardMatch {
  /** The key this image was packed under in the art index. */
  key: string;
  /** Cosine similarity of the two descriptors: 1 is identical, 0 unrelated. */
  score: number;
  /** Disagreeing gradient bits. Low confirms the layout, high vetoes a lucky score. */
  hamming: number;
}

export interface FrameScanResult {
  /**
   * Whether a card-shaped quadrilateral was located and straightened. When false the
   * guide crop was described as-is, which only works if the card fills the guide.
   */
  cardDetected: boolean;
  /** Nearest catalog images, best first. Empty until an art index is installed. */
  matches: CardMatch[];
  /** Milliseconds per stage. Reported in dev builds to keep the budget honest. */
  locateMs: number;
  describeMs: number;
  searchMs: number;
}

export interface CardOcrFrame extends HybridObject<{ ios: 'swift' }> {
  /** Return a completed scan, or submit this frame to the native worker when idle. */
  pollScan(frame: Frame, options: FrameScanOptions): FrameScanResult | undefined;

  /** Discard results and tracking from before a pause, confirmation, or remount. */
  resetScan(): void;

  /**
   * Locate the card in the frame, straighten it, describe what it looks like and look
   * that description up in the index — all on the frame's own buffer.
   */
  scan(frame: Frame, options: FrameScanOptions): FrameScanResult;

  /**
   * Which descriptor this binary computes. Descriptors from different versions are not
   * comparable, so an index built for another version is refused outright.
   */
  readonly descriptorVersion: number;

  /**
   * Install the packed reference index `scan` searches, exactly as the API served it.
   * An empty buffer clears the index. Returns how many records were installed, so a
   * malformed or wrong-version payload is visible to JS rather than silently ignored.
   */
  setArtIndex(index: ArrayBuffer): number;
}
