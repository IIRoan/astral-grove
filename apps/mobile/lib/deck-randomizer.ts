import type { CardDetail, CardListItem } from '@riftbound/contracts';
import {
  deckValidationIsValid,
  getDeckRules,
  isMainDeckCardType,
  isSignatureCard,
  isTokenCard,
} from '@riftbound/contracts';
import { getLegendRuneDomains } from '@/lib/deck-builder';
import {
  addCardToDeck,
  cardHasType,
  createEmptyDeck,
  deckCardFromDetail,
  deckCardFromListItem,
  getSectionCount,
  isChampionUnit,
  isLegendCard,
} from '@/lib/deck-card';
import { isCardEligibleForSection } from '@/lib/deck-eligibility';
import type { DeckCard, DeckSectionKey, DeckState } from '@/lib/deck-types';
import { validateDeck } from '@/lib/deck-validation';

export const RANDOMIZER_DOMAINS = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order'];

export type RandomizerCopies = 'singleton' | 'random' | 'playset';

export type RandomizerSettings = {
  /** Legend must stay inside these domains; empty = any. */
  domains: string[];
  /** Non-rune cards come only from these set codes; empty = any. */
  sets: string[];
  copies: RandomizerCopies;
};

export const DEFAULT_RANDOMIZER_SETTINGS: RandomizerSettings = {
  domains: [],
  sets: [],
  copies: 'random',
};

type Rng = () => number;

function pick<T>(items: readonly T[], rng: Rng): T | undefined {
  return items[Math.floor(rng() * items.length)];
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function copiesPerPick(copies: RandomizerCopies, rng: Rng): number {
  if (copies === 'singleton') return 1;
  if (copies === 'playset') return 3;
  return 1 + Math.floor(rng() * 3);
}

/** One deckbuildable card per name (standard printing first), so alt arts don't skew the odds. */
function randomizerPool(items: readonly CardListItem[]): DeckCard[] {
  const byName = new Map<string, CardListItem>();
  for (const item of items) {
    if (item.isBanned) continue;
    const existing = byName.get(item.name);
    if (
      !existing ||
      (existing.variantType !== 'Standard' && item.variantType === 'Standard')
    ) {
      byName.set(item.name, item);
    }
  }
  return [...byName.values()]
    .map(deckCardFromListItem)
    .filter((card) => !isTokenCard(card));
}

/**
 * Random Constructed deck: legend, matching champion, 39 main, 12 runes, 3 battlefields.
 * Every pick goes through the deck builder's eligibility rules; throws unless the result validates.
 */
export async function generateRandomDeck(
  items: readonly CardListItem[],
  settings: RandomizerSettings,
  fetchDetails: (variantNumbers: string[]) => Promise<Map<string, CardDetail>>,
  rng: Rng = Math.random
): Promise<DeckState> {
  const pool = randomizerPool(items);
  const inSets = (card: DeckCard) =>
    settings.sets.length === 0 || settings.sets.includes(card.setCode);

  const listLegend = pick(
    pool.filter(
      (card) =>
        isLegendCard(card) &&
        inSets(card) &&
        (settings.domains.length === 0 ||
          card.colors.every((domain) => settings.domains.includes(domain)))
    ),
    rng
  );
  if (!listLegend) throw new Error('No legend matches these settings.');

  // Catalog rows carry no tags; champion and signature matching needs them.
  const legendDomains = new Set(listLegend.colors);
  const needsTags = pool.filter(
    (card) =>
      card === listLegend ||
      ((isChampionUnit(card) || isSignatureCard(card)) &&
        card.colors.every((domain) => legendDomains.has(domain)))
  );
  const details = await fetchDetails(needsTags.map((card) => card.variantNumber));
  const hydrate = (card: DeckCard) => {
    const detail = details.get(card.variantNumber);
    return detail ? deckCardFromDetail(detail, card.variantNumber) : card;
  };
  const cards = pool.map(hydrate);
  const rules = getDeckRules('constructed');

  let deck: DeckState = {
    ...createEmptyDeck('Random deck'),
    legend: hydrate(listLegend),
  };
  const eligible = (section: DeckSectionKey, candidateCard: DeckCard) =>
    isCardEligibleForSection({ deck, section, candidateCard }).eligible;

  const champion = pick(
    cards.filter(
      (card) => inSets(card) && isChampionUnit(card) && eligible('champion', card)
    ),
    rng
  );
  if (!champion)
    throw new Error(`No champion unit matches ${listLegend.name} in these sets.`);
  deck = { ...deck, champion };

  const mainTarget = rules.sections.mainDeck.minimum;
  for (const card of shuffle(
    cards.filter((c) => inSets(c) && isMainDeckCardType(c)),
    rng
  )) {
    const wanted = copiesPerPick(settings.copies, rng);
    for (let i = 0; i < wanted && getSectionCount(deck, 'mainDeck') < mainTarget; i++) {
      if (!eligible('mainDeck', card)) break;
      deck = addCardToDeck(deck, card, { section: 'mainDeck' });
    }
    if (getSectionCount(deck, 'mainDeck') >= mainTarget) break;
  }

  const runeFor = (domain: string) =>
    cards.find((card) => cardHasType(card, 'rune') && card.colors.includes(domain));
  const runeDomains = getLegendRuneDomains(deck.legend!);
  for (let i = 0; i < rules.sections.runes.target; i++) {
    const rune = runeFor(pick(runeDomains, rng)!);
    if (rune) deck = addCardToDeck(deck, rune, { section: 'runes' });
  }

  for (const card of shuffle(
    cards.filter((c) => inSets(c) && cardHasType(c, 'battlefield')),
    rng
  )) {
    if (getSectionCount(deck, 'battlefields') >= rules.sections.battlefields.target)
      break;
    if (eligible('battlefields', card)) {
      deck = addCardToDeck(deck, card, { section: 'battlefields' });
    }
  }

  const messages = validateDeck(deck);
  if (!deckValidationIsValid(messages)) {
    throw new Error(messages[0]?.message ?? 'Could not build a valid deck.');
  }
  return deck;
}
