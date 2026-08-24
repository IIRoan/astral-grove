import { addCardToDeck, createEmptyDeck, sectionForCardType } from '@/lib/deck-card';
import { mapPool } from '@/lib/asyncPool';
import {
  importDeckCode,
  looksLikeDeckCode,
  type VariantResolver,
} from '@/lib/deck-codes';
import type { DeckCard, DeckSectionKey, DeckState } from '@/lib/deck-types';

export type CardResolver = (name: string) => Promise<DeckCard | null> | DeckCard | null;

async function resolveCardByNames(
  resolveCard: CardResolver,
  names: string[]
): Promise<DeckCard | null> {
  const results = await Promise.all(names.map((name) => resolveCard(name)));
  for (const card of results) {
    if (card) return card;
  }
  return null;
}

function formatPAName(name: string): string {
  return name.replace(' - ', ', ');
}

function parsePAName(paName: string): string {
  return paName.replace(', ', ' - ');
}

export function exportPiltoverArchive(deck: DeckState): string {
  const sections: string[] = [];

  if (deck.legend) {
    sections.push(`Legend:\n1 ${formatPAName(deck.legend.name)}`);
  }
  if (deck.champion) {
    sections.push(`Champion:\n1 ${formatPAName(deck.champion.name)}`);
  }

  const mainLines = [...deck.mainDeck.values()].map(
    (entry) => `${entry.count} ${formatPAName(entry.card.name)}`
  );
  if (mainLines.length) sections.push(`MainDeck:\n${mainLines.join('\n')}`);

  const battlefieldLines = [...deck.battlefields.values()].map(
    (entry) => `${entry.count} ${formatPAName(entry.card.name)}`
  );
  if (battlefieldLines.length) {
    sections.push(`Battlefields:\n${battlefieldLines.join('\n')}`);
  }

  const runeLines = [...deck.runes.values()].map(
    (entry) => `${entry.count} ${formatPAName(entry.card.name)}`
  );
  if (runeLines.length) sections.push(`Runes:\n${runeLines.join('\n')}`);

  const sideboardLines = [...deck.sideboard.values()].map(
    (entry) => `${entry.count} ${formatPAName(entry.card.name)}`
  );
  if (sideboardLines.length) {
    sections.push(`Sideboard:\n${sideboardLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

export async function importPiltoverArchive(
  text: string,
  resolveCard: CardResolver
): Promise<{ deck: DeckState; unresolved: string[] }> {
  let deck = createEmptyDeck();
  const unresolved: string[] = [];

  const sectionMap: Record<string, DeckSectionKey> = {
    legend: 'legend',
    champion: 'champion',
    maindeck: 'mainDeck',
    battlefields: 'battlefields',
    runes: 'runes',
    sideboard: 'sideboard',
  };

  type ParsedLine = { count: number; rawName: string; section: DeckSectionKey };
  const parsedLines: ParsedLine[] = [];
  let currentSection: DeckSectionKey | null = null;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch = line.match(/^([A-Za-z]+):$/);
    if (headerMatch) {
      currentSection = sectionMap[headerMatch[1].toLowerCase()] ?? null;
      continue;
    }

    if (!currentSection) continue;

    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) continue;

    parsedLines.push({
      count: Number.parseInt(match[1], 10),
      rawName: match[2].trim(),
      section: currentSection,
    });
  }

  const uniqueNames = [...new Set(parsedLines.map((entry) => entry.rawName))];
  const resolvedCards = await mapPool(uniqueNames, 6, (rawName) =>
    resolveCardByNames(resolveCard, [parsePAName(rawName), rawName])
  );
  const cardByName = new Map(
    uniqueNames.map((rawName, index) => [rawName, resolvedCards[index] ?? null])
  );

  for (const { count, rawName, section } of parsedLines) {
    const card = cardByName.get(rawName) ?? null;

    if (!card) {
      unresolved.push(rawName);
      continue;
    }

    if (section === 'legend') {
      deck = { ...deck, legend: card };
    } else if (section === 'champion') {
      deck = { ...deck, champion: card };
    } else {
      deck = addCardToDeck(deck, card, { section, count });
    }
  }

  return { deck, unresolved };
}

export async function importFlatDeckList(
  text: string,
  resolveCard: CardResolver
): Promise<{ deck: DeckState; unresolved: string[] }> {
  let deck = createEmptyDeck();
  const unresolved: string[] = [];

  type ParsedLine = { count: number; name: string; inSideboard: boolean };
  const parsedLines: ParsedLine[] = [];
  let inSideboard = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/^\/\/\s*sideboard/i.test(line)) {
      inSideboard = true;
      continue;
    }

    const match = line.match(/^(\d+)\s+(.+?)\s+\(([A-Za-z0-9-]+)\)$/i);
    if (!match) continue;

    parsedLines.push({
      count: Number.parseInt(match[1], 10),
      name: match[2].trim(),
      inSideboard,
    });
  }

  const uniqueNames = [...new Set(parsedLines.map((entry) => entry.name))];
  const resolvedCards = await mapPool(uniqueNames, 6, (name) =>
    resolveCardByNames(resolveCard, [name, parsePAName(name)])
  );
  const cardByName = new Map(
    uniqueNames.map((name, index) => [name, resolvedCards[index] ?? null])
  );

  for (const { count, name, inSideboard: sideboardLine } of parsedLines) {
    const card = cardByName.get(name) ?? null;

    if (!card) {
      unresolved.push(name);
      continue;
    }

    if (sideboardLine) {
      deck = addCardToDeck(deck, card, { section: 'sideboard', count });
    } else {
      const section = sectionForCardType(card);
      if (section === 'legend') {
        deck = { ...deck, legend: card };
      } else if (section === 'champion') {
        deck = { ...deck, champion: card };
      } else {
        deck = addCardToDeck(deck, card, { section, count });
      }
    }
  }

  return { deck, unresolved };
}

export type DeckImportFormat = 'deckcode' | 'piltoverarchive' | 'flat';

export function detectDeckImportFormat(text: string): DeckImportFormat {
  if (looksLikeDeckCode(text)) return 'deckcode';
  if (/^(Legend|Champion|MainDeck|Battlefields|Runes|Sideboard):/im.test(text)) {
    return 'piltoverarchive';
  }
  return 'flat';
}

export async function importDeckText(
  text: string,
  resolveCard: CardResolver,
  resolveVariant?: VariantResolver
): Promise<{ deck: DeckState; unresolved: string[] }> {
  const format = detectDeckImportFormat(text);
  if (format === 'deckcode') {
    if (!resolveVariant) {
      throw new Error('Deck code import requires a variant resolver.');
    }
    return importDeckCode(text, resolveVariant);
  }
  if (format === 'piltoverarchive') {
    return importPiltoverArchive(text, resolveCard);
  }
  return importFlatDeckList(text, resolveCard);
}
