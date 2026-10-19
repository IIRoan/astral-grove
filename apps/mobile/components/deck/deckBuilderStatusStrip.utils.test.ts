import { describe, expect, test } from 'bun:test';
import { createEmptyDeck } from '@/lib/deck-card';
import { deckBuilderHeadlineStats } from './deckBuilderStatusStrip.utils';

describe('deckBuilderHeadlineStats', () => {
  test('shows the format sideboard limit, and no limit for Pre-Rift', () => {
    const deck = createEmptyDeck();
    expect(deckBuilderHeadlineStats(deck)).toEndWith('Side 0/10');
    expect(deckBuilderHeadlineStats({ ...deck, format: 'pre-rift' })).toEndWith(
      'Side 0'
    );
  });
});
