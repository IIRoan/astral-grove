import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { isSignatureCard } from './deck-rules.js';
import {
  lexicalRelevanceScore,
  normalizeSearchText,
  parseSearchQuery,
} from './search-query.js';

// Same file is asserted by the Rust tests in apps/backend (search.rs, decks/upstream.rs).
const Fixture = z.object({
  normalize: z.array(z.object({ input: z.string(), expected: z.string() })),
  parse: z.array(
    z.object({
      input: z.string(),
      identity: z.array(z.string()),
      intents: z.array(z.string()),
    })
  ),
  signature: z.array(
    z.object({
      super: z.string().nullable(),
      rarity: z.string(),
      variantType: z.string(),
      expected: z.boolean(),
    })
  ),
  cards: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      super: z.string().nullable(),
      tags: z.array(z.string()),
      variantNumber: z.string(),
      variantType: z.string(),
      variantLabel: z.string(),
      printings: z.array(
        z.object({ variantNumber: z.string(), variantLabel: z.string() })
      ),
    })
  ),
  score: z.array(z.object({ query: z.string(), tiers: z.array(z.number()) })),
});

const fixture = Fixture.parse(
  JSON.parse(
    readFileSync(
      new URL('../fixtures/search-rules-parity.json', import.meta.url),
      'utf8'
    )
  )
);

describe('search and rules parity fixture', () => {
  test('normalizes text like the backend', () => {
    for (const { input, expected } of fixture.normalize) {
      expect(normalizeSearchText(input)).toBe(expected);
    }
  });

  test('parses queries like the backend', () => {
    for (const { input, identity, intents } of fixture.parse) {
      const parsed = parseSearchQuery(input);
      expect([parsed.identityTokens, parsed.typeIntents]).toEqual([identity, intents]);
    }
  });

  test('detects Signature cards like the backend', () => {
    for (const { expected, ...card } of fixture.signature) {
      expect(isSignatureCard(card)).toBe(expected);
    }
  });

  test('ranks cards into the same relevance tiers as the backend', () => {
    for (const { query, tiers } of fixture.score) {
      expect(fixture.cards.map((card) => lexicalRelevanceScore(card, query))).toEqual(
        tiers
      );
    }
  });
});
