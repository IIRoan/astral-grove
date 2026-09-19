import { useEffect, useSyncExternalStore } from 'react';
import type { CardListItem } from '@riftbound/contracts';
import {
  ensureCardArtIndex,
  getCardArtIndexState,
  subscribeCardArtIndex,
} from '@/services/cardArtIndex';

/**
 * Keeps the scanner's artwork index in step with the catalog while the scanner is open.
 * Built on first use rather than at launch: it is a ~25MB download that only someone
 * who actually scans cards should pay for.
 */
export function useCardArtIndex(items: readonly CardListItem[]) {
  useEffect(() => {
    void ensureCardArtIndex(items);
  }, [items]);

  return useSyncExternalStore(subscribeCardArtIndex, getCardArtIndexState);
}
