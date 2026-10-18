import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { CardsListQuery } from '@riftbound/contracts';
import {
  SEARCH_CANDIDATE_COLUMNS,
  SEARCH_SLIM_CANDIDATE_COLUMNS,
  buildSearchWhere,
  canSqlPageCandidates,
  isPureSqlCandidateOrder,
  shouldMaterializeThenPage,
} from '../../src/lib/search-sql.js';

function baseQuery(overrides: Partial<CardsListQuery> = {}): CardsListQuery {
  return {
    page: 1,
    limit: 20,
    sortBy: 'name',
    dir: 'asc',
    colorMode: 'all',
    ...overrides,
  };
}

describe('search candidate materialization', () => {
  test('slim columns are a strict subset of hydrate columns', () => {
    const slim = Object.keys(SEARCH_SLIM_CANDIDATE_COLUMNS);
    const full = Object.keys(SEARCH_CANDIDATE_COLUMNS);
    expect(slim).toHaveLength(11);
    expect(full).toHaveLength(18);
    expect(slim.every((key) => full.includes(key))).toBe(true);
    expect(full).toContain('imageUrl');
    expect(slim).not.toContain('imageUrl');
    expect(full).toContain('setCode');
    expect(slim).not.toContain('setCode');
  });

  test('browse without filters pages in SQL', () => {
    const query = baseQuery();
    expect(shouldMaterializeThenPage(query)).toBe(false);
    expect(canSqlPageCandidates(query)).toBe(true);
    expect(isPureSqlCandidateOrder(query)).toBe(true);
  });

  test('text search and price sort stay on the grouped materialize path', () => {
    expect(canSqlPageCandidates(baseQuery({ q: 'jinx' }))).toBe(false);
    expect(isPureSqlCandidateOrder(baseQuery({ q: 'jinx' }))).toBe(false);
    expect(canSqlPageCandidates(baseQuery({ sortBy: 'price' }))).toBe(false);
    expect(isPureSqlCandidateOrder(baseQuery({ sortBy: 'price' }))).toBe(false);
  });

  test('deck-builder filters group in memory even when order is SQL-native', () => {
    const query = baseQuery({ types: 'Unit', sortBy: 'energy' });
    expect(shouldMaterializeThenPage(query)).toBe(true);
    expect(canSqlPageCandidates(query)).toBe(false);
    expect(isPureSqlCandidateOrder(query)).toBe(true);
  });
});

describe('cost sort and energy filter', () => {
  const dialect = new PgDialect();
  const compile = (query: CardsListQuery) => {
    const where = buildSearchWhere(query);
    return where ? dialect.sqlToQuery(where) : undefined;
  };
  const excludesNoCost = (query: CardsListQuery) => {
    const compiled = compile(query);
    return Boolean(
      compiled?.sql.includes('not (') &&
      compiled.params.includes('legend') &&
      compiled.params.includes('battlefield')
    );
  };

  test('cost sort drops Legends and Battlefields', () => {
    expect(excludesNoCost(baseQuery({ sortBy: 'energy', dir: 'asc' }))).toBe(true);
    expect(excludesNoCost(baseQuery({ sortBy: 'energy', dir: 'desc' }))).toBe(true);
  });

  test('energy filter drops Legends and Battlefields', () => {
    expect(excludesNoCost(baseQuery({ energyMin: 0, energyMax: 0 }))).toBe(true);
  });

  test('other sorts keep Legends and Battlefields', () => {
    expect(compile(baseQuery())).toBeUndefined();
    expect(excludesNoCost(baseQuery({ sortBy: 'price', dir: 'desc' }))).toBe(false);
  });
});
