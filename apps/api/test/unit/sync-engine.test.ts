import { describe, expect, test } from 'bun:test';
import type { FilterSnapshot } from '@riftbound/contracts';
import { catalogFingerprint } from '../../src/lib/hash.js';
import { CATALOG_UPSTREAM_KEY, SyncEngine } from '../../src/services/sync-engine.js';

const filters: FilterSnapshot = {
  colors: [],
  sets: [{ id: 'ogn', name: 'Origins', code: 'OGN', count: 2, printCount: 2 }],
  types: [],
  supertypes: [],
  rarities: [],
  variants: [],
};

const upstreamTotal = 2;
const fingerprint = catalogFingerprint(upstreamTotal, filters);

type SyncRow = { contentHash: string; rowCount?: number; lastSuccessAt?: Date | null };

function logicalCard(id: string, variantNumbers: string[]) {
  return {
    id,
    variants: variantNumbers.map((variantNumber) => ({
      id: `${id}-${variantNumber}`,
      variantNumber,
      isCollectible: true,
      set: { prefix: 'OGN' },
    })),
  };
}

function createEngine(options: {
  rows?: Record<string, SyncRow>;
  localVariantCount?: number;
  localHash?: string;
}) {
  const rows = new Map(Object.entries(options.rows ?? {}));
  const upserted: string[] = [];
  const getCardCalls: string[] = [];
  let localVariantCount = options.localVariantCount ?? 0;

  const cardsById: Record<string, ReturnType<typeof logicalCard>> = {
    'OGN-001': logicalCard('card-a', ['OGN-001', 'OGN-001a']),
    'OGN-001a': logicalCard('card-a', ['OGN-001', 'OGN-001a']),
  };

  const pa = {
    listCards: async (params: { limit?: number }) => ({
      pagination: { total: upstreamTotal, page: 1, totalPages: 1, hasNext: false },
      meta: { filters },
      data:
        params.limit === 1
          ? []
          : [{ variantNumber: 'OGN-001' }, { variantNumber: 'OGN-001a' }],
    }),
    getCard: async (variantNumber: string) => {
      getCardCalls.push(variantNumber);
      const card = cardsById[variantNumber];
      if (!card) throw new Error(`unknown ${variantNumber}`);
      return card;
    },
  };

  const cards = {
    countVariants: async () => localVariantCount,
    upsertFromUpstream: async (card: { id: string; variants: unknown[] }) => {
      upserted.push(card.id);
      localVariantCount = card.variants.length;
      return true;
    },
    computeLocalCatalogHash: async () =>
      options.localHash ?? `local-${String(localVariantCount)}`,
    invalidateSearchCache: () => undefined,
  };

  const catalogMetadata = {
    ensureExpandedPrintCounts: async () => filters,
  };

  const engine = new SyncEngine(
    {} as never,
    pa as never,
    cards as never,
    catalogMetadata as never
  );

  const internals = engine as unknown as {
    readSyncState: (key: string) => Promise<SyncRow | undefined>;
    setSyncStatus: (
      key: string,
      status: string,
      extra?: { contentHash?: string; rowCount?: number; lastSuccessAt?: Date }
    ) => Promise<void>;
  };
  internals.readSyncState = async (key) => rows.get(key);
  internals.setSyncStatus = async (key, _status, extra) => {
    const previous = rows.get(key);
    rows.set(key, {
      contentHash: extra?.contentHash ?? previous?.contentHash ?? '',
      rowCount: extra?.rowCount ?? previous?.rowCount ?? 0,
      lastSuccessAt: extra?.lastSuccessAt ?? previous?.lastSuccessAt ?? null,
    });
  };

  return { engine, rows, upserted, getCardCalls };
}

describe('SyncEngine.syncCatalog', () => {
  test('upserts cards when only the metadata probe has seen the new upstream fingerprint', async () => {
    const { engine, upserted } = createEngine({
      // Legacy state: the probe used to write the upstream fingerprint onto the catalog row.
      rows: { catalog: { contentHash: fingerprint, rowCount: 2 } },
      localVariantCount: 5,
    });

    const result = await engine.syncCatalog();

    expect(result.changed).toBe(true);
    expect(upserted).toEqual(['card-a']);
  });

  test('publishes a local catalog hash so clients refetch after new cards land', async () => {
    const { engine, rows } = createEngine({
      rows: { catalog: { contentHash: 'local-0' } },
    });

    const result = await engine.syncCatalog();

    expect(result.hash).toBe('local-2');
    expect(rows.get('catalog')?.contentHash).toBe('local-2');
    expect(rows.get(CATALOG_UPSTREAM_KEY)?.contentHash).toBe(fingerprint);
  });

  test('fetches each logical card once even when upstream lists several printings', async () => {
    const { engine, getCardCalls } = createEngine({});

    await engine.syncCatalog();

    expect(getCardCalls).toEqual(['OGN-001']);
  });

  test('skips the upsert when the upstream fingerprint was already fully synced', async () => {
    const { engine, upserted, rows } = createEngine({
      rows: {
        catalog: { contentHash: 'stale-local', rowCount: 2 },
        [CATALOG_UPSTREAM_KEY]: { contentHash: fingerprint, rowCount: 2 },
      },
      localVariantCount: 2,
      localHash: 'fresh-local',
    });

    const result = await engine.syncCatalog();

    expect(result.changed).toBe(false);
    expect(upserted).toEqual([]);
    expect(result.hash).toBe('fresh-local');
    expect(rows.get('catalog')?.contentHash).toBe('fresh-local');
    expect(rows.get('catalog')?.lastSuccessAt).toBeInstanceOf(Date);
  });
});
