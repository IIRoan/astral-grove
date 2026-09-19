/** Card type may be dual (`Unit Gear`); filters must match tokens or dual-type cards vanish from deck add. */

export function cardTypeTokens(type: string): string[] {
  return type
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function cardHasAnyType(type: string, wanted: readonly string[]): boolean {
  if (wanted.length === 0) return false;
  const tokens = new Set(cardTypeTokens(type));
  return wanted.some((value) => tokens.has(value.trim().toLowerCase()));
}

export function parseCardTypeFilters(typesQuery: string): string[] {
  return typesQuery
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

/** types= match via exact token overlap (mirrors Postgres string_to_array && ARRAY). */
export function cardTypeMatchesFilters(
  type: string,
  filters: readonly string[]
): boolean {
  if (filters.length === 0) return true;
  const normalized = filters.map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return true;
  return cardHasAnyType(type, normalized);
}

/** Legends and Battlefields store energy 0 but have no cost — keep them out of cost sort/filter. */
export const NO_COST_CARD_TYPES = ['legend', 'battlefield'] as const;

export function cardHasCost(type: string): boolean {
  return !cardHasAnyType(type, NO_COST_CARD_TYPES);
}
