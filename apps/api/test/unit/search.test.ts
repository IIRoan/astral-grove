import { describe, expect, test } from 'bun:test';
import { PgDialect } from 'drizzle-orm/pg-core';
import {
  buildCardSearchCondition,
  buildSearchRelevanceOrder,
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

  test('builds a SQL fragment for one or more tokens', () => {
    expect(buildCardSearchCondition('vi')).toBeDefined();
    expect(buildCardSearchCondition('vi destructive')).toBeDefined();
  });

  test('matches names regardless of spaces in the query', () => {
    const spaced = compile(buildCardSearchCondition('soul spinner')!);
    const compact = compile(buildCardSearchCondition('soulspinner')!);

    for (const compiled of [spaced, compact]) {
      expect(compiled.sql.toLowerCase()).toContain('regexp_replace');
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
    expect(compiled.sql).toContain('~*');
    expect(compiled.params).toContain('%signed%');
    expect(compiled.params).toContain(wholeWordPattern('signed'));
  });

  test('treats legend as a type intent, not a name token', () => {
    const compiled = compile(buildCardSearchCondition('ambessa legend')!);
    expect(compiled.params).toContain('%ambessa%');
    expect(compiled.sql.toLowerCase()).toContain('super');
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
    expect(compiled.sql.toLowerCase()).toContain('regexp_replace');
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

  test('boosts close name typos like stargazer → Stagazer', () => {
    const compiled = compile(buildSearchRelevanceOrder('stargazer'));
    expect(compiled.sql.toLowerCase()).toContain('similarity');
    expect(compiled.params).toContain('stargazer');
  });
});
