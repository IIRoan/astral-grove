import { useSyncExternalStore } from 'react';
import {
  getDeckSaveStatus,
  subscribeDeckSaveStatus,
  type DeckSaveStatus,
} from '@/services/deckService';

const IDLE: DeckSaveStatus = { state: 'idle', updatedAt: null };

export function useDeckSaveStatus(
  deckId: string | undefined,
  versionId: string | undefined
): DeckSaveStatus {
  return useSyncExternalStore(
    subscribeDeckSaveStatus,
    () => (deckId ? getDeckSaveStatus(deckId, versionId) : IDLE),
    () => IDLE
  );
}
