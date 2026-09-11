import type { CardDetail, CardListItem, CardsListQuery } from '@riftbound/contracts';
import {
  cardPrimaryNameToken,
  deckFormatRestrictsPicker,
  isTokenVariantNumber,
  legendChampionTags,
} from '@riftbound/contracts';
import {
  cardHasType,
  cardMatchesSectionType,
  deckCardFromDetail,
  deckCardFromListItem,
  getSectionCount,
  isChampionUnit,
  isLegendCard,
} from '@/lib/deck-card';
import { BATTLEFIELD_MAX, battlefieldsAtCapacity } from '@/lib/deck-limits';
import { getDeckIdentity, isCardEligibleForSection } from '@/lib/deck-eligibility';
import type { DeckCard, DeckSectionKey, DeckState } from '@/lib/deck-types';
import {
  catalogFiltersQueryKey,
  catalogFiltersToQuery,
  DEFAULT_CATALOG_FILTERS,
  sanitizeCatalogFilters,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import { api } from '@/src/api/client';
import { groupCardListItems, normalizeCardListItems } from '@/utils/variants';
import { searchCatalogItems, sortCatalogItems } from '@/utils/catalogSearch';

export type DeckAddCatalogStatus =
  | 'loading'
  | 'ready'
  | 'error'
  | 'needs-legend'
  | 'no-catalog-results'
  | 'no-eligible-results';

export type DeckAddSectionMeta = {
  placeholder: string;
  contextLine: string | null;
  requiresLegend: boolean;
  limit: number;
  pageSize: number;
  infiniteScroll: boolean;
};

const BATTLEFIELD_PAGE_SIZE = 80;
const MAIN_DECK_PAGE_SIZE = 80;
const MAIN_DECK_CATALOG_TYPES = 'Unit,Gear,Spell';

export function getDeckAddSectionMeta(
  section: DeckSectionKey,
  deck: DeckState
): DeckAddSectionMeta {
  switch (section) {
    case 'legend':
      return {
        placeholder: 'Search legends',
        contextLine: null,
        requiresLegend: false,
        limit: 60,
        pageSize: 60,
        infiniteScroll: false,
      };
    case 'champion':
      return {
        placeholder: 'Search champion units',
        contextLine:
          deck.format === 'pre-rift'
            ? 'Any champion unit'
            : deck.legend
              ? `Champion units for ${deck.legend.name}${
                  legendChampionTags(deck.legend).length
                    ? ` · ${legendChampionTags(deck.legend).join(', ')}`
                    : ''
                }`
              : 'Choose a Legend first',
        requiresLegend: deck.format !== 'pre-rift',
        limit: 80,
        pageSize: 80,
        infiniteScroll: false,
      };
    case 'runes':
      return {
        placeholder: 'Search runes',
        contextLine: null,
        requiresLegend: false,
        limit: 40,
        pageSize: 40,
        infiniteScroll: false,
      };
    case 'battlefields': {
      const count = getSectionCount(deck, 'battlefields');
      const remaining = BATTLEFIELD_MAX - count;
      return {
        placeholder: 'Search battlefields',
        contextLine:
          remaining <= 0
            ? '3/3 slots filled — remove a battlefield on your deck to swap'
            : `${count}/3 in deck · ${remaining} slot${remaining === 1 ? '' : 's'} open`,
        requiresLegend: false,
        limit: BATTLEFIELD_PAGE_SIZE,
        pageSize: BATTLEFIELD_PAGE_SIZE,
        infiniteScroll: true,
      };
    }
    case 'sideboard':
      return {
        placeholder: 'Search sideboard cards',
        contextLine: null,
        requiresLegend: false,
        limit: MAIN_DECK_PAGE_SIZE,
        pageSize: MAIN_DECK_PAGE_SIZE,
        infiniteScroll: true,
      };
    default:
      return {
        placeholder: 'Search main deck cards',
        contextLine: null,
        requiresLegend: false,
        limit: MAIN_DECK_PAGE_SIZE,
        pageSize: MAIN_DECK_PAGE_SIZE,
        infiniteScroll: true,
      };
  }
}

export function defaultDeckAddSearch(section: DeckSectionKey, deck: DeckState): string {
  if (section !== 'champion' || !deck.legend || deck.format === 'pre-rift') return '';
  return cardPrimaryNameToken(deck.legend);
}

export function effectiveDeckAddSearch(
  section: DeckSectionKey,
  deck: DeckState,
  userQuery: string
): string {
  const trimmed = userQuery.trim();
  if (trimmed) return trimmed;
  return defaultDeckAddSearch(section, deck);
}

/** Initial catalog filters when opening a deck add section. */
export function defaultDeckAddCatalogFilters(
  section: DeckSectionKey,
  deck: DeckState
): CatalogFilters {
  const legendColors = deck.legend?.colors ? [...deck.legend.colors].sort() : [];
  // Pre-Rift starts open across domains; Constructed locks to legend colors when known.
  const colorFilter = deck.format === 'pre-rift' ? [] : legendColors;

  switch (section) {
    case 'mainDeck':
    case 'sideboard':
      return sanitizeCatalogFilters({
        ...DEFAULT_CATALOG_FILTERS,
        colors: colorFilter,
        excludeTokens: true,
      });
    case 'runes':
      return sanitizeCatalogFilters({
        ...DEFAULT_CATALOG_FILTERS,
        colors: colorFilter,
      });
    default:
      return { ...DEFAULT_CATALOG_FILTERS };
  }
}

export function buildDeckAddListQuery(
  section: DeckSectionKey,
  deck: DeckState,
  userQuery: string,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS,
  page = 1
): Partial<CardsListQuery> {
  const q = effectiveDeckAddSearch(section, deck, userQuery);
  const meta = getDeckAddSectionMeta(section, deck);
  const sanitized = sanitizeCatalogFilters(filters);
  const filterQuery = catalogFiltersToQuery(sanitized);
  // Deck color chips use domain identity (within), not search "contains all".
  const base = {
    page,
    sortBy: 'name' as const,
    dir: 'asc' as const,
    limit: meta.pageSize,
    ...filterQuery,
    ...(filterQuery.colors ? { colorMode: 'within' as const } : {}),
    ...(q ? { q } : {}),
  };

  switch (section) {
    case 'legend':
      return { ...base, types: filterQuery.types ?? 'Legend' };
    case 'champion':
      return { ...base, types: filterQuery.types ?? 'Unit', super: 'Champion' };
    case 'runes':
      return { ...base, types: filterQuery.types ?? 'Rune' };
    case 'battlefields':
      return { ...base, types: filterQuery.types ?? 'Battlefield' };
    case 'mainDeck':
    case 'sideboard':
      return {
        ...base,
        types: filterQuery.types ?? MAIN_DECK_CATALOG_TYPES,
      };
    default:
      return base;
  }
}

export function deckAddListQueryKey(
  section: DeckSectionKey,
  query: Partial<CardsListQuery>,
  deck?: Pick<DeckState, 'legend'>,
  filters?: CatalogFilters
): string {
  return [
    section,
    deck?.legend?.variantNumber ?? '',
    query.q ?? '',
    String(query.limit ?? ''),
    query.types ?? '',
    query.super ?? '',
    query.colors ?? '',
    query.colorMode ?? '',
    catalogFiltersQueryKey(filters),
  ].join('|');
}

export const DECK_ADD_CATALOG_STALE_MS = 30 * 60 * 1000;

export function deckAddInfiniteQueryKey(
  section: DeckSectionKey,
  deck: DeckState,
  userQuery: string,
  filters: CatalogFilters = DEFAULT_CATALOG_FILTERS
): readonly ['deck-add-list', string] {
  const listQueryBase = buildDeckAddListQuery(section, deck, userQuery, filters);
  return [
    'deck-add-list',
    deckAddListQueryKey(section, listQueryBase, deck, filters),
  ] as const;
}

export async function fetchDeckAddListPage(
  section: DeckSectionKey,
  deck: DeckState,
  userQuery: string,
  filters: CatalogFilters,
  page: number
) {
  const query = buildDeckAddListQuery(section, deck, userQuery, filters, page);
  return api.listCards({
    ...query,
    // First page reconciles with PA so deck sections show current catalog cards.
    ...(page === 1 ? { refresh: true } : {}),
  });
}

export function filterDeckAddCatalogIndex(
  items: readonly CardListItem[],
  section: DeckSectionKey
): CardListItem[] {
  return items.filter((item) => matchesSectionFromListItem(item, section));
}

export function searchLocalDeckAddCatalog(
  items: readonly CardListItem[],
  section: DeckSectionKey,
  deck: DeckState,
  userQuery: string
): CardListItem[] {
  const meta = getDeckAddSectionMeta(section, deck);
  const sort = { sortBy: 'name' as const, dir: 'asc' as const };
  const pool = filterDeckAddCatalogIndex(items, section);
  const q = effectiveDeckAddSearch(section, deck, userQuery).trim();
  if (!q) {
    return sortCatalogItems(pool, sort, meta.limit);
  }
  return uniqueCardListItems(searchCatalogItems(pool, q, sort, meta.limit));
}

export function pickDeckAddDisplayListItems(
  listItems: CardListItem[],
  localListItems: CardListItem[]
): CardListItem[] {
  return listItems.length > 0 ? listItems : localListItems;
}

export function legendNeedsHydration(legend: DeckCard | null | undefined): boolean {
  if (!legend) return false;
  return legend.tags.length === 0;
}

export function mergeHydratedLegend(deck: DeckState, detail: CardDetail): DeckState {
  if (!deck.legend) return deck;
  return {
    ...deck,
    legend: deckCardFromDetail(detail, deck.legend.variantNumber),
  };
}

function pickPrimaryListItems(items: CardListItem[]): CardListItem[] {
  return groupCardListItems(normalizeCardListItems(items));
}

/** One catalog row per logical card (first search hit per cardId). */
export function uniqueCardListItems(items: CardListItem[]): CardListItem[] {
  const normalized = normalizeCardListItems(items);
  const byCardId = new Map<string, CardListItem>();
  for (const item of normalized) {
    if (!byCardId.has(item.cardId)) {
      byCardId.set(item.cardId, item);
    }
  }
  return [...byCardId.values()];
}

function detailMapFromBatch(details: CardDetail[]): Map<string, CardDetail> {
  const map = new Map<string, CardDetail>();
  for (const detail of details) {
    map.set(detail.id, detail);
    for (const variant of detail.variants) {
      map.set(variant.variantNumber, detail);
    }
  }
  return map;
}

function matchesDeckAddSectionType(card: DeckCard, section: DeckSectionKey): boolean {
  if (section === 'champion') return isChampionUnit(card);
  if (section === 'legend') return isLegendCard(card);
  // Sideboard uses the same type pool as main deck (units/gear/spells).
  if (section === 'sideboard') return cardMatchesSectionType(card, 'mainDeck');
  return cardMatchesSectionType(card, section);
}

function cardFromListItemForSection(
  item: CardListItem,
  section: DeckSectionKey
): DeckCard {
  const card = deckCardFromListItem(item);
  if (section === 'champion') {
    return { ...card, super: 'Champion' };
  }
  return card;
}

function matchesSectionFromListItem(
  item: CardListItem,
  section: DeckSectionKey
): boolean {
  switch (section) {
    case 'legend':
      return cardHasType(item, 'legend');
    case 'champion':
      return cardHasType(item, 'unit');
    case 'runes':
      return cardHasType(item, 'rune');
    case 'battlefields':
      return cardHasType(item, 'battlefield');
    case 'mainDeck':
    case 'sideboard':
      // Dual types like "Unit Gear" must match main-deck / sideboard pools.
      return cardHasType(item, 'unit', 'gear', 'spell');
    default:
      return false;
  }
}

export function buildDeckAddCandidates(args: {
  section: DeckSectionKey;
  listItems: CardListItem[];
  details: CardDetail[];
  deck?: DeckState;
}): DeckCard[] {
  const { section, listItems, details, deck } = args;
  if (!listItems.length) return [];

  const detailByKey = detailMapFromBatch(details);
  // Keep alternate arts as separate tiles; only foil finishes merge onto base printing.
  const primaryItems = pickPrimaryListItems(listItems);
  const candidates: DeckCard[] = [];
  const seenVariants = new Set<string>();

  for (const item of primaryItems) {
    if (!matchesSectionFromListItem(item, section)) continue;
    if (isTokenVariantNumber(item.variantNumber)) continue;
    if (seenVariants.has(item.variantNumber)) continue;

    const detail = detailByKey.get(item.variantNumber) ?? detailByKey.get(item.cardId);
    const card = detail
      ? deckCardFromDetail(detail, item.variantNumber)
      : cardFromListItemForSection(item, section);

    if (!matchesDeckAddSectionType(card, section)) continue;
    if ((section === 'mainDeck' || section === 'sideboard') && isChampionUnit(card)) {
      continue;
    }
    if (section === 'sideboard' && card.isSignature && deck?.format !== 'pre-rift') {
      continue;
    }

    seenVariants.add(card.variantNumber);
    candidates.push(card);
  }

  return candidates;
}

/** Add picker display rules per section (type filtering happens in the API query). */
export function filterDeckAddDisplayCards(
  _deck: DeckState,
  _section: DeckSectionKey,
  candidates: DeckCard[]
): DeckCard[] {
  return candidates;
}

export function describeDeckAddEmptyState(args: {
  section: DeckSectionKey;
  deck: DeckState;
  status: DeckAddCatalogStatus;
  catalogTotal: number;
  candidateCount: number;
  userQuery: string;
}): { title: string; description: string } {
  const { section, deck, status, catalogTotal, candidateCount, userQuery } = args;
  const meta = getDeckAddSectionMeta(section, deck);
  const search = effectiveDeckAddSearch(section, deck, userQuery);

  if (status === 'needs-legend') {
    return {
      title: 'Legend required',
      description: 'Pick a Legend on your deck before choosing a champion unit.',
    };
  }

  if (status === 'error') {
    return {
      title: 'Could not load cards',
      description: 'Check your connection and try again.',
    };
  }

  if (status === 'no-catalog-results') {
    if (section === 'champion') {
      return {
        title: 'No champion units found',
        description: search
          ? `No champion units match "${search}". Try another spelling or shorter name.`
          : 'Search for a champion unit by name.',
      };
    }
    if (section === 'battlefields') {
      return {
        title: 'No battlefields found',
        description: search
          ? `No battlefields match "${search}".`
          : 'Search for a battlefield by name.',
      };
    }
    return {
      title: 'No cards found',
      description: search ? `No cards match "${search}".` : meta.placeholder,
    };
  }

  if (status === 'no-eligible-results') {
    if (deck.format === 'pre-rift') {
      return {
        title: 'No cards found',
        description: search
          ? `No cards match "${search}". Try another spelling or shorter name.`
          : meta.placeholder,
      };
    }

    const identity = getDeckIdentity(deck);
    const domains = identity.allowedDomains
      ? [...identity.allowedDomains].join(' · ')
      : null;

    if (section === 'champion' && deck.legend) {
      const primary = cardPrimaryNameToken(deck.legend);
      return {
        title: 'No eligible champions',
        description: primary
          ? `Found ${candidateCount} champion unit(s) for "${search}", but none are ${primary} champions for ${deck.legend.name}.`
          : `Found champion units for "${search}", but none match ${deck.legend.name}.`,
      };
    }

    if (section === 'battlefields') {
      if (battlefieldsAtCapacity(deck)) {
        return {
          title: 'All battlefield slots filled',
          description: 'Remove a battlefield from your deck to swap in another.',
        };
      }
      return {
        title: 'No eligible battlefields',
        description: catalogTotal
          ? `Found ${catalogTotal} battlefield(s)${search ? ` for "${search}"` : ''}, but none can be added right now.`
          : 'No battlefields available to add.',
      };
    }

    if ((section === 'mainDeck' || section === 'sideboard') && domains) {
      const label = section === 'sideboard' ? 'sideboard' : 'main deck';
      return {
        title: search ? 'No matching cards' : 'No cards found',
        description: search
          ? `No ${label} cards match "${search}".`
          : `No ${label} cards found for ${domains} identity. Try searching by name.`,
      };
    }

    if (domains) {
      return {
        title: 'No eligible cards',
        description: `Cards must match your legend identity (${domains}).`,
      };
    }

    return {
      title: 'No eligible cards',
      description: 'Adjust your search or switch sections.',
    };
  }

  return {
    title: 'No eligible cards',
    description: meta.placeholder,
  };
}

export function filterEligibleDeckAddCards(
  deck: DeckState,
  section: DeckSectionKey,
  candidates: DeckCard[]
): DeckCard[] {
  if (!deckFormatRestrictsPicker(deck.format)) return candidates;
  return candidates.filter(
    (candidate) =>
      isCardEligibleForSection({ deck, section, candidateCard: candidate }).eligible
  );
}
