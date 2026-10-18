import { and, sql, type SQL } from 'drizzle-orm';
import { cards } from '../db/schema.js';

/** Catalog browse: card must include every selected color (may have others). */
export function buildCardColorsContainsAllCondition(requiredColorNames: string[]) {
  const normalized = requiredColorNames.map((name) => name.trim()).filter(Boolean);
  if (normalized.length === 0) return undefined;

  const parts: SQL[] = normalized.map(
    (name) => sql`EXISTS (
      SELECT 1
      FROM card_colors cc
      INNER JOIN colors c ON c.id = cc.color_id
      WHERE cc.card_id = ${cards.id}
        AND lower(c.name) = lower(${name})
    )`
  );

  return parts.length === 1 ? parts[0] : and(...parts);
}

/** Deck domain identity: every card color must be allowed; colorless matches; single-domain matches dual legends. */
export function buildCardColorsWithinCondition(allowedColorNames: string[]) {
  const normalized = allowedColorNames.map((name) => name.trim()).filter(Boolean);
  if (normalized.length === 0) return undefined;

  const allowedList = sql.join(
    normalized.map((name) => sql`lower(${name})`),
    sql`, `
  );

  return sql`NOT EXISTS (
    SELECT 1
    FROM card_colors cc
    INNER JOIN colors c ON c.id = cc.color_id
    WHERE cc.card_id = ${cards.id}
      AND lower(c.name) NOT IN (${allowedList})
  )`;
}
