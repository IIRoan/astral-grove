import {
  deckCardFromDetail,
  deckCardFromListItem,
  isLegendCard,
} from '@/lib/deck-card';
import type { DeckCard } from '@/lib/deck-types';
import { groupCardListItems, normalizeCardListItems } from '@/utils/variants';
import type { CardDetail, CardListItem } from '@riftbound/contracts';

export const PLAY_LEGEND_PAGE_SIZE = 60;
/** Keep legend pages warm so reopening the picker feels instant. */
export const PLAY_LEGEND_STALE_MS = 30 * 60 * 1000;
/** Short debounce — search stays responsive without hammering the API. */
export const PLAY_LEGEND_SEARCH_DEBOUNCE_MS = 120;
/** Wait for typing to settle before batch-hydrating art (list art paints first). */
export const PLAY_LEGEND_DETAIL_DEFER_MS = 180;

export const PLAY_LEGEND_CATALOG_ROOT = 'play-legend-catalog' as const;
export const PLAY_LEGEND_DETAILS_ROOT = 'play-legend-details' as const;

/** Stable React Query key for a legend list page set. */
export function playLegendListQueryKey(
  search: string,
  pageSize = PLAY_LEGEND_PAGE_SIZE
): readonly unknown[] {
  const q = search.trim().toLowerCase();
  return [
    PLAY_LEGEND_CATALOG_ROOT,
    'cards',
    'search',
    q || 'type:legend',
    pageSize,
    'name',
    'asc',
  ] as const;
}

export function playLegendDetailsQueryKey(
  variantNumbers: readonly string[]
): readonly unknown[] {
  return [PLAY_LEGEND_DETAILS_ROOT, [...variantNumbers].sort().join(',')] as const;
}

/** Group raw legend search pages the same way catalog browse does. */
export function groupLegendListItems(raw: CardListItem[]): CardListItem[] {
  return groupCardListItems(normalizeCardListItems(raw)).filter(
    (item) => item.type.toLowerCase() === 'legend'
  );
}

/** Hydrate legend rows: batch detail art when available, else list payloads. */
export function buildPlayLegendRows(
  listItems: CardListItem[],
  details: readonly CardDetail[] | undefined
): DeckCard[] {
  const detailByVariant = new Map<string, CardDetail>();
  for (const card of details ?? []) {
    for (const variant of card.variants) {
      detailByVariant.set(variant.variantNumber, card);
    }
  }

  const results: DeckCard[] = [];
  for (const item of listItems) {
    const detail = detailByVariant.get(item.variantNumber);
    const card = detail
      ? deckCardFromDetail(detail, item.variantNumber)
      : deckCardFromListItem(item);
    if (!isLegendCard(card)) continue;
    results.push(card);
  }
  return results;
}

/** Spinner only when nothing to show; cached/placeholder rows stay painted during search. */
export function shouldShowLegendCatalogLoading(
  isInitialLoading: boolean,
  legendCount: number
): boolean {
  return isInitialLoading && legendCount === 0;
}

/** Keep last non-empty results while searching; clear immediately on settled empty. */
export function resolveDisplayedLegends<T>(
  legends: readonly T[],
  previous: readonly T[],
  isFetching: boolean
): readonly T[] {
  if (legends.length > 0) return legends;
  if (isFetching && previous.length > 0) return previous;
  return legends;
}

export type PlayScoreHintTone = {
  /** Soft etch mark — darker on light seats, lighter on dark seats. */
  textClassName: string;
};

/** −/+ etch for seat halves: darker on light UI, lighter on dark — readable, not chrome. */
export function playScoreHintClasses(scheme: 'light' | 'dark'): PlayScoreHintTone {
  if (scheme === 'light') {
    return { textClassName: 'text-black/35' };
  }
  return { textClassName: 'text-white/40' };
}
