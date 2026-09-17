import type { DeckState, DeckSectionKey } from '@/lib/deck-types';

export function getSectionCount(deck: DeckState, section: DeckSectionKey): number {
  if (section === 'legend' || section === 'champion') {
    return deck[section] ? 1 : 0;
  }
  let total = 0;
  for (const [, entry] of deck[section]) {
    total += entry.count;
  }
  return total;
}
