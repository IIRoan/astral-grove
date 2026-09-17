/**
 * Parses what a camera OCR pass saw on a physical card.
 *
 * Printed collector-code layouts across sets:
 *
 *   OGN • 179/298        → OGN-179
 *   VEN • 150/166 • EN   → VEN-150
 *   ARC-001/006          → ARC-001
 *   OGN • 166b/298       → OGN-166b   (alt art / promo)
 *   SFD • 227*\/221       → SFD-227*   (signed overnumbered; `\/` is a plain slash)
 *   VEN • SP1/006 • EN   → VEN-SP1    (a lettered series)
 *
 * Tokens print no total at all (`UNL • T01`), so they are left to the name and artwork.
 *
 * The trailing `/<set total>` is what makes the match unambiguous against rules text.
 *
 * Input is a list of *lines*, each of which may carry several ranked readings — Apple
 * Vision returns ranked candidates per observation, and for small print the correct
 * reading is often not the top one. A plain string is accepted as a one-candidate line.
 */

/** A recognized line: either the text, or Vision's ranked readings for it, best first. */
export type OcrLine = string | readonly string[];

/**
 * `SET` sep `NUMBER` optional-suffix `/` `TOTAL`. The separator is often eaten by OCR.
 * The number may carry a letter series (`SP1`) and the suffix may be a star. Letters in
 * the number are also what a misread digit looks like (`I79`), which is why callers
 * pass `isKnown`: only a code that names a real card is believed.
 */
const PRINTED_CODE =
  /([A-Za-z0-9]{2,4})\s*[-•·.*]?\s*([A-Za-z]{0,2})(\d{1,3})\s*([A-Za-z*])?\s*\/\s*\d{1,3}/g;

/**
 * OCR reads these glyphs as digits inside an otherwise-alphabetic set prefix. Only the
 * digit→letter direction is corrected: undoing a letter inside the number is ambiguous
 * against the alt-art suffix (`166b`), and ranked candidates cover that case better.
 */
const TO_LETTER: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '5': 'S',
  '8': 'B',
  '2': 'Z',
};

function readingsOf(line: OcrLine): readonly string[] {
  return typeof line === 'string' ? [line] : line;
}

function toLetters(value: string): string {
  return value
    .toUpperCase()
    .split('')
    .map((char) => TO_LETTER[char] ?? char)
    .join('');
}

/** Full Levenshtein. Inputs here are card names and set codes, so they stay short. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** Lowercased, letters and digits only — OCR punctuation is noise for name matching. */
export function normalizeScannedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** 0–1, where 1 is identical. Used to decide whether an OCR'd name is trustworthy. */
export function nameSimilarity(a: string, b: string): number {
  const left = normalizeScannedName(a);
  const right = normalizeScannedName(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = editDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

/**
 * Resolve an OCR'd set prefix against the sets we actually have. Exact match wins;
 * otherwise a single edit is allowed, but only when exactly one set is that close —
 * two equally-near candidates means we guessed, and a wrong card is worse than none.
 */
function resolveSetCode(raw: string, knownSetCodes: readonly string[]): string | null {
  const candidate = toLetters(raw);
  const known = knownSetCodes.map((code) => code.toUpperCase());

  if (known.includes(candidate)) return candidate;

  const near = known.filter((code) => editDistance(candidate, code) === 1);
  return near.length === 1 ? near[0]! : null;
}

/**
 * Pull a variant number out of OCR lines, or null when nothing resolves confidently.
 * `knownSetCodes` come from the locally cached catalog index, so this works offline.
 * Every ranked reading of every line is tried before giving up. With `isKnown`, a
 * reading that parses but names no real card is passed over — the next-ranked reading
 * of the same line is often the right one.
 */
export function parseScannedCardCode(
  lines: readonly OcrLine[],
  knownSetCodes: readonly string[],
  isKnown: (variantNumber: string) => boolean = () => true
): string | null {
  if (knownSetCodes.length === 0) return null;

  for (const line of lines) {
    for (const reading of readingsOf(line)) {
      PRINTED_CODE.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = PRINTED_CODE.exec(reading)) !== null) {
        const setCode = resolveSetCode(match[1]!, knownSetCodes);
        if (!setCode) continue;

        // The card prints `179`; the database stores `OGN-179` but `OGN-001` for card 1.
        // A lettered series is stored exactly as printed: `SP1`.
        const series = match[2]!.toUpperCase();
        const number = series ? match[3]! : match[3]!.padStart(3, '0');
        const suffix = match[4] ? match[4].toLowerCase() : '';

        const variantNumber = `${setCode}-${series}${number}${suffix}`;
        if (isKnown(variantNumber)) return variantNumber;
      }
    }
  }

  return null;
}

/**
 * A catalog image the card in frame resembles, as ranked by the on-device artwork
 * lookup. `key` is the catalog `imageUrl`; `score` is cosine similarity, 1 = identical.
 */
export type ImageMatch = { key: string; score: number };

/**
 * Below this the nearest catalog image is only the least different one, not a match.
 * A starting point, not a measurement: tune it against the live scores the scanner's
 * dev overlay prints on real cards.
 */
export const IMAGE_MATCH_FLOOR = 0.8;
/** Runners-up this close to the best score count as a tie rather than a loss. */
export const IMAGE_TIE_MARGIN = 0.03;

/**
 * The printings among `options` that the artwork supports: those carrying the
 * best-scoring art, plus any whose art ties with it. Text has already said which card
 * this is and art only picks the printing, so this is rank-based and needs no absolute
 * threshold. Empty when none of the options' art is among the matches.
 */
export function narrowByArt<T extends { imageUrl?: string | null }>(
  options: readonly T[],
  matches: readonly ImageMatch[]
): T[] {
  const scores = new Map(matches.map((match) => [match.key, match.score]));
  const scoreOf = (option: T) =>
    (option.imageUrl ? scores.get(option.imageUrl) : undefined) ?? -Infinity;

  const best = Math.max(-Infinity, ...options.map(scoreOf));
  if (best === -Infinity) return [];
  return options.filter((option) => scoreOf(option) >= best - IMAGE_TIE_MARGIN);
}

/**
 * The one image worth trusting with no text to back it up: a strong best match with
 * nothing close behind it. `matches` must be sorted best first.
 */
export function confidentArt(matches: readonly ImageMatch[]): string | null {
  const [best, next] = matches;
  if (!best || best.score < IMAGE_MATCH_FLOOR) return null;
  if (next && best.score - next.score < IMAGE_TIE_MARGIN) return null;
  return best.key;
}

/**
 * Best-guess card name from an OCR pass. The name is the largest text on the card and
 * reads far more reliably than the collector code, so it carries identification while
 * the code only pins down which printing — the approach the established scanners take.
 *
 * Returns the top reading of each plausible line, longest first, for a caller to match
 * against the catalog.
 */
export function scannedNameCandidates(lines: readonly OcrLine[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const line of lines) {
    for (const reading of readingsOf(line)) {
      const trimmed = reading.trim();
      if (trimmed.length < 3) continue;

      // Mostly-alphabetic: filters out the collector line, stats and copyright chrome.
      const letters = trimmed.replace(/[^A-Za-z]/g, '').length;
      if (letters / trimmed.length < 0.7) continue;

      const key = normalizeScannedName(trimmed);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(trimmed);
    }
  }

  return names.sort((a, b) => b.length - a.length);
}
