import { getDeckRules, sideboardMaximum } from '@riftbound/contracts';
import { totalRuneCount } from '@/lib/deck-builder';
import { getSectionCount } from '@/lib/deck-card';
import { deckSectionProgress } from '@/lib/deck-display';
import type { DeckState } from '@/lib/deck-types';

export function deckBuilderHeadlineStats(deck: DeckState): string {
  const formatLabel = deck.format === 'pre-rift' ? 'Pre-Rift' : 'Constructed';
  const main = deckSectionProgress(deck, 'mainDeck');
  const runes = totalRuneCount(deck.runes);
  const fields = getSectionCount(deck, 'battlefields');
  const side = getSectionCount(deck, 'sideboard');
  const sideMax = sideboardMaximum(getDeckRules(deck.format));
  return `${formatLabel} · Main ${main.current}/${main.target} · Runes ${runes}/12 · Fields ${fields}/3 · Side ${side}${sideMax == null ? '' : `/${String(sideMax)}`}`;
}
