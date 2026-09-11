import {
  getCodeFromDeck,
  getDeckFromCode,
  type Card as DeckCodeCard,
  type DecodeOptions,
  type DeckWithSideboard,
} from '@piltoverarchive/riftbound-deck-codes';
import { addCardToDeck, createEmptyDeck, sectionForCardType } from '@/lib/deck-card';
import { mapPool } from '@/lib/asyncPool';
import type { DeckCard, DeckState } from '@/lib/deck-types';

export type VariantResolver = (
  variantNumber: string
) => Promise<DeckCard | null> | DeckCard | null;

/** Base32 alphabet used by Piltover Archive deck codes (no padding). */
const DECK_CODE_CHAR = /^[A-Z2-7]+$/i;

/** Minimum plausible encoded length (tiny v3 decks still clear this). */
const MIN_DECK_CODE_LENGTH = 16;

/**
 * PA encoder card codes are `SET-NUMBERvariant` (variant is a/b/s/* or empty).
 * Showcase SKUs like `OGN-197b-Nexus` or `OGN-001-Foil` must collapse to that shape.
 */
const DECK_CODE_CARD = /^([A-Za-z]+)-((?:R|SP)?\d+)([a-z*]?)$/i;

export function toDeckCodeCardCode(variantNumber: string): string {
  const trimmed = variantNumber.trim();
  if (DECK_CODE_CARD.test(trimmed)) return trimmed;

  let current = trimmed;
  while (current.includes('-')) {
    const next = current.replace(/-[^-]+$/, '');
    if (next === current) break;
    if (DECK_CODE_CARD.test(next)) return next;
    current = next;
  }
  return trimmed;
}

function mergeCount(
  counts: Map<string, number>,
  cardCode: string,
  count: number
): void {
  const encoded = toDeckCodeCardCode(cardCode);
  counts.set(encoded, (counts.get(encoded) ?? 0) + count);
}

function countsToDeck(counts: Map<string, number>): DeckCodeCard[] {
  return [...counts.entries()].map(([cardCode, count]) => ({ cardCode, count }));
}

/** Flatten to PA encoder shape: legend/champion/main/runes/battlefields in `mainDeck`; `chosenChampion` is champion VN. */
export function deckStateToCodePayload(deck: DeckState): {
  mainDeck: DeckCodeCard[];
  sideboard: DeckCodeCard[];
  chosenChampion?: string;
} {
  const mainCounts = new Map<string, number>();

  if (deck.legend) {
    mergeCount(mainCounts, deck.legend.variantNumber, 1);
  }
  if (deck.champion) {
    mergeCount(mainCounts, deck.champion.variantNumber, 1);
  }
  for (const [, entry] of deck.mainDeck) {
    mergeCount(mainCounts, entry.card.variantNumber, entry.count);
  }
  for (const [, entry] of deck.runes) {
    mergeCount(mainCounts, entry.card.variantNumber, entry.count);
  }
  for (const [, entry] of deck.battlefields) {
    mergeCount(mainCounts, entry.card.variantNumber, entry.count);
  }

  const sideCounts = new Map<string, number>();
  for (const [, entry] of deck.sideboard) {
    mergeCount(sideCounts, entry.card.variantNumber, entry.count);
  }

  const chosenChampion = deck.champion
    ? toDeckCodeCardCode(deck.champion.variantNumber)
    : undefined;
  return {
    mainDeck: countsToDeck(mainCounts),
    sideboard: countsToDeck(sideCounts),
    ...(chosenChampion ? { chosenChampion } : {}),
  };
}

/** Encode an Astral Grove deck as a Piltover Archive deck code (1:1 with upstream). */
export function exportDeckCode(deck: DeckState): string {
  const payload = deckStateToCodePayload(deck);
  return getCodeFromDeck(payload.mainDeck, payload.sideboard, payload.chosenChampion);
}

/** Heuristic: looks like a Riftbound deck code (base32, no whitespace) — not a decode guarantee. */
export function looksLikeDeckCode(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < MIN_DECK_CODE_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;
  return DECK_CODE_CHAR.test(trimmed);
}

export function decodeDeckCode(
  code: string,
  options?: DecodeOptions
): DeckWithSideboard {
  return getDeckFromCode(code.trim(), options);
}

/** Route decoded codes into sections; with `chosenChampion`, one copy goes to the champion slot. */
export async function deckFromCodePayload(
  decoded: DeckWithSideboard,
  resolveCard: VariantResolver
): Promise<{ deck: DeckState; unresolved: string[] }> {
  let deck = createEmptyDeck();
  const unresolved: string[] = [];
  const chosen = decoded.chosenChampion;

  const entries = [
    ...decoded.mainDeck.map((entry) => ({ ...entry, forceSideboard: false as const })),
    ...decoded.sideboard.map((entry) => ({ ...entry, forceSideboard: true as const })),
  ];

  const uniqueCodes = [...new Set(entries.map((entry) => entry.cardCode))];
  const resolvedCards = await mapPool(uniqueCodes, 6, async (cardCode) =>
    Promise.resolve(resolveCard(cardCode))
  );
  const cardByCode = new Map(
    uniqueCodes.map((cardCode, index) => [cardCode, resolvedCards[index] ?? null])
  );

  const place = (cardCode: string, count: number, forceSideboard: boolean) => {
    let remaining = count;
    const card = cardByCode.get(cardCode) ?? null;
    if (!card) {
      unresolved.push(cardCode);
      return;
    }

    if (!forceSideboard && chosen && cardCode === chosen && !deck.champion) {
      deck = { ...deck, champion: card };
      remaining -= 1;
    }

    if (remaining <= 0) return;

    if (forceSideboard) {
      deck = addCardToDeck(deck, card, { section: 'sideboard', count: remaining });
      return;
    }

    const section = sectionForCardType(card);
    if (section === 'legend') {
      deck = { ...deck, legend: card };
      if (remaining > 1) {
        deck = addCardToDeck(deck, card, { section: 'mainDeck', count: remaining - 1 });
      }
      return;
    }
    if (section === 'champion') {
      // Extra champion-unit copies beyond the chosen slot live in the main deck.
      deck = addCardToDeck(deck, card, { section: 'mainDeck', count: remaining });
      return;
    }
    deck = addCardToDeck(deck, card, { section, count: remaining });
  };

  // Placement stays sequential — deck state mutates per entry (legend/champion slots).
  for (const entry of entries) {
    place(entry.cardCode, entry.count, entry.forceSideboard);
  }

  return { deck, unresolved };
}

export async function importDeckCode(
  code: string,
  resolveCard: VariantResolver,
  options?: DecodeOptions
): Promise<{ deck: DeckState; unresolved: string[] }> {
  const decoded = decodeDeckCode(code, options);
  return deckFromCodePayload(decoded, resolveCard);
}

/** Stable sort for comparing encoded decks in tests (order is not significant). */
export function sortCodeCards(cards: DeckCodeCard[]): DeckCodeCard[] {
  return [...cards].sort((a, b) => {
    if (a.cardCode !== b.cardCode) return a.cardCode.localeCompare(b.cardCode);
    return a.count - b.count;
  });
}
