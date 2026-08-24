import type { CardDetail, CardListItem, DeckFormat } from '@riftbound/contracts';
import {
  cardHasAnyType,
  getDeckRules,
  isUnresolvedDeckVariant,
} from '@riftbound/contracts';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { findVariantByNumber } from '@/utils/variants';
import type {
  DeckCard,
  DeckEntry,
  DeckSectionKey,
  DeckState,
  SerializedDeck,
  SerializedDeckEntry,
} from '@/lib/deck-types';
import { canAddBattlefield } from '@/lib/deck-limits';

const PILTOVER_CDN_HOST = 'cdn.piltoverarchive.com';

function isSignatureVariant(rarity: string, variantType: string): boolean {
  const combined = `${rarity} ${variantType}`.toLowerCase();
  return combined.includes('signature');
}

export function deckCardFromDetail(card: CardDetail, variantNumber: string): DeckCard {
  const variant = findVariantByNumber(card.variants, variantNumber) ?? card.variants[0];
  const setCode = variant.variantNumber.split('-')[0] ?? '';

  return {
    cardId: card.id,
    variantNumber: variant.variantNumber,
    name: card.name,
    type: card.type,
    super: card.super,
    tags: card.tags,
    colors: card.colors.map((color) => color.name),
    energy: card.energy,
    power: card.power,
    setCode,
    rarity: variant.rarity,
    variantType: variant.variantType,
    isSignature: isSignatureVariant(variant.rarity, variant.variantType),
    imageUrl: variant.imageUrl ?? null,
    banEffectiveDate: card.banEffectiveDate ?? null,
  };
}

/** Placeholder deck card from catalog list data before detail loads. */
export function deckCardFromListItem(card: CardListItem): DeckCard {
  return {
    cardId: card.cardId,
    variantNumber: card.variantNumber,
    name: card.name,
    type: card.type,
    super: null,
    tags: [],
    colors: card.colors,
    energy: card.energy,
    power: card.power,
    setCode: card.setCode,
    rarity: card.rarity,
    variantType: 'Standard',
    isSignature: isSignatureVariant(card.rarity, ''),
    imageUrl: card.imageUrl ?? null,
    banEffectiveDate: card.isBanned ? '1970-01-01T00:00:00.000Z' : null,
  };
}

export function getDeckVariantNumbers(deck: DeckState): string[] {
  const numbers: string[] = [];
  if (deck.legend) numbers.push(deck.legend.variantNumber);
  if (deck.champion) numbers.push(deck.champion.variantNumber);
  for (const section of ['mainDeck', 'runes', 'battlefields', 'sideboard'] as const) {
    for (const [, entry] of deck[section]) {
      numbers.push(entry.card.variantNumber);
    }
  }
  return numbers;
}

/** Stable cache key for deck card image queries — only changes when variant set changes. */
export function deckVariantNumbersKey(deck: DeckState): string {
  return [...new Set(getDeckVariantNumbers(deck))].sort().join('|');
}

function resolveDeckFallbackImageUrl(url: string): string {
  try {
    if (new URL(url).hostname === PILTOVER_CDN_HOST) return url;
  } catch {
    // Non-absolute paths still go through the configured API resolver.
  }

  return resolveImageUrl(url);
}

export function resolveDeckCardImageUrl(
  card: DeckCard,
  imageByVariant: ReadonlyMap<string, string>
): string {
  const fetched = imageByVariant.get(card.variantNumber);
  if (fetched) return resolveImageUrl(fetched);
  return card.imageUrl ? resolveDeckFallbackImageUrl(card.imageUrl) : '';
}

/** Whitespace-delimited type tokens — dual types like "Unit Gear" are two tokens. */
export function cardHasType(
  card: Pick<DeckCard, 'type'>,
  ...wanted: string[]
): boolean {
  return cardHasAnyType(card.type, wanted);
}

export function sectionForCardType(
  card: Pick<DeckCard, 'type' | 'super'>
): DeckSectionKey {
  const supertype = (card.super ?? '').toLowerCase();
  if (cardHasType(card, 'legend')) return 'legend';
  if (cardHasType(card, 'battlefield')) return 'battlefields';
  if (cardHasType(card, 'rune')) return 'runes';
  if (supertype === 'champion') return 'champion';
  return 'mainDeck';
}

export function isLegendCard(card: Pick<DeckCard, 'type'>): boolean {
  return cardHasType(card, 'legend');
}

export function isChampionUnit(card: Pick<DeckCard, 'type' | 'super'>): boolean {
  return cardHasType(card, 'unit') && (card.super ?? '').toLowerCase() === 'champion';
}

export function cardMatchesSectionType(
  card: Pick<DeckCard, 'type' | 'super'>,
  section: DeckSectionKey
): boolean {
  return sectionForCardType(card) === section;
}

export function createDeckId(): string {
  return `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyDeck(
  name = 'New Deck',
  description = '',
  format: DeckFormat = 'constructed'
): DeckState {
  const now = Date.now();
  return {
    id: createDeckId(),
    name,
    description,
    format,
    createdAt: now,
    updatedAt: now,
    legend: null,
    champion: null,
    mainDeck: new Map(),
    runes: new Map(),
    battlefields: new Map(),
    sideboard: new Map(),
    addToSideboard: false,
  };
}

/** Deep-clone an owned deck with a new id and without upstream/browse metadata. */
export function cloneDeck(
  deck: DeckState,
  options?: { name?: string; format?: DeckFormat }
): DeckState {
  const now = Date.now();
  const cloned = deserializeDeck({
    ...serializeDeck(deck),
    id: createDeckId(),
    name: options?.name ?? `${deck.name} (copy)`,
    format: options?.format ?? deck.format,
    createdAt: now,
    updatedAt: now,
    upstreamId: undefined,
    syncWarnings: undefined,
    source: undefined,
    readOnly: undefined,
    authorName: undefined,
    views: undefined,
    likes: undefined,
    isLegal: undefined,
    setPrefixes: undefined,
    hasGuide: undefined,
    hasVideo: undefined,
    hasMatchups: undefined,
    videoUrl: undefined,
    bannedCardNames: undefined,
  });
  return cloned;
}

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

export function addCardToDeck(
  deck: DeckState,
  card: DeckCard,
  options?: { section?: DeckSectionKey; count?: number }
): DeckState {
  const count = options?.count ?? 1;
  const targetSection = options?.section ?? resolveAddSection(deck, card);
  const updatedAt = Date.now();

  if (targetSection === 'legend') {
    return { ...deck, legend: card, updatedAt };
  }
  if (targetSection === 'champion') {
    return { ...deck, champion: card, updatedAt };
  }

  if (targetSection === 'battlefields') {
    if (!canAddBattlefield(deck, card.name)) {
      return deck;
    }
  }

  const map = new Map(deck[targetSection]);
  const existing = map.get(card.name);
  if (existing) {
    // Same name can have multiple arts — keep the printing the user just added.
    const nextCard =
      existing.card.variantNumber === card.variantNumber ? existing.card : card;
    map.set(card.name, { card: nextCard, count: existing.count + count });
  } else {
    map.set(card.name, { card, count });
  }

  return { ...deck, [targetSection]: map, updatedAt };
}

function resolveAddSection(deck: DeckState, card: DeckCard): DeckSectionKey {
  const inferred = sectionForCardType(card);
  if (inferred !== 'mainDeck') return inferred;
  const sideboardMax = getDeckRules(deck.format).sections.sideboard.target;
  if (deck.addToSideboard && getSectionCount(deck, 'sideboard') < sideboardMax) {
    return 'sideboard';
  }
  return 'mainDeck';
}

export function changeDeckCardQty(
  deck: DeckState,
  section: Exclude<DeckSectionKey, 'legend' | 'champion'>,
  name: string,
  delta: number
): DeckState {
  const map = new Map(deck[section]);
  const entry = map.get(name);
  if (!entry) return deck;

  const nextCount = entry.count + delta;
  if (nextCount <= 0) {
    map.delete(name);
  } else {
    map.set(name, { ...entry, count: nextCount });
  }

  return { ...deck, [section]: map, updatedAt: Date.now() };
}

export function removeDeckCard(
  deck: DeckState,
  section: DeckSectionKey,
  name?: string
): DeckState {
  if (section === 'legend') {
    return { ...deck, legend: null, updatedAt: Date.now() };
  }
  if (section === 'champion') {
    return { ...deck, champion: null, updatedAt: Date.now() };
  }
  if (!name) return deck;
  const map = new Map(deck[section]);
  map.delete(name);
  return { ...deck, [section]: map, updatedAt: Date.now() };
}

export function serializeDeck(deck: DeckState): SerializedDeck {
  const toEntries = (map: Map<string, DeckEntry>): SerializedDeckEntry[] =>
    [...map.values()].map((entry) => ({ card: entry.card, count: entry.count }));

  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    format: deck.format,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    legend: deck.legend,
    champion: deck.champion,
    mainDeck: toEntries(deck.mainDeck),
    runes: toEntries(deck.runes),
    battlefields: toEntries(deck.battlefields),
    sideboard: toEntries(deck.sideboard),
    upstreamId: deck.upstreamId,
    syncWarnings: deck.syncWarnings,
    source: deck.source,
    readOnly: deck.readOnly,
    authorName: deck.authorName,
    views: deck.views,
    likes: deck.likes,
    isLegal: deck.isLegal,
    setPrefixes: deck.setPrefixes,
    hasGuide: deck.hasGuide,
    hasVideo: deck.hasVideo,
    hasMatchups: deck.hasMatchups,
    videoUrl: deck.videoUrl,
    bannedCardNames: deck.bannedCardNames,
  };
}

export function deserializeDeck(data: SerializedDeck): DeckState {
  const toMap = (entries: SerializedDeckEntry[]): Map<string, DeckEntry> => {
    const map = new Map<string, DeckEntry>();
    for (const entry of entries) {
      const key = isUnresolvedDeckVariant(entry.card.variantNumber)
        ? entry.card.variantNumber
        : entry.card.name;
      map.set(key, entry);
    }
    return map;
  };

  return {
    id: data.id,
    name: data.name,
    description: data.description ?? '',
    format: data.format ?? 'constructed',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    legend: data.legend,
    champion: data.champion,
    mainDeck: toMap(data.mainDeck),
    runes: toMap(data.runes),
    battlefields: toMap(data.battlefields),
    sideboard: toMap(data.sideboard),
    addToSideboard: false,
    upstreamId: data.upstreamId,
    source: data.source,
    readOnly: data.readOnly,
    syncWarnings: data.syncWarnings,
    authorName: data.authorName,
    views: data.views,
    likes: data.likes,
    isLegal: data.isLegal,
    setPrefixes: data.setPrefixes,
    hasGuide: data.hasGuide,
    hasVideo: data.hasVideo,
    hasMatchups: data.hasMatchups,
    videoUrl: data.videoUrl,
    bannedCardNames: data.bannedCardNames,
  };
}
