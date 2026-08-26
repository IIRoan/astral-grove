import { collectIllegalCardNames, deckHasBannedCards } from '@/lib/card-legality';
import { isBrowseDeck } from '@/lib/deck-browse';
import { getSectionCount } from '@/lib/deck-card';
import { deckSectionProgress } from '@/lib/deck-display';
import type { DeckState, DeckValidationMessage } from '@/lib/deck-types';
import { deckOwnershipTotals, validateDeck } from '@/lib/deck-validation';

export type DeckListStatusTone = 'complete' | 'attention' | 'incomplete' | 'illegal';

export type DeckListStatus = {
  tone: DeckListStatusTone;
  title: string;
  caption: string;
};

const COMPLETENESS_CODES = new Set([
  'missing_legend',
  'missing_champion',
  'main_deck_count',
]);

function isTruncatedBrowsePreview(deck: DeckState): boolean {
  return (
    isBrowseDeck(deck) &&
    getSectionCount(deck, 'runes') === 0 &&
    getSectionCount(deck, 'battlefields') === 0
  );
}

function isCompletenessIssue(message: DeckValidationMessage, deck: DeckState): boolean {
  if (COMPLETENESS_CODES.has(message.code)) return true;
  if (message.code === 'rune_count' || message.code === 'battlefield_count') {
    if (message.type !== 'warning') return false;
    return !isTruncatedBrowsePreview(deck);
  }
  return false;
}

function issueCaption(count: number): string {
  return count === 1 ? '1 issue' : `${Math.max(count, 1)} issues`;
}

function bannedCaption(deck: DeckState): string {
  const names = collectIllegalCardNames(deck);
  const listed = names.length > 0 ? names : (deck.bannedCardNames ?? []);
  if (listed.length === 1) return listed[0] ?? 'Banned cards';
  if (listed.length > 1) return `${listed.length} banned cards`;
  return 'Banned cards';
}

export function deckListIsValid(deck: DeckState): boolean {
  return validateDeck(deck).some((message) => message.code === 'deck_valid');
}

/** Completeness, tournament legality, and collection coverage for owned-deck rows. */
export function deckListStatus(
  deck: DeckState,
  collectionByName: ReadonlyMap<string, number>,
  collectionReady = false
): DeckListStatus {
  const messages = validateDeck(deck);
  const valid = messages.some((message) => message.code === 'deck_valid');
  const ruleErrors = messages.filter(
    (message) => message.type === 'error' && !isCompletenessIssue(message, deck)
  );
  const completenessIssues = messages.filter((message) =>
    isCompletenessIssue(message, deck)
  );
  const ownership = deckOwnershipTotals(deck, collectionByName, collectionReady);
  const main = deckSectionProgress(deck, 'mainDeck');
  const truncatedPreview = isTruncatedBrowsePreview(deck);
  const locallyValid =
    valid ||
    (truncatedPreview && ruleErrors.length === 0 && completenessIssues.length === 0);

  if (deckHasBannedCards(deck)) {
    return {
      tone: 'illegal',
      title: 'Illegal',
      caption: bannedCaption(deck),
    };
  }

  if (deck.isLegal === false) {
    return {
      tone: 'illegal',
      title: 'Illegal',
      caption: 'Not tournament legal',
    };
  }

  if (isBrowseDeck(deck) && deck.isLegal === true && truncatedPreview) {
    return {
      tone: 'complete',
      title: 'Complete',
      caption: 'List is legal',
    };
  }

  if (ruleErrors.length > 0) {
    return {
      tone: 'illegal',
      title: 'Illegal',
      caption: issueCaption(ruleErrors.length),
    };
  }

  if (!locallyValid || completenessIssues.length > 0) {
    return {
      tone: 'incomplete',
      title: 'Incomplete',
      caption:
        main.current >= main.target
          ? issueCaption(completenessIssues.length)
          : `Main ${main.current}/${main.target}`,
    };
  }

  if (ownership && ownership.required > 0 && ownership.missing > 0) {
    return {
      tone: 'attention',
      title: 'Missing copies',
      caption:
        ownership.missing === 1 ? '1 copy short' : `${ownership.missing} copies short`,
    };
  }

  if (ownership && ownership.required > 0 && ownership.missing === 0) {
    return {
      tone: 'complete',
      title: 'Complete',
      caption: 'All copies owned',
    };
  }

  return {
    tone: 'complete',
    title: 'Complete',
    caption: 'List is legal',
  };
}
