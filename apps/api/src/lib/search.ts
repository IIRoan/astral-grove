import { and, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
  escapeIlikePattern,
  escapeRegexLiteral,
  parseSearchQuery,
  SEARCH_CLOSE_NAME_THRESHOLD,
  SEARCH_FUZZY_MIN_LENGTH,
  SEARCH_WORD_LENGTH_SLACK,
  SEARCH_WORD_SIMILARITY_THRESHOLD,
  tokenizeSearchQuery,
} from '@riftbound/contracts';
import { cards, sets, variants } from '../db/schema.js';

export { escapeRegexLiteral, tokenizeSearchQuery };

const TRIGRAM_SIMILARITY_THRESHOLD = SEARCH_WORD_SIMILARITY_THRESHOLD;

export function sqlNormalizedName() {
  return sql`${cards.nameNorm}`;
}

function sqlNormalizedNameFirstWord() {
  return sql`split_part(${sqlNormalizedName()}, ' ', 1)`;
}

function sqlSquashedName() {
  return sql`${cards.nameSquashed}`;
}

/** Case-insensitive whole-word match: "signed" hits "Overnumbered Signed" but not "assigned". */
export function wholeWordPattern(token: string): string {
  return `(^|[^[:alnum:]_])${escapeRegexLiteral(token)}([^[:alnum:]_]|$)`;
}

function sqlNameHasExactWord(token: string) {
  return sql`EXISTS (
    SELECT 1
    FROM unnest(string_to_array(${sqlNormalizedName()}, ' ')) AS w
    WHERE w = ${token}
  )`;
}

function sqlExactAllIdentityWords(tokens: readonly string[]) {
  if (tokens.length === 0) return sql`false`;
  return and(...tokens.map((token) => sqlNameHasExactWord(token))) ?? sql`false`;
}

function sqlNameHasSimilarWord(token: string, threshold: number) {
  if (token.length < SEARCH_FUZZY_MIN_LENGTH) return sql`false`;
  return sql`EXISTS (
    SELECT 1
    FROM unnest(string_to_array(${sqlNormalizedName()}, ' ')) AS w
    WHERE char_length(w) >= ${SEARCH_FUZZY_MIN_LENGTH}
      AND abs(char_length(w) - ${token.length}) <= ${SEARCH_WORD_LENGTH_SLACK}
      AND similarity(w, ${token}) >= ${threshold}
  )`;
}

function tokenNameTrigramMatch(token: string): SQL | undefined {
  if (token.length < SEARCH_FUZZY_MIN_LENGTH) return undefined;
  return sql`(
    ${sqlNameHasSimilarWord(token, TRIGRAM_SIMILARITY_THRESHOLD)}
    OR (
      abs(char_length(${sqlSquashedName()}) - ${token.length}) <= ${SEARCH_WORD_LENGTH_SLACK}
      AND similarity(${sqlSquashedName()}, ${token}) >= ${TRIGRAM_SIMILARITY_THRESHOLD}
    )
  )`;
}

function cardIdentityTokenMatch(token: string): SQL {
  const pattern = `%${escapeIlikePattern(token)}%`;
  const wordPattern = wholeWordPattern(token);
  const fuzzy = tokenNameTrigramMatch(token);
  return or(
    ilike(cards.name, pattern),
    sql`${sqlNormalizedName()} LIKE ${pattern}`,
    sql`lower(${cards.type}) LIKE ${pattern}`,
    sql`${cards.tags}::text ILIKE ${pattern}`,
    sql`${cards.rulesSearchText} ~* ${wordPattern}`,
    ...(fuzzy ? [fuzzy] : [])
  )!;
}

function variantIdentityTokenMatch(token: string): SQL {
  const pattern = `%${escapeIlikePattern(token)}%`;
  const wordPattern = wholeWordPattern(token);
  return or(
    sql`lower(${variants.variantNumber}) LIKE ${pattern}`,
    sql`lower(${variants.variantLabel}) LIKE ${pattern}`,
    sql`lower(${variants.variantType}) LIKE ${pattern}`,
    sql`${variants.variantTypes}::text ILIKE ${pattern}`,
    sql`lower(coalesce(${variants.artist}, '')) LIKE ${pattern}`,
    sql`${variants.flavorText} ~* ${wordPattern}`
  )!;
}

function setIdentityTokenMatch(token: string): SQL {
  const pattern = `%${escapeIlikePattern(token)}%`;
  return or(
    sql`lower(${sets.name}) LIKE ${pattern}`,
    sql`lower(${sets.code}) LIKE ${pattern}`
  )!;
}

function identityTokenMatch(token: string): SQL {
  return sql`(
    ${cards.id} IN (SELECT ${cards.id} FROM ${cards} WHERE ${cardIdentityTokenMatch(token)})
    OR ${variants.id} IN (SELECT ${variants.id} FROM ${variants} WHERE ${variantIdentityTokenMatch(token)})
    OR ${sets.id} IN (SELECT ${sets.id} FROM ${sets} WHERE ${setIdentityTokenMatch(token)})
  )`;
}

function typeIntentMatch(intent: string): SQL {
  const pattern = `%${escapeIlikePattern(intent)}%`;
  return or(
    sql`lower(${cards.type}) LIKE ${pattern}`,
    sql`lower(coalesce(${cards.super}, '')) LIKE ${pattern}`
  )!;
}

export function buildTypeIntentCondition(q: string): SQL | undefined {
  const parsed = parseSearchQuery(q);
  if (parsed.typeIntents.length === 0) return undefined;
  return and(...parsed.typeIntents.map((intent) => typeIntentMatch(intent)));
}

function trigramFallback(normalizedQuery: string, squashed: string): SQL | undefined {
  if (normalizedQuery.length < SEARCH_FUZZY_MIN_LENGTH) return undefined;
  return sql`(
    ${sqlNameHasSimilarWord(normalizedQuery, TRIGRAM_SIMILARITY_THRESHOLD)}
    OR (
      abs(char_length(${sqlSquashedName()}) - ${squashed.length}) <= ${SEARCH_WORD_LENGTH_SLACK}
      AND similarity(${sqlSquashedName()}, ${squashed}) >= ${TRIGRAM_SIMILARITY_THRESHOLD}
    )
  )`;
}

function cardLevelClause(clause: SQL): SQL {
  return sql`${cards.id} IN (SELECT ${cards.id} FROM ${cards} WHERE ${clause})`;
}

/** Per-token match on name/variant/type/tags/rules; type-intent on type/super; trigram typo fallback. */
export function buildCardSearchCondition(q: string): SQL | undefined {
  const parsed = parseSearchQuery(q);
  if (parsed.identityTokens.length === 0 && parsed.typeIntents.length === 0) {
    return parsed.normalized.length > 0 ? sql`false` : undefined;
  }

  const identityClauses = parsed.identityTokens.map((token) =>
    identityTokenMatch(token)
  );
  const typeClauses = parsed.typeIntents.map((intent) => typeIntentMatch(intent));
  const typeGate = typeClauses.length > 0 ? and(...typeClauses) : undefined;
  const identityGate = identityClauses.length > 0 ? and(...identityClauses) : undefined;

  const required =
    identityGate && typeGate ? and(identityGate, typeGate) : (identityGate ?? typeGate);
  const squashed =
    parsed.squashed.length > 0
      ? cardLevelClause(
          sql`${sqlSquashedName()} LIKE ${`%${escapeIlikePattern(parsed.squashed)}%`}`
        )
      : undefined;
  const fuzzyRaw = trigramFallback(parsed.normalized, parsed.squashed);
  const fuzzy = fuzzyRaw ? cardLevelClause(fuzzyRaw) : undefined;

  const withType = (clause: SQL | undefined): SQL | undefined => {
    if (!clause) return undefined;
    return typeGate ? and(clause, typeGate) : clause;
  };

  const squashedTyped = withType(squashed);
  const fuzzyTyped = withType(fuzzy);

  return or(
    ...(required ? [required] : []),
    ...(squashedTyped ? [squashedTyped] : []),
    ...(fuzzyTyped ? [fuzzyTyped] : [])
  );
}

export function buildSearchRelevanceOrder(q: string) {
  const parsed = parseSearchQuery(q);
  const familyToken = parsed.identityTokens[0] ?? parsed.normalized;
  const familyContains = `%${escapeIlikePattern(familyToken)}%`;
  const identityJoined = parsed.identityTokens.join(' ');
  const namePrefix = `${escapeIlikePattern(identityJoined || parsed.normalized)}%`;
  const squashedPrefix = `${escapeIlikePattern(parsed.squashed)}%`;
  const squashedContains = `%${escapeIlikePattern(parsed.squashed)}%`;
  const wordPrefixPattern =
    parsed.identityTokens.length > 0
      ? `(^| )(${parsed.identityTokens.map(escapeRegexLiteral).join('|')})`
      : '';
  const typeIntent = parsed.typeIntents[0];

  const exactFirstWord =
    familyToken.length > 0
      ? sql`${sqlNormalizedNameFirstWord()} = ${familyToken}`
      : sql`false`;
  const exactAllIdentityWords = sqlExactAllIdentityWords(parsed.identityTokens);
  const exactFullName =
    parsed.normalized.length > 0
      ? sql`${sqlNormalizedName()} = ${parsed.normalized}`
      : sql`false`;
  const exactSquashedName =
    parsed.squashed.length > 0
      ? sql`${sqlSquashedName()} = ${parsed.squashed}`
      : sql`false`;

  return sql`
    CASE
      WHEN position('legend' in lower(${cards.type})) > 0
        AND ${exactFirstWord}
        THEN 0
      WHEN lower(coalesce(${cards.super}, '')) = 'champion'
        AND ${exactFirstWord}
        THEN 1
      WHEN ${typeIntent ? sql`lower(${cards.type}) LIKE ${`%${escapeIlikePattern(typeIntent)}%`}` : sql`false`}
        AND ${exactFirstWord}
        THEN 2
      WHEN ${exactAllIdentityWords} THEN 3
      WHEN ${exactFullName} OR ${exactSquashedName} THEN 3
      WHEN ${exactFirstWord} THEN 3
      WHEN ${sqlNormalizedName()} LIKE ${namePrefix} THEN 4
      WHEN ${parsed.squashed.length > 0 ? sql`${sqlSquashedName()} LIKE ${squashedPrefix}` : sql`false`} THEN 4
      WHEN ${
        parsed.squashed.length >= SEARCH_FUZZY_MIN_LENGTH
          ? sql`(
              abs(char_length(${sqlSquashedName()}) - ${parsed.squashed.length}) <= ${SEARCH_WORD_LENGTH_SLACK}
              AND similarity(${sqlSquashedName()}, ${parsed.squashed}) >= ${SEARCH_CLOSE_NAME_THRESHOLD}
            )`
          : sql`false`
      } THEN 4
      WHEN ${
        familyToken.length >= SEARCH_FUZZY_MIN_LENGTH
          ? sqlNameHasSimilarWord(familyToken, SEARCH_CLOSE_NAME_THRESHOLD)
          : sql`false`
      } THEN 4
      WHEN ${wordPrefixPattern ? sql`${sqlNormalizedName()} ~ ${wordPrefixPattern}` : sql`false`} THEN 5
      WHEN lower(${variants.variantNumber}) LIKE ${namePrefix} THEN 6
      WHEN ${sqlNormalizedName()} LIKE ${familyContains} THEN 7
      WHEN ${parsed.squashed.length > 0 ? sql`${sqlSquashedName()} LIKE ${squashedContains}` : sql`false`} THEN 8
      ELSE 9
    END
  `;
}
