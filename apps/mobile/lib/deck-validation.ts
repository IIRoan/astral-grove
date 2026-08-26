import type { DeckValidateInput } from '@riftbound/contracts';
import {
  isUnresolvedDeckVariant,
  validateRiftboundDeck as validateRiftboundDeckContract,
} from '@riftbound/contracts';
import type { DeckState, DeckValidationMessage } from '@/lib/deck-types';

function mapToEntries(
  map: Map<string, { card: DeckState['legend']; count: number }>
): DeckValidateInput['mainDeck'] {
  return [...map.values()].map((entry) => ({
    card: entry.card!,
    count: entry.count,
  }));
}

function deckToValidateInput(deck: DeckState): DeckValidateInput {
  return {
    format: deck.format,
    legend: deck.legend,
    champion: deck.champion,
    mainDeck: mapToEntries(deck.mainDeck),
    runes: mapToEntries(deck.runes),
    battlefields: mapToEntries(deck.battlefields),
    sideboard: mapToEntries(deck.sideboard),
  };
}

export function validateDeck(deck: DeckState): DeckValidationMessage[] {
  const messages = validateRiftboundDeckContract(deckToValidateInput(deck));

  const unresolvedCount = countUnresolvedCards(deck);
  if (unresolvedCount > 0) {
    messages.push({
      type: 'warning',
      code: 'unresolved_catalog_cards',
      message: `${unresolvedCount} card${unresolvedCount === 1 ? '' : 's'} could not be loaded from Piltover Archive.`,
    });
  }

  return messages;
}

function countUnresolvedCards(deck: DeckState): number {
  let count = 0;
  const sections = [
    deck.mainDeck,
    deck.runes,
    deck.battlefields,
    deck.sideboard,
  ] as const;
  for (const section of sections) {
    for (const [, entry] of section) {
      if (isUnresolvedDeckVariant(entry.card.variantNumber)) {
        count += entry.count;
      }
    }
  }
  if (deck.champion && isUnresolvedDeckVariant(deck.champion.variantNumber)) count += 1;
  return count;
}

export function ownedCountForCardName(
  name: string,
  collectionByName: ReadonlyMap<string, number>
): number | null {
  if (!collectionByName.size) return null;
  return collectionByName.get(name) ?? 0;
}

export type DeckOwnershipTotals = {
  owned: number;
  required: number;
  missing: number;
};

/** Legend, champion, main, and sideboard copies vs collection. Null when ownership is unknown. */
export function deckOwnershipTotals(
  deck: DeckState,
  collectionByName: ReadonlyMap<string, number>,
  collectionReady = false
): DeckOwnershipTotals | null {
  if (!collectionReady && collectionByName.size === 0) return null;

  let owned = 0;
  let required = 0;
  const add = (name: string, count: number) => {
    required += count;
    const have = collectionReady
      ? (collectionByName.get(name) ?? 0)
      : ownedCountForCardName(name, collectionByName);
    if (have != null) owned += Math.min(have, count);
  };

  if (deck.legend) add(deck.legend.name, 1);
  if (deck.champion) add(deck.champion.name, 1);
  for (const entry of deck.mainDeck.values()) add(entry.card.name, entry.count);
  for (const entry of deck.sideboard.values()) add(entry.card.name, entry.count);

  return { owned, required, missing: Math.max(0, required - owned) };
}

/** Collection-coverage border for deck art; null when ownership unknown or card not in deck. */
export function deckOwnershipBorderClass(
  owned: number | null,
  required: number
): string | null {
  if (owned == null || required <= 0) return null;
  if (owned <= 0) return 'border-ownership-missing';
  if (owned < required) return 'border-ownership-partial';
  return 'border-ownership-complete';
}
