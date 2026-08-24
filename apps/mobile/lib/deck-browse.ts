import type { DeckBrowseFilters } from '@/constants/deckBrowse';
import { formatDeckBrowseSetSelection } from '@/constants/deckBrowse';
import type { DeckState } from '@/lib/deck-types';

export type DeckBrowseFilterSegment = 'legends' | 'sets' | 'legality' | 'content';

export const DECK_BROWSE_FILTER_SEGMENTS: {
  id: DeckBrowseFilterSegment;
  label: string;
}[] = [
  { id: 'legends', label: 'Legends' },
  { id: 'sets', label: 'Sets' },
  { id: 'legality', label: 'Legality' },
  { id: 'content', label: 'Content' },
];

export function formatDeckStatCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value < 1000) return String(value);
  if (value < 10_000) {
    const compact = value / 1000;
    return `${compact >= 10 ? compact.toFixed(0) : compact.toFixed(1)}k`;
  }
  if (value < 1_000_000) return `${Math.round(value / 1000)}k`;
  return `${(value / 1_000_000).toFixed(1)}m`;
}

export function formatDeckRelativeTime(
  updatedAtMs: number,
  nowMs = Date.now()
): string {
  const deltaMs = Math.max(0, nowMs - updatedAtMs);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `about ${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(months / 12);
  return `about ${years} year${years === 1 ? '' : 's'} ago`;
}

export function isBrowseDeck(deck: DeckState): boolean {
  return deck.readOnly === true && deck.source === 'imported';
}

export function deckBrowseSummaryLine(deck: DeckState): string | null {
  if (!isBrowseDeck(deck)) return null;

  const parts: string[] = [];
  if (deck.authorName) parts.push(`by ${deck.authorName}`);
  if (deck.views !== undefined) parts.push(`${formatDeckStatCount(deck.views)} views`);
  if (deck.likes !== undefined) parts.push(`${formatDeckStatCount(deck.likes)} likes`);
  parts.push(formatDeckRelativeTime(deck.updatedAt));

  return parts.join(' · ');
}

export function deckArchiveViewUrl(deckId: string): string {
  return `https://piltoverarchive.com/decks/view/${encodeURIComponent(deckId)}`;
}

export function deckBrowseFilterSegmentActive(
  segment: DeckBrowseFilterSegment,
  filters: DeckBrowseFilters
): boolean {
  switch (segment) {
    case 'legends':
      return Boolean(filters.legend);
    case 'sets':
      return filters.sets.length > 0;
    case 'legality':
      return filters.isLegal !== undefined;
    case 'content':
      return filters.hasGuide || filters.hasVideo || filters.hasMatchups;
    default:
      return false;
  }
}

export function deckBrowseFilterSegmentSummary(
  segment: DeckBrowseFilterSegment,
  filters: DeckBrowseFilters,
  setNameByCode: ReadonlyMap<string, string> = new Map()
): string | undefined {
  switch (segment) {
    case 'legends':
      return filters.legend;
    case 'sets':
      return filters.sets.length > 0
        ? formatDeckBrowseSetSelection(filters.sets, setNameByCode)
        : undefined;
    case 'legality':
      if (filters.isLegal === true) return 'Legal only';
      if (filters.isLegal === false) return 'Not legal';
      return undefined;
    case 'content': {
      const parts: string[] = [];
      if (filters.hasGuide) parts.push('Guide');
      if (filters.hasVideo) parts.push('Video');
      if (filters.hasMatchups) parts.push('Matchups');
      return parts.length > 0 ? parts.join(', ') : undefined;
    }
    default:
      return undefined;
  }
}
