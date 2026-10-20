import {
  getDeckRules,
  isCardBannedAt,
  isCardNameInBannedList,
  sideboardMaximum,
} from '@riftbound/contracts';
import type { DeckCard, DeckState } from '@/lib/deck-types';

export function isCardTournamentIllegal(
  card: Pick<DeckCard, 'name' | 'banEffectiveDate'>,
  deck?: Pick<DeckState, 'bannedCardNames'>
): boolean {
  if (isCardBannedAt(card.banEffectiveDate ?? null)) return true;
  return isCardNameInBannedList(card.name, deck?.bannedCardNames);
}

export function isCardBannedInDeck(
  deck: DeckState,
  cardName: string,
  card?: Pick<DeckCard, 'name' | 'banEffectiveDate'>
): boolean {
  if (card) {
    return isCardTournamentIllegal(card, deck);
  }
  return isCardTournamentIllegal({ name: cardName, banEffectiveDate: null }, deck);
}

function collectDeckCards(deck: DeckState): DeckCard[] {
  const cards: DeckCard[] = [];
  if (deck.legend) cards.push(deck.legend);
  if (deck.champion) cards.push(deck.champion);
  // An uncapped sideboard is the Pre-Rift card pool, which the validator doesn't ban-check.
  const sideboardIsPool = sideboardMaximum(getDeckRules(deck.format)) == null;
  const sections = ['mainDeck', 'runes', 'battlefields', 'sideboard'] as const;
  for (const section of sections.filter(
    (key) => key !== 'sideboard' || !sideboardIsPool
  )) {
    for (const [, entry] of deck[section]) {
      cards.push(entry.card);
    }
  }
  return cards;
}

export function collectIllegalCardNames(deck: DeckState): string[] {
  const names = new Set<string>();
  for (const card of collectDeckCards(deck)) {
    if (isCardTournamentIllegal(card, deck)) {
      names.add(card.name);
    }
  }
  return [...names];
}

export function deckHasBannedCards(deck: DeckState): boolean {
  if (deck.bannedCardNames?.length) return true;
  return collectIllegalCardNames(deck).length > 0;
}
