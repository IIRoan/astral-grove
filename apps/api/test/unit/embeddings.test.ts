import { describe, expect, test } from 'bun:test';
import {
  LOCAL_EMBEDDING_MODEL,
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
  test('versions the local model with the shared normalizer', () => {
    expect(LOCAL_EMBEDDING_MODEL).toBe('local-hash-v2-norm-v1');
    expect(localEmbed('Ambéssa')).toEqual(localEmbed('Ambessa'));
  });
});

test('summarizes Railway extension availability without requiring pgvector', () => {
  expect(summarizeSearchExtensions(['pg_trgm'])).toBe(
    'pg_trgm=true unaccent=false vector=false storage=real[]'
  );
  expect(summarizeSearchExtensions(['pg_trgm', 'unaccent', 'vector'])).toContain(
    'unaccent=true'
  );
});

