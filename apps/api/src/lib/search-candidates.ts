import {
  exactNameWordHits,
  getSearchGroupKey,
  lexicalRelevanceScore,
  parseSearchQuery,
  type SearchRankCard,
} from '@riftbound/contracts';
import type { ListItemDbRow } from '../services/card-mapper.js';

export type SearchCandidateGroup = {
  key: string;
  cardId: string;
  rows: ListItemDbRow[];
};

export function searchGroupKeyForRow(
  row: Pick<ListItemDbRow, 'cardId' | 'variantNumber' | 'variantLabel' | 'foilMode'>
): string {
  return `${row.cardId}:${getSearchGroupKey(
    row.variantNumber,
    row.variantLabel,
    undefined,
    row.foilMode
  )}`;
}

export function groupSearchCandidateRows(
  rows: readonly ListItemDbRow[]
): SearchCandidateGroup[] {
  const groups = new Map<string, SearchCandidateGroup>();
  for (const row of rows) {
    const key = searchGroupKeyForRow(row);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { key, cardId: row.cardId, rows: [row] });
      continue;
    }
    existing.rows.push(row);
  }
  return [...groups.values()];
}

export function searchRankCardFromGroup(group: SearchCandidateGroup): SearchRankCard {
  const primary = group.rows[0];
  if (!primary) {
    return {
      name: '',
      type: '',
      variantNumber: 'ZZZ-000',
    };
  }
  return {
    name: primary.name,
    type: primary.type,
    super: primary.super,
    variantNumber: primary.variantNumber,
    variantType: primary.variantType,
    variantLabel: primary.variantLabel,
    printings: group.rows.map((row) => ({
      variantNumber: row.variantNumber,
      variantLabel: row.variantLabel,
    })),
  };
}

export function sortCandidateGroupsLexically(
  groups: readonly SearchCandidateGroup[],
  query: string
): SearchCandidateGroup[] {
  const tokens = parseSearchQuery(query).identityTokens;
  return [...groups].sort((left, right) => {
    const leftCard = searchRankCardFromGroup(left);
    const rightCard = searchRankCardFromGroup(right);
    const diff =
      lexicalRelevanceScore(leftCard, query) - lexicalRelevanceScore(rightCard, query);
    if (diff !== 0) return diff;
    const hitDiff =
      exactNameWordHits(rightCard.name, tokens) -
      exactNameWordHits(leftCard.name, tokens);
    if (hitDiff !== 0) return hitDiff;
    const nameDiff = leftCard.name.localeCompare(rightCard.name);
    if (nameDiff !== 0) return nameDiff;
    return left.key.localeCompare(right.key);
  });
}

export function sortCandidateGroupsByName(
  groups: readonly SearchCandidateGroup[],
  dir: 'asc' | 'desc'
): SearchCandidateGroup[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...groups].sort((left, right) => {
    const nameDiff =
      (left.rows[0]?.name ?? '').localeCompare(right.rows[0]?.name ?? '') * sign;
    if (nameDiff !== 0) return nameDiff;
    return left.key.localeCompare(right.key);
  });
}

export function sortCandidateGroupsByEnergy(
  groups: readonly SearchCandidateGroup[],
  dir: 'asc' | 'desc'
): SearchCandidateGroup[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...groups].sort((left, right) => {
    const diff = ((left.rows[0]?.energy ?? 0) - (right.rows[0]?.energy ?? 0)) * sign;
    if (diff !== 0) return diff;
    return (left.rows[0]?.name ?? '').localeCompare(right.rows[0]?.name ?? '');
  });
}

export function sortCandidateGroupsByVariantNumber(
  groups: readonly SearchCandidateGroup[],
  dir: 'asc' | 'desc'
): SearchCandidateGroup[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...groups].sort((left, right) => {
    const diff =
      (left.rows[0]?.variantNumber ?? '').localeCompare(
        right.rows[0]?.variantNumber ?? ''
      ) * sign;
    if (diff !== 0) return diff;
    return left.key.localeCompare(right.key);
  });
}
