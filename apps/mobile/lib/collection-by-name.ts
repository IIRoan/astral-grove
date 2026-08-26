export type CollectionQuantityEntry = {
  name: string;
  quantity: number;
};

export const EMPTY_COLLECTION_BY_NAME: ReadonlyMap<string, number> = new Map();

export function collectionByCardName(
  entries: ReadonlyArray<CollectionQuantityEntry> | undefined
): ReadonlyMap<string, number> {
  if (!entries || entries.length === 0) return EMPTY_COLLECTION_BY_NAME;
  const map = new Map<string, number>();
  for (const entry of entries) {
    map.set(entry.name, (map.get(entry.name) ?? 0) + entry.quantity);
  }
  return map;
}

export function collectionByNameEqual(
  prev: ReadonlyMap<string, number> | undefined,
  next: ReadonlyMap<string, number> | undefined
): boolean {
  if (prev === next) return true;
  if (!prev || !next) return false;
  if (prev.size !== next.size) return false;
  for (const [name, count] of prev) {
    if (next.get(name) !== count) return false;
  }
  return true;
}

export function reuseCollectionByCardName(
  previous: ReadonlyMap<string, number>,
  entries: ReadonlyArray<CollectionQuantityEntry> | undefined
): ReadonlyMap<string, number> {
  const next = collectionByCardName(entries);
  return collectionByNameEqual(previous, next) ? previous : next;
}
