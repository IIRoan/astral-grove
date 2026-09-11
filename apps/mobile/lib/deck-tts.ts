import { toDeckCodeCardCode } from '@/lib/deck-codes';
import type { DeckState } from '@/lib/deck-types';

const TTS_BASE = /^([A-Za-z]+)-((?:R|SP)?\d+)([a-z*]?)$/i;

function ttsArtIndex(letter: string | undefined): 1 | 2 | 3 {
  const suffix = letter?.toLowerCase();
  if (suffix === 'a') return 2;
  if (suffix === 'b') return 3;
  return 1;
}

/** PA TTS tokens are `SET-NUMBER-ART` with 1 = base, 2 = a, 3 = b. */
export function toTtsCardToken(variantNumber: string): string {
  const encoded = toDeckCodeCardCode(variantNumber);
  const match = encoded.match(TTS_BASE);
  if (!match) return `${encoded}-1`;
  const set = match[1]!.toUpperCase();
  const number = match[2]!;
  return `${set}-${number}-${ttsArtIndex(match[3])}`;
}

function pushCopies(tokens: string[], variantNumber: string, count: number): void {
  const token = toTtsCardToken(variantNumber);
  for (let i = 0; i < count; i++) tokens.push(token);
}

export function exportDeckTts(deck: DeckState): string {
  const tokens: string[] = [];

  if (deck.legend) {
    pushCopies(tokens, deck.legend.variantNumber, 1);
  }

  const championToken = deck.champion
    ? toTtsCardToken(deck.champion.variantNumber)
    : null;
  let championCount = deck.champion ? 1 : 0;
  const rest: { token: string; count: number }[] = [];

  for (const [, entry] of deck.mainDeck) {
    const token = toTtsCardToken(entry.card.variantNumber);
    if (championToken && token === championToken) {
      championCount += entry.count;
    } else {
      rest.push({ token, count: entry.count });
    }
  }

  if (championToken && championCount > 0) {
    for (let i = 0; i < championCount; i++) tokens.push(championToken);
  }
  for (const { token, count } of rest) {
    for (let i = 0; i < count; i++) tokens.push(token);
  }

  for (const [, entry] of deck.battlefields) {
    pushCopies(tokens, entry.card.variantNumber, entry.count);
  }
  for (const [, entry] of deck.runes) {
    pushCopies(tokens, entry.card.variantNumber, entry.count);
  }
  for (const [, entry] of deck.sideboard) {
    pushCopies(tokens, entry.card.variantNumber, entry.count);
  }

  return tokens.join(' ');
}
