/** Prefer these over chained filter/map and includes()-in-loop. */

/** Map items that pass a predicate in a single pass. */
export function mapFilter<T, U>(
  items: readonly T[],
  predicate: (item: T, index: number) => boolean,
  mapFn: (item: T, index: number) => U
): U[] {
  const out: U[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!;
    if (predicate(item, i)) out.push(mapFn(item, i));
  }
  return out;
}

/** Compact map: drop nullish/false results in one pass. */
export function compactMap<T, U>(
  items: readonly T[],
  mapFn: (item: T, index: number) => U | null | undefined | false
): U[] {
  const out: U[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const mapped = mapFn(items[i]!, i);
    if (mapped != null && mapped !== false) out.push(mapped);
  }
  return out;
}

/** Build a Set once for O(1) membership checks in loops. */
export function toMembershipSet<T>(items: readonly T[] | null | undefined): Set<T> {
  return new Set(items ?? []);
}
