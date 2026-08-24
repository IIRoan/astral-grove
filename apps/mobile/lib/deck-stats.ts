import { cardTypeTokens } from '@riftbound/contracts';
import { DOMAIN_KEYWORD_NAMES } from '@/lib/card-keywords';
import { deckSectionProgress } from '@/lib/deck-display';
import type { DeckCard, DeckState } from '@/lib/deck-types';

/** Always plot at least 0–8 energy so empty high costs stay visible. */
export const ENERGY_CURVE_FLOOR = 8;
/** Always plot at least 0–4 power. */
export const POWER_CURVE_FLOOR = 4;

export const STAT_CARD_TYPES = ['Unit', 'Spell', 'Gear'] as const;
export type StatCardType = (typeof STAT_CARD_TYPES)[number];

export const STAT_RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Epic',
  'Showcase',
] as const;

export const ENERGY_BANDS = [
  { key: 'low', label: 'Low 0–2' },
  { key: 'mid', label: 'Mid 3–5' },
  { key: 'high', label: 'High 6+' },
] as const;

export const COLORLESS_DOMAIN = 'Colorless';

export type DeckStatDomainSlice = {
  domain: string;
  count: number;
};

export type DeckStatBucket = {
  value: number;
  count: number;
  /** Dual-domain cards count in every domain they show. */
  byDomain: DeckStatDomainSlice[];
  /** Primary-domain stack so segments sum to `count`. */
  stack: DeckStatDomainSlice[];
};

export type DeckStatMixKind = 'domain' | 'type' | 'colorless' | 'rarity' | 'mix';

export type DeckStatMixItem = {
  key: string;
  label: string;
  count: number;
  kind: DeckStatMixKind;
};

export type DeckStatFact = {
  key: 'unique' | 'dual' | 'signature';
  label: string;
  count: number;
};

export type DeckStats = {
  cardCount: number;
  cardTarget: number;
  avgEnergy: number | null;
  avgPower: number | null;
  energy: DeckStatBucket[];
  power: DeckStatBucket[];
  domains: DeckStatMixItem[];
  types: DeckStatMixItem[];
  bands: DeckStatMixItem[];
  copies: DeckStatMixItem[];
  rarities: DeckStatMixItem[];
  facts: DeckStatFact[];
};

export type DeckStatsCatalogPower = ReadonlyMap<string, number>;

type PoolCard = {
  name: string;
  energy: number;
  power: number;
  colors: string[];
  type: string;
  rarity: string;
  isSignature: boolean;
  count: number;
};

function resolveCardPower(
  card: DeckCard,
  catalogPower?: DeckStatsCatalogPower
): number {
  if (typeof card.power === 'number' && Number.isFinite(card.power)) {
    return card.power;
  }
  return catalogPower?.get(card.cardId) ?? catalogPower?.get(card.name) ?? 0;
}

function collectPool(
  deck: DeckState,
  catalogPower?: DeckStatsCatalogPower
): PoolCard[] {
  const pool: PoolCard[] = [];
  const add = (card: DeckCard, count: number) => {
    pool.push({
      name: card.name,
      energy: card.energy,
      power: resolveCardPower(card, catalogPower),
      colors: card.colors,
      type: card.type,
      rarity: card.rarity,
      isSignature: card.isSignature,
      count,
    });
  };

  if (deck.champion) add(deck.champion, 1);
  for (const entry of deck.mainDeck.values()) add(entry.card, entry.count);
  return pool;
}

function domainNames(colors: string[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const color of colors) {
    const name = color.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function addDomainCount(
  target: Map<string, number>,
  colors: string[],
  count: number
): void {
  const names = domainNames(colors);
  if (names.length === 0) {
    target.set(COLORLESS_DOMAIN, (target.get(COLORLESS_DOMAIN) ?? 0) + count);
    return;
  }
  for (const name of names) {
    target.set(name, (target.get(name) ?? 0) + count);
  }
}

function domainSlices(counts: Map<string, number>): DeckStatDomainSlice[] {
  const slices: DeckStatDomainSlice[] = [];
  for (const name of DOMAIN_KEYWORD_NAMES) {
    const count = counts.get(name) ?? 0;
    if (count > 0) slices.push({ domain: name, count });
  }
  for (const [domain, count] of counts) {
    if (count <= 0) continue;
    if (
      DOMAIN_KEYWORD_NAMES.includes(domain as (typeof DOMAIN_KEYWORD_NAMES)[number])
    ) {
      continue;
    }
    if (domain === COLORLESS_DOMAIN) continue;
    slices.push({ domain, count });
  }
  const colorless = counts.get(COLORLESS_DOMAIN) ?? 0;
  if (colorless > 0) slices.push({ domain: COLORLESS_DOMAIN, count: colorless });
  return slices;
}

function primaryCardType(type: string): StatCardType | 'Other' {
  const tokens = new Set(cardTypeTokens(type));
  for (const wanted of STAT_CARD_TYPES) {
    if (tokens.has(wanted.toLowerCase())) return wanted;
  }
  return 'Other';
}

function primaryDomain(colors: string[]): string {
  return domainNames(colors)[0] ?? COLORLESS_DOMAIN;
}

function addPrimaryDomainCount(
  target: Map<string, number>,
  colors: string[],
  count: number
): void {
  const domain = primaryDomain(colors);
  target.set(domain, (target.get(domain) ?? 0) + count);
}

function buildCurve(
  pool: PoolCard[],
  axis: 'energy' | 'power',
  floor: number
): DeckStatBucket[] {
  const maxInPool = pool.reduce((max, card) => Math.max(max, card[axis]), 0);
  const maxValue = Math.max(floor, maxInPool);
  const buckets: DeckStatBucket[] = [];

  for (let value = 0; value <= maxValue; value += 1) {
    const domainCounts = new Map<string, number>();
    const stackCounts = new Map<string, number>();
    let count = 0;
    for (const card of pool) {
      if (card[axis] !== value) continue;
      count += card.count;
      addDomainCount(domainCounts, card.colors, card.count);
      addPrimaryDomainCount(stackCounts, card.colors, card.count);
    }
    buckets.push({
      value,
      count,
      byDomain: domainSlices(domainCounts),
      stack: domainSlices(stackCounts),
    });
  }

  return buckets;
}

function energyBandKey(energy: number): (typeof ENERGY_BANDS)[number]['key'] {
  if (energy <= 2) return 'low';
  if (energy <= 5) return 'mid';
  return 'high';
}

function copyDensityKey(count: number): string {
  if (count <= 1) return '1';
  if (count === 2) return '2';
  if (count === 3) return '3';
  return '4+';
}

function mixItemsFromCounts(
  counts: Map<string, number>,
  order: readonly string[],
  kind: DeckStatMixKind,
  labels?: ReadonlyMap<string, string>
): DeckStatMixItem[] {
  const items: DeckStatMixItem[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    seen.add(key);
    const count = counts.get(key) ?? 0;
    if (count <= 0) continue;
    items.push({
      key,
      label: labels?.get(key) ?? key,
      count,
      kind,
    });
  }
  for (const [key, count] of counts) {
    if (count <= 0 || seen.has(key)) continue;
    items.push({ key, label: labels?.get(key) ?? key, count, kind });
  }
  return items;
}

function weightedAverage(pool: PoolCard[], axis: 'energy' | 'power'): number | null {
  let total = 0;
  let weight = 0;
  for (const card of pool) {
    total += card[axis] * card.count;
    weight += card.count;
  }
  if (weight === 0) return null;
  return total / weight;
}

/** Even integer ceiling so the mid tick stays a whole number of cards. */
export function countScaleMax(maxValue: number): number {
  if (!Number.isFinite(maxValue) || maxValue <= 0) return 4;
  const padded = Math.ceil(maxValue);
  const even = padded % 2 === 0 ? padded : padded + 1;
  return Math.max(4, even);
}

export function countScaleTicks(scaleMax: number): [number, number, number] {
  return [scaleMax, Math.floor(scaleMax / 2), 0];
}

export function formatDeckStatAverage(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(1);
}

export function peakBucketIndex(buckets: readonly DeckStatBucket[]): number {
  let peak = 0;
  let peakCount = -1;
  for (let index = 0; index < buckets.length; index += 1) {
    const count = buckets[index]?.count ?? 0;
    if (count > peakCount) {
      peak = index;
      peakCount = count;
    }
  }
  return peak;
}

/** Curve stats for main deck + chosen champion only (runes/battlefields/legend/sideboard excluded). */
export function computeDeckStats(
  deck: DeckState,
  catalogPower?: DeckStatsCatalogPower
): DeckStats {
  const pool = collectPool(deck, catalogPower);
  const progress = deckSectionProgress(deck, 'mainDeck');
  const domainCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const rarityCounts = new Map<string, number>();
  const bandCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  let dualDomainCount = 0;
  let signatureCount = 0;

  for (const card of pool) {
    addDomainCount(domainCounts, card.colors, card.count);
    const type = primaryCardType(card.type);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + card.count);
    const rarity = card.rarity.trim() || 'Unknown';
    rarityCounts.set(rarity, (rarityCounts.get(rarity) ?? 0) + card.count);
    const band = energyBandKey(card.energy);
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + card.count);
    nameCounts.set(card.name, (nameCounts.get(card.name) ?? 0) + card.count);
    if (domainNames(card.colors).length >= 2) dualDomainCount += card.count;
    if (card.isSignature) signatureCount += card.count;
  }

  const domains = domainSlices(domainCounts).map((slice) => ({
    key: slice.domain,
    label: slice.domain,
    count: slice.count,
    kind:
      slice.domain === COLORLESS_DOMAIN ? ('colorless' as const) : ('domain' as const),
  }));

  const types: DeckStatMixItem[] = [];
  for (const type of STAT_CARD_TYPES) {
    const count = typeCounts.get(type) ?? 0;
    if (count > 0) {
      types.push({ key: type, label: type, count, kind: 'type' });
    }
  }
  const other = typeCounts.get('Other') ?? 0;
  if (other > 0) {
    types.push({ key: 'Other', label: 'Other', count: other, kind: 'type' });
  }

  const cardCount = pool.reduce((sum, card) => sum + card.count, 0);
  const bands: DeckStatMixItem[] =
    cardCount === 0
      ? []
      : ENERGY_BANDS.map((band) => ({
          key: band.key,
          label: band.label,
          count: bandCounts.get(band.key) ?? 0,
          kind: 'mix' as const,
        }));

  const copyCounts = new Map<string, number>();
  for (const count of nameCounts.values()) {
    const key = copyDensityKey(count);
    copyCounts.set(key, (copyCounts.get(key) ?? 0) + 1);
  }
  const copyLabels = new Map([
    ['1', '1-of'],
    ['2', '2-of'],
    ['3', '3-of'],
    ['4+', '4+'],
  ]);
  const copies = mixItemsFromCounts(
    copyCounts,
    ['1', '2', '3', '4+'],
    'mix',
    copyLabels
  );

  const rarities = mixItemsFromCounts(rarityCounts, STAT_RARITIES, 'rarity');

  return {
    cardCount,
    cardTarget: progress.target,
    avgEnergy: weightedAverage(pool, 'energy'),
    avgPower: weightedAverage(pool, 'power'),
    energy: buildCurve(pool, 'energy', ENERGY_CURVE_FLOOR),
    power: buildCurve(pool, 'power', POWER_CURVE_FLOOR),
    domains,
    types,
    bands,
    copies,
    rarities,
    facts: [
      { key: 'unique', label: 'Unique', count: nameCounts.size },
      { key: 'dual', label: 'Dual', count: dualDomainCount },
      { key: 'signature', label: 'Signature', count: signatureCount },
    ],
  };
}

export function catalogPowerByCard(
  items: ReadonlyArray<{ cardId: string; name: string; power: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!map.has(item.cardId)) map.set(item.cardId, item.power);
    if (!map.has(item.name)) map.set(item.name, item.power);
  }
  return map;
}
