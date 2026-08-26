import { useRef } from 'react';
import { api } from '@/src/api/client';
import {
  EMPTY_COLLECTION_BY_NAME,
  reuseCollectionByCardName,
  type CollectionQuantityEntry,
} from '@/lib/collection-by-name';
import { deckCardFromDetail } from '@/lib/deck-card';
import type { DeckCard } from '@/lib/deck-types';

const cardResolveCache = new Map<string, DeckCard>();

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

  try {
    const detail = await api.getCard(variantNumber);
    const deckCard = deckCardFromDetail(detail.data, variantNumber);
    cardResolveCache.set(deckCard.name, deckCard);
    cardResolveCache.set(deckCard.variantNumber, deckCard);
    return deckCard;
  } catch {
    return null;
  }
}

export function useCollectionByCardName(
  collection: ReadonlyArray<CollectionQuantityEntry> | undefined
): ReadonlyMap<string, number> {
  const previous = useRef(EMPTY_COLLECTION_BY_NAME);
  previous.current = reuseCollectionByCardName(previous.current, collection);
  return previous.current;
}
