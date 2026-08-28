import { describe, expect, test } from 'bun:test';
import {
  localEmbed,
  rankEmbeddings,
  summarizeSearchExtensions,
} from '../../src/services/embeddings.js';

describe('localEmbed', () => {
  test('is deterministic and L2-normalized', () => {
    const first = localEmbed('Ready a unit when you empower');
    const second = localEmbed('Ready a unit when you empower');
    expect(first).toEqual(second);
    const norm = Math.sqrt(first.reduce((sum, value) => sum + value * value, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  test('ranks overlapping rules text above unrelated names', () => {
    const query = localEmbed('ready a unit');
    const ranked = rankEmbeddings(query, [
      { id: 'unrelated', embedding: localEmbed('Draw two cards') },
      { id: 'match', embedding: localEmbed('Disempower me: Ready a unit.') },
    ]);
    expect(ranked[0]?.id).toBe('match');
  });
});

test('summarizes Railway extension availability without requiring pgvector', () => {
  expect(summarizeSearchExtensions(['pg_trgm'])).toBe(
    'pg_trgm=true vector=false storage=real[]'
  );
  expect(summarizeSearchExtensions(['pg_trgm', 'vector'])).toContain('vector=true');
});
