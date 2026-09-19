import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CardListItem } from '@riftbound/contracts';
import {
  buildScanCatalog,
  decideScan,
  type ImageMatch,
  type MatchKind,
  type OcrLine,
} from '@/lib/card-scan';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import { useLatestRef } from '@/hooks/useLatestRef';
import { hapticPress } from '@/utils/haptics';
import { createScanConfirmation, type ScanOutcome } from '@/lib/scan-confirmation';
import { createScanStability } from '@/lib/scan-stability';

/** A card just answered on stays suppressed this long, so it cannot instantly re-fire. */
const SUPPRESS_MS = 2500;
/** Consecutive passes with no card in view before it counts as having been taken away. */
const ABSENT_PASSES = 2;

export type { MatchKind, ScanOutcome };

export function useScanSession({
  onConfirm,
}: {
  onConfirm: (card: CardListItem) => Promise<void>;
}) {
  const onConfirmRef = useLatestRef(onConfirm);
  const catalogIndex = useCatalogIndex();
  const catalogItems = getCatalogIndexItems(catalogIndex.data);

  const catalog = useMemo(() => buildScanCatalog(catalogItems), [catalogItems]);

  const suppressed = useRef(new Map<string, number>());
  const [stability] = useState(() => createScanStability<CardListItem>());
  const absentPasses = useRef(0);
  const [confirmation] = useState(() =>
    createScanConfirmation(
      (card) => onConfirmRef.current(card),
      (outcome) => {
        const cards = outcome.kind === 'card' ? [outcome.card] : outcome.options;
        for (const card of cards) {
          suppressed.current.set(card.variantNumber, Date.now() + SUPPRESS_MS);
        }
        stability.reset();
      }
    )
  );
  const state = useSyncExternalStore(
    confirmation.subscribe,
    confirmation.getSnapshot,
    confirmation.getSnapshot
  );

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
      if (confirmation.getSnapshot().pending || catalog.byVariantNumber.size === 0)
        return null;

      const offer = (
        card: CardListItem,
        via: MatchKind,
        sure: boolean
      ): ScanOutcome | null => {
        return isSuppressed(card.variantNumber)
          ? null
          : { kind: 'card', card, via, sure };
      };

      const decision = stability.record(
        decideScan(catalog, lines, matches, wholeCard),
        Date.now()
      );
      if (!decision) return null;
      if (decision.kind === 'card') {
        return offer(decision.card, decision.via, decision.sure);
      }

      const [only] = decision.options;
      const alone = decision.options.length === 1;
      if (alone && only) return offer(only, 'art', false);

      const selectable = decision.options.filter(
        (card) => !isSuppressed(card.variantNumber)
      );
      if (selectable.length === 0) return null;
      return { kind: 'ambiguous', name: decision.name, options: selectable };
    },
    [catalog, confirmation, isSuppressed, stability]
  );

  const noteCard = useCallback(
    (detected: boolean) => {
      absentPasses.current = detected ? 0 : absentPasses.current + 1;
      if (absentPasses.current >= ABSENT_PASSES) confirmation.clearAdded();
    },
    [confirmation]
  );

  const present = useCallback(
    (outcome: ScanOutcome) => {
      if (confirmation.getSnapshot().pending) return;
      void hapticPress();
      confirmation.present(outcome);
    },
    [confirmation]
  );

  return {
    ...state,
    ready: catalog.byVariantNumber.size > 0,
    items: catalogItems,
    setCodes: catalog.setCodes,
    resolve,
    noteCard,
    present,
    selectPrinting: confirmation.select,
    confirmPending: confirmation.confirm,
    rejectPending: confirmation.reject,
  };
}

export type ScanSession = ReturnType<typeof useScanSession>;
