import type { CardListItem } from '@riftbound/contracts';
import type { MatchKind } from '@/lib/card-scan';
import { getCardPrintings, variantNumbersMatch } from '@/utils/variants';

export type ScanOutcome =
  | { kind: 'card'; card: CardListItem; via: MatchKind; sure: boolean }
  | { kind: 'ambiguous'; name: string; options: CardListItem[] };

type ConfirmationState = {
  pending: ScanOutcome | null;
  saving: boolean;
  error: string | null;
  totalCopies: number;
  justAdded: string | null;
};

export function normalScanInput(card: CardListItem) {
  const printing = getCardPrintings(card).find(
    (item) =>
      !item.isFoil && variantNumbersMatch(item.variantNumber, card.variantNumber)
  );
  if (!printing) {
    throw new Error(
      'This printing has no normal finish. Foil scanning is not supported yet.'
    );
  }
  return { card, variantNumber: printing.variantNumber, isFoil: false };
}

// Synchronous transitions also guard against queued camera results and repeated taps.
export function createScanConfirmation(
  save: (card: CardListItem) => Promise<void>,
  onSettled: (outcome: ScanOutcome) => void
) {
  let state: ConfirmationState = {
    pending: null,
    saving: false,
    error: null,
    totalCopies: 0,
    justAdded: null,
  };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ConfirmationState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    present: (outcome: ScanOutcome) => {
      if (state.pending || state.saving) return;
      update({ pending: outcome, error: null, justAdded: null });
    },
    select: (card: CardListItem) => {
      if (state.saving || state.pending?.kind !== 'ambiguous') return;
      if (!state.pending.options.includes(card)) return;
      update({
        pending: { kind: 'card', card, via: 'name', sure: false },
        error: null,
      });
    },
    confirm: async () => {
      if (state.saving || state.pending?.kind !== 'card') return;
      const outcome = state.pending;
      update({ saving: true, error: null });
      try {
        await save(outcome.card);
      } catch (error) {
        update({
          saving: false,
          error:
            error instanceof Error
              ? error.message
              : 'Could not add this card. Please try again.',
        });
        return;
      }
      onSettled(outcome);
      update({
        pending: null,
        saving: false,
        totalCopies: state.totalCopies + 1,
        justAdded: outcome.card.name,
      });
    },
    reject: () => {
      if (state.saving || !state.pending) return;
      onSettled(state.pending);
      update({ pending: null, error: null });
    },
    clearAdded: () => {
      if (state.justAdded) update({ justAdded: null });
    },
  };
}
