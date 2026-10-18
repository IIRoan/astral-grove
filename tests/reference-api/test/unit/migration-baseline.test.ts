import { describe, expect, test } from 'bun:test';
import { assertAdmin } from '../../src/lib/admin-token';
import { isProfile } from '../../src/lib/internal-release';
import { createSlidingWindowLimiter } from '../../src/lib/rate-limit';
import { TtlCache } from '../../src/lib/ttl-cache';
import { resolvePasswordResetAppUrl } from '../../src/lib/password-reset-email';
import { resolveVerificationAppUrl } from '../../src/lib/verification-email';
import { loadEnv } from '../../src/env';
import {
  groupSearchCandidateRows,
  sortCandidateGroupsByEnergy,
  sortCandidateGroupsByVariantNumber,
} from '../../src/lib/search-candidates';
import {
  buildSearchFilterWhere,
  buildSearchTypeIntentWhere,
  buildSearchCandidateQueryUnsorted,
} from '../../src/lib/search-sql';
import { createDb } from '../../src/db/client';
import { CardsListQuery } from '@riftbound/contracts';

function environment() {
  const original = { ...process.env };
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://riftbound:riftbound@127.0.0.1:5433/riftbound_test',
    PA_API_KEY: 'ak_synthetic',
    ADMIN_SYNC_TOKEN: 'synthetic-baseline-admin',
    BETTER_AUTH_SECRET: 'synthetic-baseline-secret-more-than-32-characters',
    PUBLIC_APP_URL: 'http://localhost:7001',
  });
  try {
    return loadEnv();
  } finally {
    process.env = original;
  }
}
describe('backend migration baseline helpers', () => {
  test('admin assertions reject missing and incorrect credentials', () => {
    const env = environment();
    expect(() => assertAdmin(env, undefined)).toThrow('Unauthorized');
    expect(() => assertAdmin(env, 'Bearer wrong')).toThrow('Unauthorized');
    expect(() => assertAdmin(env, `Bearer ${env.ADMIN_SYNC_TOKEN}`)).not.toThrow();
  });
  test('internal build profiles are an explicit allowlist', () => {
    expect(isProfile('preview')).toBe(true);
    expect(isProfile('development')).toBe(true);
    for (const value of [undefined, 'production', '../preview', ''])
      expect(isProfile(value)).toBe(false);
  });
  test('resetting a limiter clears exhausted buckets', () => {
    const limiter = createSlidingWindowLimiter({
      windowMs: 1000,
      max: 1,
      now: () => 100,
    });
    expect(limiter.check('one').allowed).toBe(true);
    expect(limiter.check('one').allowed).toBe(false);
    limiter.reset();
    expect(limiter.check('one').allowed).toBe(true);
  });
  test('cache size tracks eviction and deletion', () => {
    const cache = new TtlCache<string>(1000, 1);
    cache.set('a', 'one');
    expect(cache.size).toBe(1);
    cache.set('b', 'two');
    expect(cache.size).toBe(1);
    expect(cache.get('a')).toBeUndefined();
    cache.delete('b');
    expect(cache.size).toBe(0);
  });
  test('transactional links use the resolved public app URL', () => {
    const env = environment();
    expect(resolveVerificationAppUrl(env)).toBe('http://localhost:7001');
    expect(resolvePasswordResetAppUrl(env)).toBe('http://localhost:7001');
  });
  test('candidate ordering preserves energy ties and printing order', () => {
    const base = {
      cardId: 'one',
      type: 'Unit',
      super: null,
      variantId: 'one',
      variantType: 'Standard',
      foilMode: 'none',
      variantLabel: 'Standard',
      cardmarketId: null,
    };
    const groups = groupSearchCandidateRows([
      { ...base, name: 'Zed', energy: 3, variantNumber: 'OGN-002' },
      { ...base, cardId: 'two', name: 'Ahri', energy: 3, variantNumber: 'OGN-001' },
      { ...base, cardId: 'three', name: 'Vi', energy: 1, variantNumber: 'OGN-003' },
    ]);
    expect(
      sortCandidateGroupsByEnergy(groups, 'asc').map((g) => g.rows[0]?.name)
    ).toEqual(['Vi', 'Ahri', 'Zed']);
    expect(
      sortCandidateGroupsByEnergy(groups, 'desc').map((g) => g.rows[0]?.name)
    ).toEqual(['Ahri', 'Zed', 'Vi']);
    expect(
      sortCandidateGroupsByVariantNumber(groups, 'asc').map((g) => g.rows[0]?.name)
    ).toEqual(['Ahri', 'Zed', 'Vi']);
    expect(
      sortCandidateGroupsByVariantNumber(groups, 'desc').map((g) => g.rows[0]?.name)
    ).toEqual(['Vi', 'Zed', 'Ahri']);
  });
  test('unsorted search SQL retains filters without embedding search text', async () => {
    const env = environment();
    const { db, client } = createDb(env);
    try {
      const query = CardsListQuery.parse({ q: 'legend', sets: 'OGN' });
      const filter = buildSearchFilterWhere(query);
      expect(filter).toBeDefined();
      expect(buildSearchTypeIntentWhere(query)).toBeDefined();
      expect(
        buildSearchTypeIntentWhere(CardsListQuery.parse({ q: ' ' }))
      ).toBeUndefined();
      const sql = buildSearchCandidateQueryUnsorted(db, filter).toSQL();
      expect(sql.params).toContain('OGN');
      expect(sql.params).not.toContain('legend');
      expect(sql.sql).not.toContain('order by');
    } finally {
      await client.end();
    }
  });
});

test('missing deck storage returns the established migration error', async () => {
  const { createDecksRoutes } = await import('../../src/routes/decks');
  const { DeckService } = await import('../../src/services/deck-service');
  const { db, client } = createDb(environment());
  const service = new DeckService(db);
  service.listForUser = async () => {
    throw new Error('relation user_decks does not exist');
  };
  try {
    const routes = createDecksRoutes(service, {
      api: {
        getSession: async () => ({
          user: {
            id: 'fixture-user',
            name: 'Fixture',
            email: 'fixture@example.invalid',
          },
          session: {
            id: 'fixture-session',
            userId: 'fixture-user',
            expiresAt: new Date(Date.now() + 60_000),
          },
        }),
      },
      handler: () => new Response(null),
    });
    const response = await routes.handle(new Request('http://localhost/api/v1/decks'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'DECKS_STORAGE_UNAVAILABLE',
      message: 'Deck storage is not migrated yet. Run database migrations.',
    });
  } finally {
    await client.end();
  }
});
