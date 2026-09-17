import { useCallback, useMemo, useRef, useState } from 'react';
import {
  confidentArt,
  nameSimilarity,
  narrowByArt,
  normalizeScannedName,
  parseScannedCardCode,
  scannedNameCandidates,
  type CardListItem,
  type ImageMatch,
  type OcrLine,
} from '@riftbound/contracts';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import { useLatestRef } from '@/hooks/useLatestRef';
import { hapticPress } from '@/utils/haptics';

/** How close an OCR'd name must be to a catalog name to be offered at all. */
const NAME_MATCH_THRESHOLD = 0.72;
/** A card just answered on stays suppressed this long, so it cannot instantly re-fire. */
const SUPPRESS_MS = 2500;
/**
 * How many consecutive name-only reads before we stop waiting for the collector code
 * and just ask which printing it is. Roughly a second and a half of scanning.
 */
const AMBIGUOUS_PATIENCE = 6;
/**
 * How many consecutive frames the artwork alone has to agree with itself before it is
 * offered. Nothing legible backs it up, so one lucky frame is not enough.
 */
const ART_PATIENCE = 3;

export type ScannedCard = {
  variantNumber: string;
  name: string;
  setCode: string;
  imageUrl: string | null;
  quantity: number;
};

/** How a card was identified — the confirm screen says so. */
export type MatchKind = 'code' | 'name' | 'art';

/**
 * Over half the catalog shares a name with another printing (Fury Rune alone has five),
 * so a name match is only an answer when that name is unique. Otherwise the code is the
 * only thing that can tell the printings apart, and failing that, the user is.
 */
export type ScanOutcome =
  | { kind: 'card'; card: CardListItem; via: MatchKind }
  | { kind: 'ambiguous'; name: string; options: CardListItem[] };

export function useScanSession({
  onCard,
}: {
  /** Supplied by lookup mode: consumes the hit instead of asking for confirmation. */
  onCard?: (card: CardListItem) => void;
} = {}) {
  const onCardRef = useLatestRef(onCard);
  const catalogIndex = useCatalogIndex();
  const catalogItems = getCatalogIndexItems(catalogIndex.data);

  const { byVariantNumber, byName, byImage, nameLengths, setCodes } = useMemo(() => {
    const variants = new Map<string, CardListItem>();
    // Every printing, not the first — picking one arbitrarily is the bug this fixes.
    const names = new Map<string, CardListItem[]>();
    // Reprints share artwork (Fury Rune is one picture across four sets), so an image
    // match lands on every printing that carries it.
    const images = new Map<string, CardListItem[]>();
    const codes = new Set<string>();
    for (const card of catalogItems) {
      variants.set(card.variantNumber.toUpperCase(), card);
      const printings = names.get(card.name);
      if (printings) printings.push(card);
      else names.set(card.name, [card]);
      if (card.imageUrl) {
        const sameArt = images.get(card.imageUrl);
        if (sameArt) sameArt.push(card);
        else images.set(card.imageUrl, [card]);
      }
      codes.add(card.setCode.toUpperCase());
    }
    return {
      byVariantNumber: variants,
      byName: names,
      byImage: images,
      nameLengths: [...names.keys()].map(
        (name) => [name, normalizeScannedName(name).length] as const
      ),
      setCodes: [...codes],
    };
  }, [catalogItems]);

  const [staged, setStaged] = useState<ScannedCard[]>([]);
  const [pending, setPending] = useState<ScanOutcome | null>(null);

  // Refs, not state: the hot path reads these and must not re-render to do it.
  const suppressed = useRef(new Map<string, number>());
  /** The same undecided answer, frame after frame — a name or an artwork key. */
  const streak = useRef<{ key: string; count: number } | null>(null);

  const stage = useCallback((card: CardListItem) => {
    setStaged((prev) => {
      const index = prev.findIndex((row) => row.variantNumber === card.variantNumber);
      if (index >= 0) {
        const next = [...prev];
        next[index] = { ...next[index]!, quantity: next[index]!.quantity + 1 };
        return next;
      }
      return [
        {
          variantNumber: card.variantNumber,
          name: card.name,
          setCode: card.setCode,
          imageUrl: card.imageUrl ?? null,
          quantity: 1,
        },
        ...prev,
      ];
    });
  }, []);

  /** Answering suppresses the card briefly — it is still in front of the lens. */
  const settle = useCallback((card: CardListItem) => {
    suppressed.current.set(card.variantNumber, Date.now() + SUPPRESS_MS);
    streak.current = null;
    setPending(null);
  }, []);

  /** Confirm the single card the scanner offered, or the printing the user picked. */
  const accept = useCallback(
    (card: CardListItem) => {
      void hapticPress();
      if (onCardRef.current) {
        onCardRef.current(card);
        settle(card);
        return;
      }
      stage(card);
      settle(card);
    },
    [onCardRef, settle, stage]
  );

  const confirmPending = useCallback(() => {
    if (pending?.kind !== 'card') return;
    accept(pending.card);
  }, [accept, pending]);

  const rejectPending = useCallback(() => {
    if (!pending) return;
    void hapticPress();
    if (pending.kind === 'card') {
      settle(pending.card);
      return;
    }
    // Rejecting a printing question suppresses every option, so the same
    // unreadable card does not immediately ask again.
    const until = Date.now() + SUPPRESS_MS;
    for (const option of pending.options) {
      suppressed.current.set(option.variantNumber, until);
    }
    streak.current = null;
    setPending(null);
  }, [pending, settle]);

  /** Closest catalog name to any of the OCR'd readings, if one is close enough. */
  const matchByName = useCallback(
    (lines: readonly OcrLine[]): string | null => {
      let best: { name: string; score: number } | null = null;

      for (const reading of scannedNameCandidates(lines)) {
        const readLength = normalizeScannedName(reading).length;
        for (const [name, length] of nameLengths) {
          // Lengths this far apart cannot reach the threshold whatever the letters
          // are, which spares an edit distance against every line of rules text.
          const longest = Math.max(readLength, length);
          if (Math.abs(readLength - length) > longest * (1 - NAME_MATCH_THRESHOLD)) {
            continue;
          }
          const score = nameSimilarity(reading, name);
          if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
            best = { name, score };
          }
        }
        if (best?.score === 1) break;
      }

      return best?.name ?? null;
    },
    [nameLengths]
  );

  const isSuppressed = useCallback((variantNumber: string) => {
    const until = suppressed.current.get(variantNumber);
    if (until && until > Date.now()) return true;
    suppressed.current.delete(variantNumber);
    return false;
  }, []);

  /**
   * Turn one frame's evidence into an outcome, without side effects.
   *
   * Three signals, each good at a different thing. The collector code names a printing
   * outright but is tiny and misreads. The name reads easily but 281 names have more
   * than one printing. The artwork survives glare and blur and tells an alt art from
   * the standard, but cannot tell reprints that share a picture apart. Text decides
   * which card it is; art decides which printing, and stands in when text is missing.
   */
  const resolve = useCallback(
    (
      lines: readonly OcrLine[],
      matches: readonly ImageMatch[] = []
    ): ScanOutcome | null => {
      if (byVariantNumber.size === 0) return null;

      const offer = (card: CardListItem, via: MatchKind): ScanOutcome | null => {
        streak.current = null;
        return isSuppressed(card.variantNumber) ? null : { kind: 'card', card, via };
      };
      /** True once the same undecided answer has come back `patience` frames running. */
      const held = (key: string, patience: number) => {
        const count = streak.current?.key === key ? streak.current.count + 1 : 1;
        streak.current = { key, count };
        return count >= patience;
      };
      const ask = (name: string, options: CardListItem[]): ScanOutcome | null => {
        const selectable = options.filter((card) => !isSuppressed(card.variantNumber));
        if (selectable.length === 0) return null;
        streak.current = null;
        return { kind: 'ambiguous', name, options: selectable };
      };

      const code = parseScannedCardCode(lines, setCodes, (variantNumber) =>
        byVariantNumber.has(variantNumber.toUpperCase())
      );
      const byCode = code ? byVariantNumber.get(code.toUpperCase()) : undefined;
      const name = matchByName(lines);

      if (byCode) {
        // A misread digit still lands on a real card, so the code can be overruled —
        // but only when the artwork and the name both say it is a different card.
        const artDisagrees =
          matches.length > 0 && narrowByArt([byCode], matches).length === 0;
        const nameDisagrees = name !== null && name !== byCode.name;
        if (!(artDisagrees && nameDisagrees)) return offer(byCode, 'code');
      }

      if (name) {
        const printings = byName.get(name) ?? [];
        if (printings.length === 1) return offer(printings[0]!, 'name');

        // Several printings share this name. The alt art is a different picture, so the
        // artwork usually settles it; reprints that share a picture still need the code.
        const narrowed = narrowByArt(printings, matches);
        if (narrowed.length === 1) return offer(narrowed[0]!, 'art');

        // Give the collector code a few more frames before giving up on it.
        if (!held(name, AMBIGUOUS_PATIENCE)) return null;
        return ask(name, narrowed.length > 0 ? narrowed : printings);
      }

      // Nothing legible at all — glare, blur, a foil. The artwork has to carry it alone.
      const art = confidentArt(matches);
      const sameArt = art ? (byImage.get(art) ?? []) : [];
      if (!art || sameArt.length === 0) {
        streak.current = null;
        return null;
      }
      if (!held(art, sameArt.length === 1 ? ART_PATIENCE : AMBIGUOUS_PATIENCE))
        return null;
      return sameArt.length === 1
        ? offer(sameArt[0]!, 'art')
        : ask(sameArt[0]!.name, sameArt);
    },
    [byImage, byName, byVariantNumber, isSuppressed, matchByName, setCodes]
  );

  /** Surface an outcome: hand a card straight to lookup mode, or ask the user. */
  const present = useCallback((outcome: ScanOutcome) => {
    void hapticPress();
    setPending(outcome);
  }, []);

  const setQuantity = useCallback((variantNumber: string, quantity: number) => {
    setStaged((prev) =>
      quantity <= 0
        ? prev.filter((row) => row.variantNumber !== variantNumber)
        : prev.map((row) =>
            row.variantNumber === variantNumber ? { ...row, quantity } : row
          )
    );
  }, []);

  const reset = useCallback(() => {
    setStaged([]);
    setPending(null);
    suppressed.current.clear();
    streak.current = null;
  }, []);

  const totalCopies = staged.reduce((sum, row) => sum + row.quantity, 0);

  return {
    staged,
    totalCopies,
    pending,
    ready: byVariantNumber.size > 0,
    items: catalogItems,
    setCodes,
    resolve,
    present,
    accept,
    confirmPending,
    rejectPending,
    setQuantity,
    reset,
  };
}

export type ScanSession = ReturnType<typeof useScanSession>;
