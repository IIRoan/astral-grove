import type { CardListItem } from '@riftbound/contracts';
import { isCardBannedAt, matchesSearchHaystack } from '@riftbound/contracts';
import {
  findVariantByNumber,
  getCardPrintings,
  isFoilVariant,
  pickVariantDisplayPrice,
  toPriceEurSummary,
  variantNumbersMatch,
} from '@/utils/variants';
import {
  fetchRemoteCollection,
  remoteAddToCollection,
  remoteDeleteFromCollection,
  remoteRemoveFromCollection,
  remoteSetCollectionQuantity,
} from '@/services/remoteCollectionService';

export interface CollectionEntry {
  variantNumber: string;
  name: string;
  imageUrl: string;
  setCode: string;
  rarity: string;
  type?: string;
  variantLabel: string;
  isFoil: boolean;
  quantity: number;
  condition?: string;
  language?: string;
  addedAt: number;
  updatedAt: number;
}

function toEntry(
  item: Awaited<ReturnType<typeof fetchRemoteCollection>>[number]
): CollectionEntry {
  return {
    variantNumber: item.variantNumber,
    name: item.name,
    imageUrl: item.imageUrl,
    setCode: item.setCode,
    rarity: item.rarity,
    type: item.type ?? undefined,
    variantLabel: item.variantLabel,
    isFoil: item.isFoil,
    quantity: item.quantity,
    condition: item.condition,
    language: item.language,
    addedAt: new Date(item.addedAt).getTime(),
    updatedAt: new Date(item.updatedAt).getTime(),
  };
}

export async function getCollection(): Promise<CollectionEntry[]> {
  const remote = await fetchRemoteCollection();
  return remote.map(toEntry).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function isInCollection(variantNumber: string): Promise<boolean> {
  const entries = await getCollection();
  return entries.some((e) => e.variantNumber === variantNumber);
}

export async function getCollectionEntry(
  variantNumber: string
): Promise<CollectionEntry | null> {
  const entries = await getCollection();
  return entries.find((e) => e.variantNumber === variantNumber) ?? null;
}

export async function addToCollection(
  card: CardListItem,
  options?: { variantNumber?: string; quantity?: number; isFoil?: boolean }
): Promise<void> {
  const quantity = options?.quantity ?? 1;
  const variantNumber = options?.variantNumber ?? card.variantNumber;
  const printings = getCardPrintings(card);
  const printing =
    (options?.isFoil === undefined
      ? undefined
      : printings.find(
          (p) =>
            variantNumbersMatch(p.variantNumber, variantNumber) &&
            p.isFoil === options.isFoil
        )) ??
    printings.find((p) => variantNumbersMatch(p.variantNumber, variantNumber)) ??
    printings[0];
  if (!printing) {
    throw new Error(`No printing found for ${card.name} (${variantNumber})`);
  }

  await remoteAddToCollection(printing.variantNumber, quantity, printing.isFoil);
}

export async function addDetailToCollection(
  card: {
    name: string;
    type: string;
    banEffectiveDate?: string | null;
    variants: Array<{
      variantNumber: string;
      imageUrl: string;
      rarity: string;
      variantLabel: string;
      variantType: string;
      foilMode?: string;
      prices: Array<{ market: number | null; low: number | null; isFoil: boolean }>;
    }>;
  },
  variantNumber: string,
  quantity = 1,
  isFoil?: boolean
): Promise<void> {
  const variant = findVariantByNumber(card.variants, variantNumber);
  if (!variant) {
    throw new Error(`Variant ${variantNumber} not found on card ${card.name}`);
  }

  const setCode = variant.variantNumber.split('-')[0] ?? '';
  const finish =
    isFoil ??
    isFoilVariant(
      variant.variantNumber,
      variant.variantLabel,
      variant.variantType,
      variant.foilMode
    );
  const displayPrice =
    variant.prices.find((row) => row.isFoil === finish && row.market != null) ??
    pickVariantDisplayPrice(variant.prices, {
      ...variant,
      foilMode: finish ? 'foil_only' : variant.foilMode,
    });
  const priceEur = toPriceEurSummary(displayPrice);

  await addToCollection(
    {
      cardId: '00000000-0000-0000-0000-000000000000',
      variantNumber: variant.variantNumber,
      name: card.name,
      imageUrl: variant.imageUrl,
      setCode,
      rarity: variant.rarity,
      type: card.type,
      energy: 0,
      might: 0,
      power: 0,
      colors: [],
      cardmarketId: null,
      priceEur,
      printings: [
        {
          variantNumber: variant.variantNumber,
          variantLabel: variant.variantLabel,
          isFoil: finish,
          foilMode: variant.foilMode,
          priceEur,
        },
      ],
      isBanned: isCardBannedAt(card.banEffectiveDate),
    },
    {
      variantNumber: variant.variantNumber,
      quantity,
      isFoil: finish,
    }
  );
}

export async function updateCollectionQuantity(
  variantNumber: string,
  quantity: number,
  isFoil?: boolean
): Promise<void> {
  if (quantity <= 0) {
    await remoteDeleteFromCollection(variantNumber, isFoil);
    return;
  }
  await remoteSetCollectionQuantity(variantNumber, quantity, isFoil);
}

export async function adjustCollectionQuantity(
  variantNumber: string,
  delta: number,
  isFoil?: boolean
): Promise<void> {
  if (delta === 0) return;
  if (delta > 0) {
    await remoteAddToCollection(variantNumber, delta, isFoil);
    return;
  }
  await remoteRemoveFromCollection(variantNumber, Math.abs(delta), isFoil);
}

export async function removeFromCollection(
  variantNumber: string,
  isFoil?: boolean
): Promise<void> {
  await remoteDeleteFromCollection(variantNumber, isFoil);
}

export async function removeManyFromCollection(
  variantNumbers: string[]
): Promise<void> {
  if (variantNumbers.length === 0) return;
  await Promise.all(
    variantNumbers.map((variantNumber) => remoteDeleteFromCollection(variantNumber))
  );
}

export async function migrateLocalCollectionToRemote(): Promise<void> {
  // No-op (cloud-only); kept for AuthPanel sign-in compatibility.
}

export function filterCollection(
  entries: CollectionEntry[],
  query: string
): CollectionEntry[] {
  const q = query.trim();
  if (!q) return entries;
  return entries.filter((entry) =>
    matchesSearchHaystack(
      [entry.name, entry.variantNumber, entry.setCode, entry.type ?? ''].join(' '),
      q
    )
  );
}

export function sortCollection(
  entries: CollectionEntry[],
  sortBy: 'recent' | 'name' | 'set'
): CollectionEntry[] {
  const next = [...entries];
  switch (sortBy) {
    case 'name':
      return next.sort((a, b) => a.name.localeCompare(b.name));
    case 'set':
      return next.sort(
        (a, b) => a.setCode.localeCompare(b.setCode) || a.name.localeCompare(b.name)
      );
    default:
      return next.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
