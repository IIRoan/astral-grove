import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  buildCardSearchCondition,
  buildSearchRelevanceOrder,
  buildTypeIntentCondition,
  escapeRegexLiteral,
  tokenizeSearchQuery,
  wholeWordPattern,
} from '../../src/lib/search.js';

const dialect = new PgDialect();

function compile(fragment: Parameters<PgDialect['sqlToQuery']>[0]) {
  return dialect.sqlToQuery(fragment);
}

describe('tokenizeSearchQuery', () => {
  test('splits on whitespace and lowercases', () => {
    expect(tokenizeSearchQuery('  Vi   Destruct  ')).toEqual(['vi', 'destruct']);
  });

  test('returns empty array for blank input', () => {
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });

  test('drops stopwords so second-word titles still AND-match', () => {
    expect(tokenizeSearchQuery('matriarch of war')).toEqual(['matriarch', 'war']);
  });

  test('strips type-intent tokens from identity AND list', () => {
    expect(tokenizeSearchQuery('ambessa legend')).toEqual(['ambessa']);
  });
});

describe('buildCardSearchCondition', () => {
  test('returns undefined for blank queries', () => {
    expect(buildCardSearchCondition('   ')).toBeUndefined();
  });

  test('rejects stopword-only queries instead of listing the catalog', () => {
    const compiled = compile(buildCardSearchCondition('the of a')!);
    expect(compiled.sql.toLowerCase()).toContain('false');
  });

  test('matches identity tokens via relation-local subqueries', () => {
    const compiled = compile(buildCardSearchCondition('jinx signed')!);
    expect(compiled.sql.toLowerCase()).toContain(' in (select');
    expect(compiled.sql.toLowerCase()).toContain('from "cards"');
    expect(compiled.sql.toLowerCase()).toContain('from "variants"');
    expect(compiled.sql.toLowerCase()).toContain('from "sets"');
  });

  test('matches names regardless of spaces in the query', () => {
    const spaced = compile(buildCardSearchCondition('soul spinner')!);
    const compact = compile(buildCardSearchCondition('soulspinner')!);

    for (const compiled of [spaced, compact]) {
      expect(compiled.sql.toLowerCase()).toContain('name_norm');
      expect(compiled.sql.toLowerCase()).toContain('name_squashed');
      expect(compiled.params).toContain('%soulspinner%');
    }
  });

  test('keeps per-token matching alongside the squashed name clause', () => {
    const compiled = compile(buildCardSearchCondition('soul spinner')!);
    expect(compiled.params).toContain('%soul%');
    expect(compiled.params).toContain('%spinner%');
  });

  test('searches variant labels and uses whole-word rules matching', () => {
    const compiled = compile(buildCardSearchCondition('signed')!);
    expect(compiled.sql.toLowerCase()).toContain('variant_label');
    expect(compiled.sql.toLowerCase()).toContain('rules_search_text');
    expect(compiled.sql.toLowerCase()).not.toContain('attach_text');
    expect((compiled.sql.match(/~\*/g) ?? []).length).toBe(2);
    expect(compiled.params).toContain('%signed%');
    expect(compiled.params).toContain(wholeWordPattern('signed'));
  });

  test('treats legend as a type intent, not a name token', () => {
    const compiled = compile(buildCardSearchCondition('ambessa legend')!);
    expect(compiled.params).toContain('%ambessa%');
    expect(compiled.sql.toLowerCase()).toContain('super');
  });

  test('exposes type-intent SQL for semantic extras', () => {
    const compiled = compile(buildTypeIntentCondition('ambessa legend')!);
    expect(compiled.sql.toLowerCase()).toContain('type');
    expect(compiled.params).toContain('%legend%');
    expect(compiled.params).not.toContain('%ambessa%');
  });

  test('includes trigram similarity fallback for typo queries', () => {
    const compiled = compile(buildCardSearchCondition('ambeza')!);
    expect(compiled.sql.toLowerCase()).toContain('similarity');
    expect(compiled.sql.toLowerCase()).toContain('unnest');
    expect(compiled.params).toContain('ambeza');
  });

  test('scores typos against comparable-length name words, not letter scraps', () => {
    const compiled = compile(buildCardSearchCondition('plate')!);
    expect(compiled.sql.toLowerCase()).toContain('similarity');
    expect(compiled.sql.toLowerCase()).toContain('char_length');
    expect(compiled.sql.toLowerCase()).not.toContain('word_similarity');
  });

  test('scores typos against the card name, not the type/tags blob', () => {
    const compiled = compile(buildCardSearchCondition('embessa')!);
    expect(compiled.sql.toLowerCase()).toContain('similarity');
    expect(compiled.sql.toLowerCase()).not.toContain("|| ' ' ||");
  });

  test('punctuation queries bind LIKE patterns for remaining alphanumeric tokens', () => {
    const compiled = compile(buildCardSearchCondition('100%')!);
    expect(compiled.params).toContain('%100%');
    expect(compiled.params).not.toContain('%100%%');
  });
});

describe('wholeWordPattern', () => {
  test('escapes regex metacharacters in the token', () => {
    expect(escapeRegexLiteral('a+b')).toBe('a\\+b');
    expect(wholeWordPattern('signed')).toBe('(^|[^[:alnum:]_])signed([^[:alnum:]_]|$)');
  });
});

describe('buildSearchRelevanceOrder', () => {
  test('returns a SQL ordering fragment', () => {
    expect(buildSearchRelevanceOrder('vi')).toBeDefined();
  });

  test('ranks space-insensitive name matches', () => {
    const compiled = compile(buildSearchRelevanceOrder('soul spinner'));
    expect(compiled.sql.toLowerCase()).toContain('name_norm');
    expect(compiled.sql.toLowerCase()).toContain('name_squashed');
    expect(compiled.params.some((value) => String(value).includes('soulspinner'))).toBe(
      true
    );
  });

  test('boosts legend family matches for a champion name query', () => {
    const compiled = compile(buildSearchRelevanceOrder('ambessa'));
    expect(compiled.sql.toLowerCase()).toContain('legend');
    expect(compiled.sql.toLowerCase()).toContain('champion');
  });

  test('ranks any name word prefix, not only the start of the title', () => {
    const compiled = compile(buildSearchRelevanceOrder('matriarch'));
    expect(compiled.params.some((value) => String(value).includes('matriarch'))).toBe(
      true
    );
    expect(compiled.sql).toContain(' THEN 5');
  });

  test('ranks exact first-word identity ahead of a 2-letter name prefix', () => {
    const compiled = compile(buildSearchRelevanceOrder('vi'));
    expect(compiled.sql.toLowerCase()).toContain('split_part');
    expect(compiled.sql).toContain(' THEN 3');
    expect(compiled.sql.toLowerCase()).not.toContain('tags');
  });

  test('uses lower(variant_number) for printing prefix ranks', () => {
    const compiled = compile(buildSearchRelevanceOrder('ogn-253'));
    expect(compiled.sql.toLowerCase()).toContain('lower(');
    expect(compiled.sql.toLowerCase()).toContain('variant_number');
  });

  test('boosts close name typos like stargazer → Stagazer', () => {
    const compiled = compile(buildSearchRelevanceOrder('stargazer'));
    expect(compiled.sql.toLowerCase()).toContain('similarity');
    expect(compiled.params).toContain('stargazer');
  });

  test('ranks names that contain every identity token as an exact word', () => {
    const compiled = compile(buildSearchRelevanceOrder('vi destructive'));
    expect(compiled.sql.toLowerCase()).toContain('unnest(string_to_array');
    expect(compiled.sql).toContain('w =');
    expect(compiled.params).toContain('vi');
    expect(compiled.params).toContain('destructive');
    expect(compiled.sql).toContain(' THEN 3');
  });
});
