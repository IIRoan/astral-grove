import { getDeckRules } from '@riftbound/contracts';
import { getSectionCount } from '@/lib/deck-counts';
import type { DeckState } from '@/lib/deck-types';

export const BATTLEFIELD_MAX = 3;

export function battlefieldCount(deck: DeckState): number {
  return getSectionCount(deck, 'battlefields');
}

export function battlefieldsAtCapacity(deck: DeckState): boolean {
  return battlefieldCount(deck) >= BATTLEFIELD_MAX;
}

export function battlefieldPerNameLimit(deck: DeckState): number {
  return getDeckRules(deck.format).copyLimits.battlefieldPerName;
}

export function canAddBattlefield(deck: DeckState, candidateName: string): boolean {
  if (battlefieldsAtCapacity(deck)) return false;
  const existing = deck.battlefields.get(candidateName)?.count ?? 0;
  if (existing <= 0) return true;
  return existing < battlefieldPerNameLimit(deck);
}
