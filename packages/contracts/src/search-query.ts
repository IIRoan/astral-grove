export const SEARCH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'of',
  'the',
  'to',
  'for',
  'in',
  'on',
  'at',
]);

export const SEARCH_TYPE_INTENTS = [
  'legend',
  'champion',
  'spell',
  'unit',
  'gear',
  'rune',
  'battlefield',
  'signature',
] as const;

export type SearchTypeIntent = (typeof SEARCH_TYPE_INTENTS)[number];

const TYPE_INTENT_SET = new Set<string>(SEARCH_TYPE_INTENTS);

export type ParsedSearchQuery = {
  normalized: string;
  identityTokens: string[];
  typeIntents: SearchTypeIntent[];
  squashed: string;
};

export type SearchRankCard = {
  name: string;
  type: string;
  super?: string | null | undefined;
  tags?: readonly string[] | undefined;
  variantNumber: string;
  variantType?: string | undefined;
  variantLabel?: string | undefined;
  printings?: readonly { variantNumber: string; variantLabel: string }[] | undefined;
};

/** Lowercase, turn punctuation into spaces, collapse whitespace. */
export function normalizeSearchText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function squashSearchText(raw: string): string {
  return normalizeSearchText(raw).replace(/\s+/g, '');
}

function isTypeIntent(token: string): token is SearchTypeIntent {
  return TYPE_INTENT_SET.has(token);
}

/** Split a query into identity tokens (AND) and type-intent tokens (type/super boost). */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const normalized = normalizeSearchText(raw);
  const squashed = normalized.replace(/\s+/g, '');
  if (!normalized) {
    return { normalized: '', identityTokens: [], typeIntents: [], squashed: '' };
  }

  const identityTokens: string[] = [];
  const typeIntents: SearchTypeIntent[] = [];
  for (const token of normalized.split(' ')) {
    if (!token || SEARCH_STOPWORDS.has(token)) continue;
    if (isTypeIntent(token)) {
      if (!typeIntents.includes(token)) typeIntents.push(token);
      continue;
    }
    identityTokens.push(token);
  }

  return { normalized, identityTokens, typeIntents, squashed };
}

/** Identity tokens only — stopwords and type intents removed. */
export function tokenizeSearchQuery(raw: string): string[] {
  return parseSearchQuery(raw).identityTokens;
}

export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export const SEARCH_FUZZY_MIN_LENGTH = 4;
export const SEARCH_WORD_SIMILARITY_THRESHOLD = 0.35;
export const SEARCH_CLOSE_NAME_THRESHOLD = 0.45;
export const SEARCH_WORD_LENGTH_SLACK = 2;

export function wordsAreComparableLength(left: string, right: string): boolean {
  return Math.abs(left.length - right.length) <= SEARCH_WORD_LENGTH_SLACK;
}

function paddedTrigrams(value: string): string[] {
  const padded = `  ${value} `;
  const grams: string[] = [];
  for (let i = 0; i <= padded.length - 3; i++) {
    grams.push(padded.slice(i, i + 3));
  }
  return grams;
}

/** pg_trgm-style Jaccard over unique character trigrams. */
export function trigramSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const a = new Set(paddedTrigrams(left));
  const b = new Set(paddedTrigrams(right));
  let overlap = 0;
  for (const gram of a) {
    if (b.has(gram)) overlap += 1;
  }
  const union = a.size + b.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

/** Best Jaccard of the query against comparable-length words (not coverage of a short needle). */
export function wordSimilarity(query: string, text: string): number {
  const needle = normalizeSearchText(query);
  if (!needle) return 0;
  const blob = normalizeSearchText(text);
  let best = 0;
  for (const word of blob.split(' ')) {
    if (!word || !wordsAreComparableLength(needle, word)) continue;
    best = Math.max(best, trigramSimilarity(needle, word));
  }
  const squashed = blob.replace(/\s+/g, '');
  if (wordsAreComparableLength(needle, squashed)) {
    best = Math.max(best, trigramSimilarity(needle, squashed));
  }
  return best;
}

function blobHasToken(blob: string, squashedBlob: string, token: string): boolean {
  if (blob.includes(token)) return true;
  return squashedBlob.includes(token.replace(/\s+/g, ''));
}

function tokenFuzzyMatchesHaystack(
  token: string,
  blob: string,
  squashedBlob: string
): boolean {
  if (token.length < SEARCH_FUZZY_MIN_LENGTH) return false;
  if (wordSimilarity(token, blob) >= SEARCH_WORD_SIMILARITY_THRESHOLD) return true;
  const squashedToken = token.replace(/\s+/g, '');
  return (
    squashedBlob.length >= SEARCH_FUZZY_MIN_LENGTH &&
    wordsAreComparableLength(squashedToken, squashedBlob) &&
    trigramSimilarity(squashedToken, squashedBlob) >= SEARCH_WORD_SIMILARITY_THRESHOLD
  );
}

/** True when the query is a near-miss of the card name (stargazer → Stagazer). */
export function isCloseNameMatch(query: string, name: string): boolean {
  const parsed = parseSearchQuery(query);
  if (
    parsed.squashed.length >= SEARCH_FUZZY_MIN_LENGTH &&
    wordsAreComparableLength(parsed.squashed, squashSearchText(name)) &&
    trigramSimilarity(parsed.squashed, squashSearchText(name)) >=
      SEARCH_CLOSE_NAME_THRESHOLD
  ) {
    return true;
  }
  const token = parsed.identityTokens[0];
  if (!token || token.length < SEARCH_FUZZY_MIN_LENGTH) return false;
  return wordSimilarity(token, name) >= SEARCH_CLOSE_NAME_THRESHOLD;
}

function typeBlob(card: Pick<SearchRankCard, 'type' | 'super'>): string {
  return normalizeSearchText(`${card.type} ${card.super ?? ''}`);
}

function cardMatchesTypeIntents(
  card: Pick<SearchRankCard, 'type' | 'super'>,
  typeIntents: readonly SearchTypeIntent[]
): boolean {
  if (typeIntents.length === 0) return true;
  const blob = typeBlob(card);
  return typeIntents.every((intent) => blob.includes(intent));
}

/** True when every identity token appears in the haystack (punctuation-insensitive). */
export function matchesSearchHaystack(haystack: string, query: string): boolean {
  const parsed = parseSearchQuery(query);
  if (parsed.identityTokens.length === 0 && parsed.typeIntents.length === 0) {
    return parsed.normalized.length === 0;
  }

  const blob = normalizeSearchText(haystack);
  const squashedBlob = blob.replace(/\s+/g, '');
  const identityOk =
    parsed.identityTokens.length === 0 ||
    parsed.identityTokens.every(
      (token) =>
        blobHasToken(blob, squashedBlob, token) ||
        tokenFuzzyMatchesHaystack(token, blob, squashedBlob)
    ) ||
    (parsed.squashed.length > 0 && squashedBlob.includes(parsed.squashed)) ||
    (parsed.squashed.length >= SEARCH_FUZZY_MIN_LENGTH &&
      wordsAreComparableLength(parsed.squashed, squashedBlob) &&
      trigramSimilarity(parsed.squashed, squashedBlob) >=
        SEARCH_WORD_SIMILARITY_THRESHOLD);

  if (!identityOk) return false;
  if (parsed.typeIntents.length === 0) return true;
  return parsed.typeIntents.every((intent) => blob.includes(intent));
}

function nameWords(name: string): string[] {
  const normalized = normalizeSearchText(name);
  return normalized ? normalized.split(' ') : [];
}

function exactFirstNameWord(name: string, token: string | undefined): boolean {
  if (!token) return false;
  return nameWords(name)[0] === token;
}

function familyTokenMatch(card: SearchRankCard, token: string | undefined): boolean {
  if (!token) return false;
  const words = nameWords(card.name);
  if (words.some((word) => word === token)) return true;
  const tags = (card.tags ?? []).map((tag) => normalizeSearchText(tag));
  return tags.some((tag) => tag === token || tag.split(' ').includes(token));
}

function isLegendType(type: string): boolean {
  return typeBlob({ type, super: null }).includes('legend');
}

function isChampionSuper(value: string | null | undefined): boolean {
  return normalizeSearchText(value ?? '') === 'champion';
}

function anyNameWordPrefix(name: string, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false;
  const words = nameWords(name);
  return tokens.some((token) => words.some((word) => word.startsWith(token)));
}

function printingBlob(card: SearchRankCard): string {
  const parts = [card.variantNumber, card.variantType ?? '', card.variantLabel ?? ''];
  for (const printing of card.printings ?? []) {
    parts.push(printing.variantNumber, printing.variantLabel);
  }
  return normalizeSearchText(parts.join(' '));
}

/** Lower is better. Exact first-word identity beats longer prefixes (Vi > Viktor > Sivir). */
export function lexicalRelevanceScore(card: SearchRankCard, query: string): number {
  const parsed = parseSearchQuery(query);
  if (parsed.identityTokens.length === 0 && parsed.typeIntents.length === 0) {
    return 99;
  }

  const familyToken = parsed.identityTokens[0];
  const family = familyTokenMatch(card, familyToken);
  const typeOk = cardMatchesTypeIntents(card, parsed.typeIntents);
  const normalizedName = normalizeSearchText(card.name);
  const squashedName = squashSearchText(card.name);
  const prints = printingBlob(card);

  if (family && isLegendType(card.type) && typeOk) return 0;
  if (family && isChampionSuper(card.super) && typeOk) return 1;
  if (parsed.typeIntents.length > 0 && typeOk && family) return 2;
  if (exactFirstNameWord(card.name, familyToken)) return 3;
  if (
    parsed.identityTokens.length > 0 &&
    (normalizedName.startsWith(parsed.identityTokens.join(' ')) ||
      (parsed.squashed.length > 0 && squashedName.startsWith(parsed.squashed)))
  ) {
    return 4;
  }
  if (isCloseNameMatch(query, card.name)) return 4;
  if (anyNameWordPrefix(card.name, parsed.identityTokens)) return 5;
  if (parsed.identityTokens.some((token) => prints.startsWith(token))) return 6;
  if (
    parsed.identityTokens.every((token) => normalizedName.includes(token)) ||
    (parsed.squashed.length > 0 && squashedName.includes(parsed.squashed))
  ) {
    return 7;
  }
  if (parsed.identityTokens.some((token) => prints.includes(token))) return 8;
  if (family) return 9;
  return 10;
}

export function sortByLexicalRelevance<T extends SearchRankCard>(
  items: readonly T[],
  query: string
): T[] {
  return [...items].sort((left, right) => {
    const diff =
      lexicalRelevanceScore(left, query) - lexicalRelevanceScore(right, query);
    if (diff !== 0) return diff;
    return left.name.localeCompare(right.name);
  });
}

export function cardEmbeddingDocument(card: {
  name: string;
  type: string;
  super?: string | null | undefined;
  tags?: readonly string[] | undefined;
  description?: string | undefined;
  effect?: string | null | undefined;
  attachText?: string | null | undefined;
}): string {
  return [
    `name ${card.name}`,
    `type ${card.type}`,
    card.super ? `super ${card.super}` : '',
    (card.tags ?? []).length > 0 ? `tags ${card.tags?.join(' ')}` : '',
    card.effect ?? '',
    card.attachText ?? '',
    card.description ?? '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

/** Reciprocal rank fusion — higher fused score is better. */
export function reciprocalRankFusion(
  rankedLists: readonly (readonly string[])[],
  k = 60
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankedLists) {
    list.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return scores;
}

/** Lexical buckets first, then RRF, then name — keeps Ambessa legend above tag noise. */
export function fuseSearchResultIds(
  lexicalIds: readonly string[],
  vectorIds: readonly string[],
  cardsById: ReadonlyMap<string, SearchRankCard>,
  query: string
): string[] {
  const fused = reciprocalRankFusion([lexicalIds, vectorIds]);
  const ids = [...new Set([...lexicalIds, ...vectorIds])];
  return ids.sort((left, right) => {
    const leftCard = cardsById.get(left);
    const rightCard = cardsById.get(right);
    const leftBoost = leftCard ? lexicalRelevanceScore(leftCard, query) : 99;
    const rightBoost = rightCard ? lexicalRelevanceScore(rightCard, query) : 99;
    if (leftBoost !== rightBoost) return leftBoost - rightBoost;
    const scoreDiff = (fused.get(right) ?? 0) - (fused.get(left) ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (leftCard?.name ?? left).localeCompare(rightCard?.name ?? right);
  });
}
