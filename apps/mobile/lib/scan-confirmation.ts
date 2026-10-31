import type { CardListItem, CardListPrinting } from '@riftbound/contracts';
import type { MatchKind } from '@/lib/card-scan';
import type { CollectionOwnershipMap } from '@/utils/collectionOwnership';
import type { PrintingPickerOption } from '@/utils/collectionPrintingPicker';
import {
  resolvePrintingPickerState,
  resolveQuickAddPrintings,
  resolveQuickAddSelection,
} from '@/utils/collectionPrintingPicker';
import { formatPrintingLabel, ownedQuantityForPrinting } from '@/utils/variants';

export type ScanOutcome =
  | { kind: 'card'; card: CardListItem; via: MatchKind; sure: boolean }
  | { kind: 'ambiguous'; name: string; options: CardListItem[] };

export type ScanAddInput = {
  card: CardListItem;
  variantNumber: string;
  isFoil: boolean;
};

type ConfirmationState = {
  pending: ScanOutcome | null;
  saving: boolean;
  error: string | null;
  totalCopies: number;
  justAdded: string | null;
};

export function scanPrintings(card: CardListItem) {
  return resolveQuickAddPrintings(card, card.variantNumber);
}

export function scanOwnedLine(
  printings: readonly CardListPrinting[],
  collectionByVariant: CollectionOwnershipMap
): string {
  const rows = printings.map((printing) => ({
    label: formatPrintingLabel(
      printing.variantLabel,
      printing.isFoil,
      printing.variantNumber
    ),
    quantity: ownedQuantityForPrinting(collectionByVariant, printing),
  }));
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (total === 0) return 'Not in your collection yet';
  if (rows.length === 1) return `You own ${total.toLocaleString()}`;
  return `You own ${rows.map((row) => `${row.quantity.toLocaleString()} ${row.label}`).join(' · ')}`;
}

export function scanFinishOptions(
  card: CardListItem,
  simpleAdd: boolean
): PrintingPickerOption[] | null {
  const state = resolvePrintingPickerState({
    printings: scanPrintings(card),
    simpleAdd,
  });
  return state.showAddPicker ? state.addOptions : null;
}

// Quick add picks non-foil when both exist, otherwise the only finish.
export function scanAddInput(
  card: CardListItem,
  options: { simpleAdd: boolean; selectionId?: string }
): ScanAddInput {
  const selection = resolveQuickAddSelection(
    scanPrintings(card),
    options.simpleAdd ? undefined : options.selectionId
  );
  if (!selection) throw new Error(`No printing found for ${card.name}`);
  return { card, variantNumber: selection.variantNumber, isFoil: selection.isFoil };
}

// Synchronous transitions also guard against queued camera results and repeated taps.
export function createScanConfirmation(
  save: (card: CardListItem, selectionId?: string) => Promise<void>,
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
    confirm: async (selectionId?: string) => {
      if (state.saving || state.pending?.kind !== 'card') return;
      const outcome = state.pending;
      update({ saving: true, error: null });
      try {
        if (selectionId === undefined) await save(outcome.card);
        else await save(outcome.card, selectionId);
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
