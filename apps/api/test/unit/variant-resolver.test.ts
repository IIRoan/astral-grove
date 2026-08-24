import { describe, expect, mock, test } from 'bun:test';
import {
  normalizeVariantNumber,
  VariantResolver,
} from '../../src/services/variant-resolver.js';
import type { Database } from '../../src/db/client.js';
import type { CardCacheService } from '../../src/services/card-cache.js';
import type { PaClient } from '../../src/upstream/pa-client.js';

describe('normalizeVariantNumber', () => {
  test('trims surrounding whitespace', () => {
    expect(normalizeVariantNumber('  OGN-001  ')).toBe('OGN-001');
  });
});

describe('VariantResolver', () => {
  test('resolveVariantNumber is case-insensitive', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [{ variantNumber: 'OGN-001' }],
        }),
      }),
    } as unknown as Database;

    const resolver = new VariantResolver(
      db,
      { upsertFromUpstream: mock(async () => {}) } as unknown as CardCacheService,
      {
        batchCards: mock(async () => ({ data: [], notFound: [] })),
      } as unknown as PaClient
    );

    const lookup = await resolver.loadLookupMap(['ogn-001']);
    expect(resolver.resolveVariantNumber(lookup, 'ogn-001')).toBe('OGN-001');
  });

  test('returns null for unknown variants after lookup', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [],
        }),
      }),
    } as unknown as Database;

    const pa = {
      batchCards: mock(async () => ({ data: [], notFound: ['OGN-999'] })),
      getCard: mock(async () => {
        throw new Error('not found');
      }),
    } as unknown as PaClient;

    const resolver = new VariantResolver(
      db,
      { upsertFromUpstream: mock(async () => {}) } as unknown as CardCacheService,
      pa
    );

    const lookup = await resolver.loadLookupMap(['OGN-999']);
    expect(resolver.resolveVariantNumber(lookup, 'OGN-999')).toBeNull();
  });
});
