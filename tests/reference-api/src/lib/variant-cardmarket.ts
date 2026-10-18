/** Foil SKUs often omit Cardmarket ids; resolve shared idProduct from the base printing sibling. */
export function baseVariantNumberForCardmarket(variantNumber: string): string | null {
  const trimmed = variantNumber.trim();
  if (!/-Foil$/i.test(trimmed)) return null;
  const base = trimmed.replace(/-Foil$/i, '');
  if (base.length === 0) return null;
  if (base.toLowerCase() === trimmed.toLowerCase()) return null;
  return base;
}

/** Lowercase variant numbers to consult when resolving a Cardmarket product id (most specific first). */
export function cardmarketIdLookupCandidates(variantNumber: string): string[] {
  const trimmed = variantNumber.trim();
  const seen = new Set<string>();
  const ordered: string[] = [];

  const push = (value: string) => {
    const key = value.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) return;
    seen.add(key);
    ordered.push(key);
  };

  push(trimmed);

  const foilBase = baseVariantNumberForCardmarket(trimmed);
  if (foilBase != null) push(foilBase);

  if (/-Release$/i.test(trimmed)) {
    push(trimmed.replace(/-Release$/i, ''));
  }

  if (trimmed.endsWith('*')) {
    push(trimmed.slice(0, -1));
  }

  const altLetter = /^(.+-)(\d+)([a-z])$/i.exec(trimmed);
  if (altLetter) {
    push(`${altLetter[1]}${altLetter[2]}`);
  }

  return ordered;
}

/** Prefer variant's own id, then sibling printings from the lookup map. */
export function resolveCardmarketIdFromMap(
  variantNumber: string,
  byNumber: ReadonlyMap<string, number | null | undefined>
): number | null {
  for (const candidate of cardmarketIdLookupCandidates(variantNumber)) {
    const id = byNumber.get(candidate);
    if (id != null) return id;
  }
  return null;
}
