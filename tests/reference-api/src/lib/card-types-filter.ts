import { sql } from 'drizzle-orm';
import { parseCardTypeFilters } from '@riftbound/contracts';
import { cards } from '../db/schema.js';

/** Dual types ("Unit Gear") match whitespace tokens; keep aligned with contracts cardTypeMatchesFilters. */
export function buildCardTypesCondition(typeFilters: string[]) {
  const normalized = parseCardTypeFilters(typeFilters.join(','));
  if (normalized.length === 0) return undefined;

  const filterArray = sql.join(
    normalized.map((value) => sql`${value}`),
    sql`, `
  );

  // Token overlap — not `type IN (...)` — so "Unit Gear" matches Unit and Gear.
  return sql`string_to_array(lower(trim(${cards.type})), ' ') && ARRAY[${filterArray}]::text[]`;
}
