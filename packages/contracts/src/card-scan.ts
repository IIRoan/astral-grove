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
 * Every variant number the OCR lines could be naming, best reading first, without
 * repeats. `knownSetCodes` come from the locally cached catalog index, so this works
 * offline. Every ranked reading of every line is tried. With `isKnown`, a reading that
 * parses but names no real card is passed over — the next-ranked reading of the same
 * line is often the right one, and when a misread digit still names a real card, the
 * right reading is often the one just behind it, which is why all of them are kept.
 */
export function parseScannedCardCodes(
  lines: readonly OcrLine[],
  knownSetCodes: readonly string[],
  isKnown: (variantNumber: string) => boolean = () => true
): string[] {
  if (knownSetCodes.length === 0) return [];

  const readings = lines.flatMap((line, index) => {
    const values = [...readingsOf(line)];
    const next = lines[index + 1];
    if (next !== undefined) {
      for (const value of readingsOf(line)) {
        const prefix = value
          .trim()
          .replace(/[•·.-]$/, '')
          .trim();
        if (
          !/^[A-Za-z0-9]{2,4}$/.test(prefix) ||
          !resolveSetCode(prefix, knownSetCodes)
        )
          continue;
        for (const number of readingsOf(next)) {
          if (/^[A-Za-z0-9*]{1,6}\s*\//.test(number.trim()))
            values.push(`${prefix} ${number}`);
        }
      }
    }
    return values;
  });
  // Correct only the numeric field, after trying every unmodified OCR alternative.
  const digits: Record<string, string> = {
    O: '0',
    I: '1',
    l: '1',
    L: '1',
    S: '5',
    B: '8',
    Z: '2',
  };
  const corrected = readings.map((reading) =>
    reading.replace(
      /([A-Za-z0-9]{2,4}[\s•·.-]+)([0-9OIlLSBZ]{1,3})(\s*[a-z*]?\s*\/\s*\d{1,3})/g,
      (_match, prefix: string, number: string, suffix: string) =>
        prefix + [...number].map((char) => digits[char] ?? char).join('') + suffix
    )
  );

  const found: string[] = [];
  for (const reading of [...readings, ...corrected]) {
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
      if (isKnown(variantNumber) && !found.includes(variantNumber))
        found.push(variantNumber);
    }
  }

  return found;
}

/** The best-ranked variant number the OCR lines name, or null when none resolves. */
export function parseScannedCardCode(
  lines: readonly OcrLine[],
  knownSetCodes: readonly string[],
  isKnown?: (variantNumber: string) => boolean
): string | null {
  return parseScannedCardCodes(lines, knownSetCodes, isKnown)[0] ?? null;
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
 * this is and art only picks the printing; weak matches cannot select one.
 * Empty when none of the options' art has enough evidence.
 */
export function narrowByArt<T extends { imageUrl?: string | null }>(
  options: readonly T[],
  matches: readonly ImageMatch[]
): T[] {
  const scores = new Map(
    matches
      .filter((match) => match.score >= IMAGE_MATCH_FLOOR)
      .map((match) => [match.key, match.score])
  );
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

/** How close an OCR'd name must be to a catalog name to be offered at all. */
const NAME_MATCH_THRESHOLD = 0.72;

/** What the scanner needs to know about a printing. */
export type ScanCard = {
  variantNumber: string;
  name: string;
  setCode: string;
  imageUrl?: string | null;
};

/** The catalog, indexed every way a frame's evidence can point into it. */
export type ScanCatalog<T extends ScanCard> = {
  byVariantNumber: ReadonlyMap<string, T>;
  /** Every printing of a name, not the first — picking one arbitrarily adds wrong cards. */
  byName: ReadonlyMap<string, readonly T[]>;
  /**
   * Reprints share artwork (Fury Rune is one picture across four sets), so an image
   * match lands on every printing that carries it.
   */
  byImage: ReadonlyMap<string, readonly T[]>;
  /** Each name with its normalized length, to rule names out before comparing them. */
  nameLengths: readonly (readonly [string, number])[];
  setCodes: readonly string[];
};

export function buildScanCatalog<T extends ScanCard>(
  items: readonly T[]
): ScanCatalog<T> {
  const byVariantNumber = new Map<string, T>();
  const byName = new Map<string, T[]>();
  const byImage = new Map<string, T[]>();
  const setCodes = new Set<string>();

  const file = (map: Map<string, T[]>, key: string, card: T) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(card);
    else map.set(key, [card]);
  };
  for (const card of items) {
    byVariantNumber.set(card.variantNumber.toUpperCase(), card);
    file(byName, card.name, card);
    if (card.imageUrl) file(byImage, card.imageUrl, card);
    setCodes.add(card.setCode.toUpperCase());
  }

  return {
    byVariantNumber,
    byName,
    byImage,
    nameLengths: [...byName.keys()].map(
      (name) => [name, normalizeScannedName(name).length] as const
    ),
    setCodes: [...setCodes],
  };
}

/** Closest catalog name to any of the OCR'd readings, if one is close enough. */
export function matchScannedName(
  lines: readonly OcrLine[],
  nameLengths: ScanCatalog<ScanCard>['nameLengths']
): string | null {
  let best: { name: string; score: number } | null = null;

  const joined: string[] = [];
  for (const [index, line] of lines.entries()) {
    const next = lines[index + 1];
    if (next === undefined) continue;
    for (const first of readingsOf(line).slice(0, 3)) {
      for (const second of readingsOf(next).slice(0, 3)) {
        if (
          first.trim().length >= 3 &&
          second.trim().length >= 3 &&
          first.length + second.length <= 80
        ) {
          joined.push(`${first} ${second}`);
        }
      }
    }
  }
  for (const reading of scannedNameCandidates([...lines, ...joined])) {
    const readLength = normalizeScannedName(reading).length;
    for (const [name, length] of nameLengths) {
      // Lengths this far apart cannot reach the threshold whatever the letters are,
      // which spares an edit distance against every line of rules text.
      const longest = Math.max(readLength, length);
      if (Math.abs(readLength - length) > longest * (1 - NAME_MATCH_THRESHOLD))
        continue;

      const score = nameSimilarity(reading, name);
      if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
        best = { name, score };
      }
    }
    if (best?.score === 1) break;
  }

  return best?.name ?? null;
}

/** The card the confident artwork names, if its number is one edit from `variantNumber`. */
function artNeighbour<T extends ScanCard>(
  catalog: ScanCatalog<T>,
  matches: readonly ImageMatch[],
  variantNumber: string
): T | undefined {
  const art = confidentArt(matches);
  if (!art) return undefined;
  const read = variantNumber.toUpperCase();
  return (catalog.byImage.get(art) ?? []).find(
    (card) => editDistance(card.variantNumber.toUpperCase(), read) === 1
  );
}

/** How a card was identified — the confirm screen says so. */
export type MatchKind = 'code' | 'name' | 'art';

/** What one frame's evidence amounts to. Stateless: the caller owns patience. */
export type ScanDecision<T extends ScanCard> =
  | {
      kind: 'card';
      card: T;
      via: MatchKind;
      /**
       * Two independent signals agree: the collector code names a real printing, and
       * that printing's artwork is among the nearest matches. The only outcome worth
       * acting on without asking.
       */
      sure: boolean;
    }
  /**
   * Narrowed down but not settled. If the same `key` keeps coming back, the caller
   * offers the one option or asks between several — a better frame may still decide.
   */
  | { kind: 'hold'; key: string; name: string; options: readonly T[] }
  | null;

/**
 * Turn one frame's evidence into a decision.
 *
 * Three signals, each good at a different thing. The collector code names a printing
 * outright but is tiny and misreads. The name reads easily but 281 names have more than
 * one printing. The artwork survives glare and blur and tells an alt art from the
 * standard, but cannot tell reprints that share a picture apart. Text decides which
 * card it is; art decides which printing, and stands in when text is missing.
 *
 * `wholeCard` is false when only the collector strip was read, so no name could be.
 */
export function decideScan<T extends ScanCard>(
  catalog: ScanCatalog<T>,
  lines: readonly OcrLine[],
  matches: readonly ImageMatch[] = [],
  wholeCard = true
): ScanDecision<T> {
  const codes = parseScannedCardCodes(lines, catalog.setCodes, (variantNumber) =>
    catalog.byVariantNumber.has(variantNumber.toUpperCase())
  ).map((code) => catalog.byVariantNumber.get(code.toUpperCase())!);
  const name = matchScannedName(lines, catalog.nameLengths);

  // Vision ranks its readings, and a misread digit (019 read as 029) often has the
  // right reading just behind it. When the artwork backs a lower-ranked reading, that
  // is the card; otherwise the best reading stands.
  const byCode =
    codes.find((card) => narrowByArt([card], matches).length > 0) ?? codes[0];

  if (byCode) {
    const artAgrees = narrowByArt([byCode], matches).length > 0;
    const artDisagrees =
      matches.some((match) => match.score >= IMAGE_MATCH_FLOOR) && !artAgrees;
    if (artDisagrees) {
      // A misread digit lands on a neighbouring number. When the artwork is confident
      // of a card one edit away from what was read, the print was misread, not the
      // picture — the other way round takes the name as well, below.
      const neighbour = artNeighbour(catalog, matches, byCode.variantNumber);
      if (neighbour) return { kind: 'card', card: neighbour, via: 'art', sure: false };
      // The name has had no say yet: wait for a whole-card read before going either way.
      if (!wholeCard) return null;
    }
    const nameDisagrees = name !== null && name !== byCode.name;
    if (!(artDisagrees && nameDisagrees)) {
      return { kind: 'card', card: byCode, via: 'code', sure: artAgrees };
    }
  }

  if (name) {
    const printings = catalog.byName.get(name) ?? [];
    if (printings.length === 1) {
      return { kind: 'card', card: printings[0]!, via: 'name', sure: false };
    }

    // Several printings share this name. The alt art is a different picture, so the
    // artwork usually settles it; reprints that share a picture still need the code.
    const narrowed = narrowByArt(printings, matches);
    if (narrowed.length === 1) {
      return { kind: 'card', card: narrowed[0]!, via: 'art', sure: false };
    }
    return {
      kind: 'hold',
      key: name,
      name,
      options: narrowed.length > 0 ? narrowed : printings,
    };
  }

  // Nothing legible at all — glare, blur, a foil. The artwork has to carry it alone.
  const art = confidentArt(matches);
  const sameArt = art ? (catalog.byImage.get(art) ?? []) : [];
  if (!art || sameArt.length === 0) return null;
  return { kind: 'hold', key: art, name: sameArt[0]!.name, options: sameArt };
}
