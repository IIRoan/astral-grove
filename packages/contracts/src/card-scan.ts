/**
 * Turning what the camera saw into a card.
 *
 * The scanner identifies a card by its picture: the device compares the rectified card
 * in frame against the packed reference index (see `card-art.ts`) and reports the
 * nearest catalog images. Everything printed on the card — its name, its rules text,
 * the collector code along the bottom — is ignored, because reading any of it costs
 * more per frame than the whole visual lookup does and needs a steadier hand than
 * anyone scanning a stack of cards has.
 *
 * What a picture cannot do is separate reprints. One piece of art is printed across
 * several sets under different collector numbers, and those printings are pixel
 * identical. When the winning image belongs to more than one printing this returns the
 * whole group and the caller asks which one it is.
 */

import { artIndexKey } from './card-art.js';

/** A catalog image the card in frame looks like, as ranked by the device. */
export type ArtMatch = {
  /** `artIndexKey` of the matched catalog image. */
  key: string;
  /** Cosine similarity of the two descriptors: 1 is identical, 0 unrelated. */
  score: number;
  /** Disagreeing gradient bits, 0–`ART_BIT_COUNT`. Low is good. */
  hamming: number;
};

/**
 * Below this the nearest catalog image is only the least different one, not a match.
 * A starting point rather than a measurement: tune against the scores the scanner's
 * development overlay prints on real cards before trusting it.
 */
export const ART_SCORE_FLOOR = 0.82;
/**
 * How far the winner must be clear of the next different picture. Without a gap the
 * scanner would pick between two similar cards on noise, and a wrong card added
 * silently is worse than a card that takes another moment.
 */
export const ART_SCORE_MARGIN = 0.04;
/** Of `ART_BIT_COUNT` gradient bits, how many may disagree before the match is refused. */
export const ART_HAMMING_CEILING = 72;

/** What the scanner needs to know about a printing. */
export type ScanCard = {
  variantNumber: string;
  name: string;
  imageUrl?: string | null;
};

/** The catalog, indexed the one way a frame's evidence points into it. */
export type ScanCatalog<T extends ScanCard> = {
  /**
   * Every printing carrying an image, keyed the same way the reference index is. A
   * match therefore lands on all the printings that share that picture at once.
   */
  byImageKey: ReadonlyMap<string, readonly T[]>;
};

export function buildScanCatalog<T extends ScanCard>(
  items: readonly T[]
): ScanCatalog<T> {
  const byImageKey = new Map<string, T[]>();
  for (const card of items) {
    const key = artIndexKey(card.imageUrl);
    if (!key) continue;
    const bucket = byImageKey.get(key);
    if (bucket) bucket.push(card);
    else byImageKey.set(key, [card]);
  }
  return { byImageKey };
}

/** What one frame's evidence amounts to. Stateless: the caller owns patience. */
export type ScanDecision<T extends ScanCard> =
  | { kind: 'card'; card: T }
  /**
   * One picture, several printings of it. If the same `key` keeps coming back the
   * caller asks which printing it is; no further frame can settle it.
   */
  | { kind: 'hold'; key: string; name: string; options: readonly T[] }
  | null;

/**
 * Turn one frame's ranked image matches into a decision.
 *
 * `matches` must be sorted best first. Because the index holds one entry per distinct
 * picture, any runner-up under a different key really is a different picture, so the
 * margin below compares like with like.
 */
export function decideArtScan<T extends ScanCard>(
  catalog: ScanCatalog<T>,
  matches: readonly ArtMatch[]
): ScanDecision<T> {
  const best = matches[0];
  if (!best || best.score < ART_SCORE_FLOOR || best.hamming > ART_HAMMING_CEILING) {
    return null;
  }

  const options = catalog.byImageKey.get(best.key);
  const first = options?.[0];
  if (!options || !first) return null;

  const rival = matches.find((match) => match.key !== best.key);
  if (rival && best.score - rival.score < ART_SCORE_MARGIN) return null;

  if (options.length === 1) return { kind: 'card', card: first };
  return { kind: 'hold', key: best.key, name: first.name, options };
}
