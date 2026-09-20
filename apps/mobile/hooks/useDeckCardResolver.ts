import { useRef } from 'react';
import type { CardDetail } from '@riftbound/contracts';
import { api } from '@/src/api/client';
import {
  EMPTY_COLLECTION_BY_NAME,
  reuseCollectionByCardName,
  type CollectionQuantityEntry,
} from '@/lib/collection-by-name';
import { deckCardFromDetail } from '@/lib/deck-card';
import { deckCodeCardBase } from '@/lib/deck-codes';
import type { DeckCard } from '@/lib/deck-types';

const cardResolveCache = new Map<string, DeckCard>();

async function fetchCardDetail(variantNumber: string): Promise<CardDetail | null> {
  try {
    const detail = await api.getCard(variantNumber);
    return detail.data;
  } catch {
    return null;
  }
}

export async function resolveDeckCardByName(name: string): Promise<DeckCard | null> {
  const cached = cardResolveCache.get(name);
  if (cached) return cached;

  const response = await api.listCards({ q: name, limit: 20, page: 1 });
  const exact =
    response.data.find((card) => card.name === name) ??
    response.data.find((card) => card.name.replace(' - ', ', ') === name);

  if (!exact) return null;

  const detail = await api.getCard(exact.variantNumber);
  const deckCard = deckCardFromDetail(detail.data, exact.variantNumber);
  cardResolveCache.set(deckCard.name, deckCard);
  cardResolveCache.set(deckCard.variantNumber, deckCard);
  return deckCard;
}

/** Resolve a deck card by Piltover Archive card code / variant number. */
export async function resolveDeckCardByVariant(
  variantNumber: string
): Promise<DeckCard | null> {
  const cached = cardResolveCache.get(variantNumber);
  if (cached) return cached;

  let resolvedCode = variantNumber;
  let detail = await fetchCardDetail(variantNumber);
  if (!detail) {
    // Deck codes can name a printing the catalog lacks (e.g. signature legend
    // `OGN-305s`); retry with the base code so the identity slots still fill.
    const base = deckCodeCardBase(variantNumber);
    if (base !== variantNumber) {
      detail = await fetchCardDetail(base);
      resolvedCode = base;
    }
  }
  if (!detail) return null;

  const deckCard = deckCardFromDetail(detail, resolvedCode);
  cardResolveCache.set(deckCard.name, deckCard);
  cardResolveCache.set(deckCard.variantNumber, deckCard);
  cardResolveCache.set(variantNumber, deckCard);
  return deckCard;
}

export function useCollectionByCardName(
  collection: ReadonlyArray<CollectionQuantityEntry> | undefined
): ReadonlyMap<string, number> {
  const previous = useRef(EMPTY_COLLECTION_BY_NAME);
  previous.current = reuseCollectionByCardName(previous.current, collection);
  return previous.current;
}
