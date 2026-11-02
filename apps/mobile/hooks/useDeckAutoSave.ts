import { useEffect } from 'react';
import type { DeckState } from '@/lib/deck-types';
import { flushRemoteDeckSave } from '@/services/deckService';

/** Flush unsaved edits on leave; edits schedule their own saves, so a loaded deck is never written back. */
export function useDeckAutoSave(deck: DeckState | null) {
  const deckId = deck && !deck.readOnly ? deck.id : null;

  useEffect(() => {
    if (!deckId) return;
    return () => {
      void flushRemoteDeckSave(deckId);
    };
  }, [deckId]);
}

export { DECK_AUTO_SAVE_MS } from '@/services/deckService';
