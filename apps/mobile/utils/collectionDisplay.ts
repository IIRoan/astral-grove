import type { CardCondition, CardListItem } from '@riftbound/contracts';
import { formatConditionLabel, formatLanguageLabel } from '@riftbound/contracts';
import type { CollectionEntry } from '@/services/collectionService';

export function collectionEntryToCardListItem(
  entry: CollectionEntry,
  options?: { isBanned?: boolean }
): CardListItem {
  return {
    cardId: '00000000-0000-0000-0000-000000000000',
    variantNumber: entry.variantNumber,
    name: entry.name,
    type: entry.type ?? 'Unknown',
    energy: 0,
    might: 0,
    power: 0,
    rarity: entry.rarity,
    setCode: entry.setCode,
    colors: [],
    imageUrl: entry.imageUrl,
    cardmarketId: null,
    priceEur: null,
    printings: [
      {
        variantNumber: entry.variantNumber,
        variantLabel: entry.variantLabel,
        isFoil: entry.isFoil,
        priceEur: null,
      },
    ],
    isBanned: options?.isBanned ?? false,
  };
}

export function groupCollectionByVariant(
  entries: CollectionEntry[]
): CollectionEntry[] {
  const map = new Map<string, CollectionEntry>();

  for (const entry of entries) {
    const existing = map.get(entry.variantNumber);
    if (!existing) {
      map.set(entry.variantNumber, { ...entry });
      continue;
    }

    map.set(entry.variantNumber, {
      ...existing,
      quantity: existing.quantity + entry.quantity,
      updatedAt: Math.max(existing.updatedAt, entry.updatedAt),
      addedAt: Math.min(existing.addedAt, entry.addedAt),
    });
  }

  return [...map.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function formatGroupedCollectionMeta(entries: CollectionEntry[]): string {
  const conditions = new Set<string>();
  const languages = new Set<string>();

  for (const entry of entries) {
    if (entry.condition && entry.condition !== 'unspecified') {
      conditions.add(formatConditionLabel(entry.condition as CardCondition));
    }
    if (entry.language) {
      languages.add(formatLanguageLabel(entry.language));
    }
  }

  const parts: string[] = [];
  if (conditions.size === 1) {
    parts.push([...conditions][0]!);
  } else if (conditions.size > 1) {
    parts.push('Mixed conditions');
  }
  if (languages.size === 1) {
    parts.push([...languages][0]!);
  } else if (languages.size > 1) {
    parts.push('Mixed languages');
  }
  return parts.join(' · ');
}

export function buildCollectionByVariant(
  entries: CollectionEntry[]
): Map<string, CollectionEntry> {
  const map = new Map<string, CollectionEntry>();
  for (const entry of entries) {
    const existing = map.get(entry.variantNumber);
    if (!existing) {
      map.set(entry.variantNumber, { ...entry });
      continue;
    }
    map.set(entry.variantNumber, {
      ...existing,
      quantity: existing.quantity + entry.quantity,
    });
  }
  return map;
}
