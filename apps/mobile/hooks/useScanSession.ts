import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildScanCatalog,
  decideScan,
  type CardListItem,
  type ImageMatch,
  type MatchKind,
  type OcrLine,
} from '@riftbound/contracts';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import { useLatestRef } from '@/hooks/useLatestRef';
import { hapticPress } from '@/utils/haptics';

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
/** Consecutive passes with no card in view before it counts as having been taken away. */
const ABSENT_PASSES = 2;

export type ScannedCard = {
  variantNumber: string;
  name: string;
  setCode: string;
  imageUrl: string | null;
  quantity: number;
};

export type { MatchKind };

/**
 * Over half the catalog shares a name with another printing (Fury Rune alone has five),
 * so a name match is only an answer when that name is unique. Otherwise the code is the
 * only thing that can tell the printings apart, and failing that, the user is.
 */
export type ScanOutcome =
  | {
      kind: 'card';
      card: CardListItem;
      via: MatchKind;
      /**
       * Two independent signals agree: the collector code names a real printing, and
       * that printing's artwork is among the nearest matches. The only outcome the
       * scanner will act on without asking.
       */
      sure: boolean;
    }
  | { kind: 'ambiguous'; name: string; options: CardListItem[] };

export function useScanSession({
  onCard,
  autoAdd = false,
}: {
  /** Supplied by lookup mode: consumes the hit instead of asking for confirmation. */
  onCard?: (card: CardListItem) => void;
  /** Accept `sure` outcomes straight away rather than asking about each one. */
  autoAdd?: boolean;
} = {}) {
  const onCardRef = useLatestRef(onCard);
  const catalogIndex = useCatalogIndex();
  const catalogItems = getCatalogIndexItems(catalogIndex.data);

  const catalog = useMemo(() => buildScanCatalog(catalogItems), [catalogItems]);

  const [staged, setStaged] = useState<ScannedCard[]>([]);
  const [pending, setPending] = useState<ScanOutcome | null>(null);

  // Refs, not state: the hot path reads these and must not re-render to do it.
  const suppressed = useRef(new Map<string, number>());
  /** The same undecided answer, frame after frame — a name or an artwork key. */
  const streak = useRef<{ key: string; count: number } | null>(null);
  /**
   * The printing auto-add last took. It is not taken again until the card has left the
   * frame: a timer alone would re-add a card left under the lens every few seconds.
   */
  const autoAdded = useRef<string | null>(null);
  const absentPasses = useRef(0);
  /** Name of the card auto-add just took, while it is still in view — the camera says so. */
  const [justAdded, setJustAdded] = useState<string | null>(null);

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

  const isSuppressed = useCallback((variantNumber: string) => {
    const until = suppressed.current.get(variantNumber);
    if (until && until > Date.now()) return true;
    suppressed.current.delete(variantNumber);
    return false;
  }, []);

  /**
   * Turn one frame's evidence into an outcome. `decideScan` does the judging; this adds
   * what needs memory between frames — patience, and not re-offering an answered card.
   */
  const resolve = useCallback(
    (
      lines: readonly OcrLine[],
      matches: readonly ImageMatch[] = [],
      /** False when only the collector strip was read, so no name could be. */
      wholeCard = true
    ): ScanOutcome | null => {
      if (catalog.byVariantNumber.size === 0) return null;

      const offer = (
        card: CardListItem,
        via: MatchKind,
        sure: boolean
      ): ScanOutcome | null => {
        streak.current = null;
        return isSuppressed(card.variantNumber)
          ? null
          : { kind: 'card', card, via, sure };
      };

      const decision = decideScan(catalog, lines, matches, wholeCard);
      if (!decision) {
        streak.current = null;
        return null;
      }
      if (decision.kind === 'card') {
        return offer(decision.card, decision.via, decision.sure);
      }

      // Undecided. A better frame may still settle it — the collector code coming into
      // focus, usually — so the same answer has to keep coming back before we act on it.
      const [only] = decision.options;
      const alone = decision.options.length === 1;
      const count = streak.current?.key === decision.key ? streak.current.count + 1 : 1;
      streak.current = { key: decision.key, count };
      if (count < (alone ? ART_PATIENCE : AMBIGUOUS_PATIENCE)) return null;
      if (alone && only) return offer(only, 'art', false);

      const selectable = decision.options.filter(
        (card) => !isSuppressed(card.variantNumber)
      );
      if (selectable.length === 0) return null;
      streak.current = null;
      return { kind: 'ambiguous', name: decision.name, options: selectable };
    },
    [catalog, isSuppressed]
  );

  /** Told about every pass, so the session knows when the card has been taken away. */
  const noteCard = useCallback((detected: boolean) => {
    absentPasses.current = detected ? 0 : absentPasses.current + 1;
    if (absentPasses.current < ABSENT_PASSES) return;
    autoAdded.current = null;
    setJustAdded(null);
  }, []);

  /** Surface an outcome: act on it when that is allowed, otherwise ask the user. */
  const present = useCallback(
    (outcome: ScanOutcome) => {
      if (autoAdd && outcome.kind === 'card' && outcome.sure) {
        if (autoAdded.current === outcome.card.variantNumber) return;
        autoAdded.current = outcome.card.variantNumber;
        setJustAdded(outcome.card.name);
        accept(outcome.card);
        return;
      }
      void hapticPress();
      setPending(outcome);
    },
    [accept, autoAdd]
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
    setJustAdded(null);
    autoAdded.current = null;
    suppressed.current.clear();
    streak.current = null;
  }, []);

  const totalCopies = staged.reduce((sum, row) => sum + row.quantity, 0);

  return {
    staged,
    totalCopies,
    pending,
    justAdded,
    ready: catalog.byVariantNumber.size > 0,
    items: catalogItems,
    setCodes: catalog.setCodes,
    resolve,
    noteCard,
    present,
    accept,
    confirmPending,
    rejectPending,
    setQuantity,
    reset,
  };
}

export type ScanSession = ReturnType<typeof useScanSession>;
