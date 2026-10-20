import { fetchCardDetailsByVariant } from '@/lib/batchCardsIndex';
import { collectIllegalCardNames } from '@/lib/card-legality';
import { getDeckVariantNumbers } from '@/lib/deck-card';
import type { DeckCard, DeckEntry, DeckState } from '@/lib/deck-types';

export async function fetchBanDatesByVariant(
  variantNumbers: string[]
): Promise<Map<string, string | null>> {
  const banByVariant = new Map<string, string | null>();
  const unique = [...new Set(variantNumbers.filter(Boolean))];
  if (unique.length === 0) return banByVariant;

  const detailsByVariant = await fetchCardDetailsByVariant(unique);
  for (const variantNumber of unique) {
    const card = detailsByVariant.get(variantNumber);
    if (card) banByVariant.set(variantNumber, card.banEffectiveDate ?? null);
  }

  return banByVariant;
}

function applyBanDate(
  card: DeckCard,
  banByVariant: ReadonlyMap<string, string | null>
): DeckCard {
  const fresh = banByVariant.get(card.variantNumber);
  if (fresh === undefined) return card;
  return { ...card, banEffectiveDate: fresh };
}

function mapSection(
  map: Map<string, DeckEntry>,
  banByVariant: ReadonlyMap<string, string | null>
): Map<string, DeckEntry> {
  const next = new Map(map);
  for (const [key, entry] of next) {
    next.set(key, { ...entry, card: applyBanDate(entry.card, banByVariant) });
  }
  return next;
}

export function mergeBanDatesIntoDeck(
  deck: DeckState,
  banByVariant: ReadonlyMap<string, string | null>
): DeckState {
  return {
    ...deck,
    legend: deck.legend ? applyBanDate(deck.legend, banByVariant) : null,
    champion: deck.champion ? applyBanDate(deck.champion, banByVariant) : null,
    mainDeck: mapSection(deck.mainDeck, banByVariant),
    runes: mapSection(deck.runes, banByVariant),
    battlefields: mapSection(deck.battlefields, banByVariant),
    sideboard: mapSection(deck.sideboard, banByVariant),
  };
}

export function syncDeckLegalityFields(deck: DeckState): DeckState {
  const illegalNames = collectIllegalCardNames(deck);
  if (illegalNames.length === 0) {
    return {
      ...deck,
      bannedCardNames: undefined,
      isLegal: deck.readOnly ? deck.isLegal : true,
    };
  }

  return {
    ...deck,
    isLegal: false,
    bannedCardNames: illegalNames,
  };
}

// Deck list rows can sit in cache for days — refresh ban dates from catalog on open.
export async function refreshDeckLegality(deck: DeckState): Promise<DeckState> {
  const banByVariant = await fetchBanDatesByVariant(getDeckVariantNumbers(deck));
  return syncDeckLegalityFields(mergeBanDatesIntoDeck(deck, banByVariant));
}
