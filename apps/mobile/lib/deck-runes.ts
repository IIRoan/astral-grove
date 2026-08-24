import { runeNameForDomain } from '@riftbound/contracts';
import { getLegendRuneDomains } from '@/lib/deck-builder';
import { addCardToDeck, changeDeckCardQty, removeDeckCard } from '@/lib/deck-card';
import type { DeckCard, DeckState } from '@/lib/deck-types';

export const DEFAULT_RUNE_SPLIT = 6;

export function findRuneEntryForDomain(
  runes: ReadonlyMap<
    string,
    DeckState['runes'] extends Map<string, infer E> ? E : never
  >,
  domain: string
) {
  for (const [, entry] of runes) {
    if (entry.card.colors.includes(domain)) {
      return entry;
    }
  }
  return null;
}

export function adjustRuneCountForDomain(
  deck: DeckState,
  domain: string,
  delta: number,
  runeCard?: DeckCard | null
): DeckState {
  const preferredName = runeNameForDomain(domain);
  const existing =
    deck.runes.get(preferredName) ?? findRuneEntryForDomain(deck.runes, domain);

  if (delta > 0) {
    if (existing) {
      return changeDeckCardQty(deck, 'runes', existing.card.name, delta);
    }
    if (!runeCard) return deck;
    return addCardToDeck(deck, runeCard, { section: 'runes', count: delta });
  }

  if (!existing) return deck;
  if (existing.count + delta <= 0) {
    return removeDeckCard(deck, 'runes', existing.card.name);
  }
  return changeDeckCardQty(deck, 'runes', existing.card.name, delta);
}

/** Seed a 6/6 rune split (or 12 single-domain) when a legend is first chosen. */
export function seedDefaultRuneSplit(
  deck: DeckState,
  runeCardsByDomain: ReadonlyMap<string, DeckCard>,
  splitPerDomain = DEFAULT_RUNE_SPLIT
): DeckState {
  if (!deck.legend || deck.runes.size > 0 || runeCardsByDomain.size === 0) {
    return deck;
  }

  const [firstDomain, secondDomain] = getLegendRuneDomains(deck.legend);
  const firstCard = runeCardsByDomain.get(firstDomain);
  if (!firstCard) return deck;

  let next = deck;
  if (firstDomain === secondDomain) {
    return addCardToDeck(next, firstCard, {
      section: 'runes',
      count: splitPerDomain * 2,
    });
  }

  const secondCard = runeCardsByDomain.get(secondDomain);
  next = addCardToDeck(next, firstCard, { section: 'runes', count: splitPerDomain });
  if (secondCard) {
    next = addCardToDeck(next, secondCard, { section: 'runes', count: splitPerDomain });
  }
  return next;
}
