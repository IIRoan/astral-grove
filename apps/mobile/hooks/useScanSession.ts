import { useCallback, useMemo, useRef, useState } from 'react';
import {
  nameSimilarity,
  parseScannedCardCode,
  scannedNameCandidates,
  type CardListItem,
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

export type ScannedCard = {
  variantNumber: string;
  name: string;
  setCode: string;
  imageUrl: string | null;
  quantity: number;
};

/** How a card was identified — the confirm screen says so. */
export type MatchKind = 'code' | 'name';

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

  const { byVariantNumber, byName, setCodes } = useMemo(() => {
    const variants = new Map<string, CardListItem>();
    // Every printing, not the first — picking one arbitrarily is the bug this fixes.
    const names = new Map<string, CardListItem[]>();
    const codes = new Set<string>();
    for (const card of catalogItems) {
      variants.set(card.variantNumber.toUpperCase(), card);
      const printings = names.get(card.name);
      if (printings) printings.push(card);
      else names.set(card.name, [card]);
      codes.add(card.setCode.toUpperCase());
    }
    return { byVariantNumber: variants, byName: names, setCodes: [...codes] };
  }, [catalogItems]);

  const [staged, setStaged] = useState<ScannedCard[]>([]);
  const [pending, setPending] = useState<ScanOutcome | null>(null);

  // Refs, not state: the hot path reads these and must not re-render to do it.
  const suppressed = useRef(new Map<string, number>());
  const ambiguousStreak = useRef<{ name: string; count: number } | null>(null);

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
    ambiguousStreak.current = null;
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
    ambiguousStreak.current = null;
    setPending(null);
  }, [pending, settle]);

  /** Closest catalog name to any of the OCR'd readings, if one is close enough. */
  const matchByName = useCallback(
    (lines: readonly OcrLine[]): string | null => {
      let best: { name: string; score: number } | null = null;

      for (const reading of scannedNameCandidates(lines)) {
        for (const name of byName.keys()) {
          const score = nameSimilarity(reading, name);
          if (score >= NAME_MATCH_THRESHOLD && (!best || score > best.score)) {
            best = { name, score };
          }
        }
        if (best?.score === 1) break;
      }

      return best?.name ?? null;
    },
    [byName]
  );

  const isSuppressed = useCallback((variantNumber: string) => {
    const until = suppressed.current.get(variantNumber);
    if (until && until > Date.now()) return true;
    suppressed.current.delete(variantNumber);
    return false;
  }, []);

  /**
   * Turn OCR lines into an outcome, without side effects.
   *
   * The collector code is the only signal that identifies a *printing*, so it wins
   * whenever it is legible. A name narrows things down but, for the 281 names that
   * have more than one printing, it cannot finish the job on its own.
   */
  const resolve = useCallback(
    (lines: readonly OcrLine[]): ScanOutcome | null => {
      if (byVariantNumber.size === 0) return null;

      const code = parseScannedCardCode(lines, setCodes);
      const byCode = code ? byVariantNumber.get(code.toUpperCase()) : undefined;
      if (byCode) {
        ambiguousStreak.current = null;
        if (isSuppressed(byCode.variantNumber)) return null;
        return { kind: 'card', card: byCode, via: 'code' };
      }

      const name = matchByName(lines);
      if (!name) {
        ambiguousStreak.current = null;
        return null;
      }

      const options = byName.get(name) ?? [];
      if (options.length === 1) {
        ambiguousStreak.current = null;
        const only = options[0]!;
        if (isSuppressed(only.variantNumber)) return null;
        return { kind: 'card', card: only, via: 'name' };
      }

      // Ambiguous: give the collector code a few more frames before giving up on it.
      const streak = ambiguousStreak.current;
      const count = streak?.name === name ? streak.count + 1 : 1;
      ambiguousStreak.current = { name, count };
      if (count < AMBIGUOUS_PATIENCE) return null;

      const selectable = options.filter((card) => !isSuppressed(card.variantNumber));
      if (selectable.length === 0) return null;

      ambiguousStreak.current = null;
      return { kind: 'ambiguous', name, options: selectable };
    },
    [byName, byVariantNumber, isSuppressed, matchByName, setCodes]
  );

  /** Surface an outcome: hand a card straight to lookup mode, or ask the user. */
  const present = useCallback(
    (outcome: ScanOutcome) => {
      void hapticPress();
      setPending(outcome);
    },
    []
  );

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
    ambiguousStreak.current = null;
  }, []);

  const totalCopies = staged.reduce((sum, row) => sum + row.quantity, 0);

  return {
    staged,
    totalCopies,
    pending,
    ready: byVariantNumber.size > 0,
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
