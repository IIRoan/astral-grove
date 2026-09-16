/**
 * Parses what a camera OCR pass saw on a physical card.
 *
 * Printed collector-code layouts across sets:
 *
 *   OGN • 179/298        → OGN-179
 *   VEN • 150/166 • EN   → VEN-150
 *   ARC-001/006          → ARC-001
 *   OGN • 166b/298       → OGN-166b   (alt art / promo)
 *
 * The trailing `/<set total>` is what makes the match unambiguous against rules text.
 *
 * Input is a list of *lines*, each of which may carry several ranked readings — Apple
 * Vision returns ranked candidates per observation, and for small print the correct
 * reading is often not the top one. A plain string is accepted as a one-candidate line.
 */

/** A recognized line: either the text, or Vision's ranked readings for it, best first. */
export type OcrLine = string | readonly string[];

/** `SET` sep `NUMBER` optional-letter `/` `TOTAL`. The separator is often eaten by OCR. */
const PRINTED_CODE =
  /([A-Za-z0-9]{2,4})\s*[-•·.*]?\s*(\d{1,3})\s*([A-Za-z])?\s*\/\s*\d{1,3}/g;

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
 * Every ranked reading of every line is tried before giving up.
 */
export function parseScannedCardCode(
  lines: readonly OcrLine[],
  knownSetCodes: readonly string[]
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
        const padded = match[2]!.padStart(3, '0');
        const suffix = match[3] ? match[3].toLowerCase() : '';

        return `${setCode}-${padded}${suffix}`;
      }
    }
  }

  return null;
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
