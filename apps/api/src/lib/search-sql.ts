import { and, asc, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { CardsListQuery } from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { cards, sets, variants } from '../db/schema.js';
import {
  buildCardColorsContainsAllCondition,
  buildCardColorsWithinCondition,
} from './card-colors-filter.js';
import { buildCardTypesCondition } from './card-types-filter.js';
import {
  buildCardSearchCondition,
  buildSearchRelevanceOrder,
  buildTypeIntentCondition,
} from './search.js';

export const SEARCH_CANDIDATE_COLUMNS = {
  cardId: cards.id,
  name: cards.name,
  type: cards.type,
  super: cards.super,
  energy: cards.energy,
  might: cards.might,
  power: cards.power,
  banEffectiveDate: cards.banEffectiveDate,
  variantId: variants.id,
  variantNumber: variants.variantNumber,
  rarity: variants.rarity,
  variantType: variants.variantType,
  foilMode: variants.foilMode,
  variantLabel: variants.variantLabel,
  imageUrl: variants.imageUrl,
  cardmarketId: variants.cardmarketId,
  tcgplayerId: variants.tcgplayerId,
  setCode: sets.code,
} as const;

export function shouldMaterializeThenPage(query: CardsListQuery): boolean {
  const hasSearch = Boolean(query.q?.trim());
  const hasDeckBuilderFilters = Boolean(
    query.types ||
    query.colors ||
    query.sets ||
    query.super ||
    query.variants ||
    query.rarities ||
    query.excludeTokens
  );
  return hasSearch || hasDeckBuilderFilters || query.sortBy === 'price';
}

export function buildSearchFilterConditions(query: CardsListQuery): SQL[] {
  const conditions: SQL[] = [];

  if (query.q) {
    const searchCond = buildCardSearchCondition(query.q);
    if (searchCond) conditions.push(searchCond);
  }
  if (query.sets) {
    const setCodes = query.sets.split(',').map((s) => s.trim());
    conditions.push(inArray(sets.code, setCodes));
  }
  if (query.energyMin !== undefined) {
    conditions.push(sql`${cards.energy} >= ${query.energyMin}`);
  }
  if (query.energyMax !== undefined) {
    conditions.push(sql`${cards.energy} <= ${query.energyMax}`);
  }
  if (query.powerMin !== undefined) {
    conditions.push(sql`${cards.power} >= ${query.powerMin}`);
  }
  if (query.powerMax !== undefined) {
    conditions.push(sql`${cards.power} <= ${query.powerMax}`);
  }
  if (query.mightMin !== undefined) {
    conditions.push(sql`${cards.might} >= ${query.mightMin}`);
  }
  if (query.mightMax !== undefined) {
    conditions.push(sql`${cards.might} <= ${query.mightMax}`);
  }
  if (query.rarities) {
    const rarityFilters = query.rarities
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (rarityFilters.length > 0) {
      conditions.push(inArray(variants.rarity, rarityFilters));
    }
  }
  if (query.variants) {
    const variantFilters = query.variants
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (variantFilters.length > 0) {
      conditions.push(
        sql`lower(${variants.variantType}) in (${sql.join(
          variantFilters.map((value) => sql`${value}`),
          sql`, `
        )})`
      );
    }
  }
  if (query.types) {
    const typeCond = buildCardTypesCondition(query.types.split(','));
    if (typeCond) conditions.push(typeCond);
  }
  if (query.super) {
    const superFilters = query.super
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (superFilters.length === 1) {
      conditions.push(sql`lower(${cards.super}) = ${superFilters[0]}`);
    } else if (superFilters.length > 1) {
      conditions.push(
        sql`lower(${cards.super}) in (${sql.join(
          superFilters.map((value) => sql`${value}`),
          sql`, `
        )})`
      );
    }
  }
  if (query.colors) {
    const colorNames = query.colors.split(',').map((value) => value.trim());
    const colorCond =
      query.colorMode === 'within'
        ? buildCardColorsWithinCondition(colorNames)
        : buildCardColorsContainsAllCondition(colorNames);
    if (colorCond) conditions.push(colorCond);
  }
  if (query.excludeTokens) {
    conditions.push(sql`${variants.variantNumber} !~* '-T[0-9]+$'`);
  }

  return conditions;
}

export function buildSearchWhere(query: CardsListQuery): SQL | undefined {
  const conditions = buildSearchFilterConditions(query);
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function buildSearchFilterWhere(query: CardsListQuery): SQL | undefined {
  return buildSearchWhere({ ...query, q: '' });
}

export function buildSearchTypeIntentWhere(query: CardsListQuery): SQL | undefined {
  const q = query.q?.trim();
  if (!q) return undefined;
  return buildTypeIntentCondition(q);
}

export function buildCandidateOrderBy(query: CardsListQuery): SQL[] {
  if (query.q && query.q.trim().length > 0) {
    return [asc(buildSearchRelevanceOrder(query.q)), asc(cards.name)];
  }
  if (query.sortBy === 'energy') {
    return [
      query.dir === 'desc' ? desc(cards.energy) : asc(cards.energy),
      asc(cards.name),
    ];
  }
  if (query.sortBy === 'variantNumber') {
    return [
      query.dir === 'desc' ? desc(variants.variantNumber) : asc(variants.variantNumber),
    ];
  }
  return [query.dir === 'desc' ? desc(cards.name) : asc(cards.name)];
}

export function buildSearchCandidateQuery(db: Database, query: CardsListQuery) {
  const where = buildSearchWhere(query);
  const orderBy = buildCandidateOrderBy(query);
  return db
    .select(SEARCH_CANDIDATE_COLUMNS)
    .from(variants)
    .innerJoin(cards, eq(variants.cardId, cards.id))
    .innerJoin(sets, eq(variants.setId, sets.id))
    .where(where)
    .orderBy(...orderBy);
}

export function buildSearchCandidateQueryUnsorted(
  db: Database,
  where: SQL | undefined
) {
  return db
    .select(SEARCH_CANDIDATE_COLUMNS)
    .from(variants)
    .innerJoin(cards, eq(variants.cardId, cards.id))
    .innerJoin(sets, eq(variants.setId, sets.id))
    .where(where);
}
