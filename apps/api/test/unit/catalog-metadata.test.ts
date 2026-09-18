import { afterEach, describe, expect, test } from 'bun:test';
import type { FilterSnapshot } from '@riftbound/contracts';
import { catalogFingerprint } from '../../src/lib/hash.js';
import { CatalogMetadataService } from '../../src/services/catalog-metadata.js';

const baseFilters: FilterSnapshot = {
  colors: [{ id: 'fury', name: 'Fury', count: 10 }],
  sets: [{ id: 'ogn', name: 'Origins', code: 'OGN', count: 100 }],
  types: [{ id: 'unit', name: 'Unit', count: 50 }],
  supertypes: [],
  rarities: [{ id: 'common', name: 'Common', count: 40 }],
  variants: [{ id: 'standard', name: 'Standard', count: 80 }],
};

const enrichedFilters: FilterSnapshot = {
  ...baseFilters,
  sets: baseFilters.sets.map((set) => ({ ...set, printCount: 200 })),
};

const catalogTotal = 500;
const matchingFingerprint = catalogFingerprint(catalogTotal, baseFilters);

type ServiceOptions = {
  latestSnapshot?: FilterSnapshot | null;
  syncStateRows?: Array<{
    key: string;
    contentHash: string;
    rowCount?: number;
  } | null>;
  localSetCounts?: Array<{ code: string; name: string; printCount: number }>;
  probeDelayMs?: number;
  probeDisabled?: boolean;
};

function createService(options?: ServiceOptions) {
  const probeDelayMs = options?.probeDelayMs ?? 40;
  let probeCalls = 0;
  let syncStateCalls = 0;
  let localAggregateCalls = 0;

  const pa = {
    listCards: async () => ({
      pagination: { total: catalogTotal, page: 1, limit: 1, hasNext: false },
      meta: { filters: baseFilters },
      data: [],
    }),
  };

  const db = {
    query: {
      filterSnapshots: {
        findFirst: async () =>
          options?.latestSnapshot
            ? { snapshot: options.latestSnapshot, capturedAt: new Date('2026-01-01') }
            : null,
      },
      syncState: {
        findFirst: async () => {
          const row = options?.syncStateRows?.[syncStateCalls] ?? null;
          syncStateCalls += 1;
          return row;
        },
      },
    },
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          groupBy: async () => {
            localAggregateCalls += 1;
            return (options?.localSetCounts ?? []).map((row) => ({
              code: row.code,
              name: row.name,
              printCount: row.printCount,
              foilPrintCount: 0,
            }));
          },
        }),
      }),
    }),
    insert: () => ({
      values: async () => undefined,
    }),
  };

  const previousProbeDisabled = process.env.CATALOG_PROBE_DISABLED;
  if (options?.probeDisabled) {
    process.env.CATALOG_PROBE_DISABLED = 'true';
  } else {
    delete process.env.CATALOG_PROBE_DISABLED;
  }

  const service = new CatalogMetadataService(db as never, pa as never);

  (
    service as unknown as {
      runProbe: (
        baseFilters: FilterSnapshot,
        fingerprint: string
      ) => Promise<FilterSnapshot>;
    }
  ).runProbe = async () => {
    probeCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, probeDelayMs));
    return enrichedFilters;
  };

  return {
    service,
    getProbeCalls: () => probeCalls,
    getLocalAggregateCalls: () => localAggregateCalls,
    restoreEnv: () => {
      if (previousProbeDisabled === undefined) {
        delete process.env.CATALOG_PROBE_DISABLED;
      } else {
        process.env.CATALOG_PROBE_DISABLED = previousProbeDisabled;
      }
    },
  };
}

afterEach(() => {
  delete process.env.CATALOG_PROBE_DISABLED;
});

describe('CatalogMetadataService', () => {
  test('getFiltersSnapshot returns upstream filters immediately while probe runs', async () => {
    const { service } = createService({ latestSnapshot: null, syncStateRows: [null] });

    const started = performance.now();
    const snapshot = await service.getFiltersSnapshot();
    const elapsed = performance.now() - started;

    expect(snapshot.sets[0]?.code).toBe('OGN');
    expect(snapshot.sets[0]?.printCount).toBeUndefined();
    expect(elapsed).toBeLessThan(30);
  });

  test('getFiltersSnapshot returns cached enriched snapshot without probing', async () => {
    const { service, getProbeCalls } = createService({
      latestSnapshot: enrichedFilters,
      syncStateRows: [
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
      ],
    });

    const snapshot = await service.getFiltersSnapshot();

    expect(snapshot.sets[0]?.printCount).toBe(200);
    expect(getProbeCalls()).toBe(0);
  });

  test('getFiltersSnapshot returns stale cached snapshot while re-probe runs in background', async () => {
    const staleSnapshot: FilterSnapshot = {
      ...baseFilters,
      sets: baseFilters.sets.map((set) => ({ ...set, printCount: 150 })),
    };
    const { service, getProbeCalls } = createService({
      latestSnapshot: staleSnapshot,
      syncStateRows: [{ key: 'catalog', contentHash: 'outdated-hash', rowCount: 1396 }],
    });

    const started = performance.now();
    const snapshot = await service.getFiltersSnapshot();
    const elapsed = performance.now() - started;

    expect(snapshot.sets[0]?.printCount).toBe(150);
    expect(elapsed).toBeLessThan(30);
    expect(getProbeCalls()).toBe(1);
  });

  test('concurrent getFiltersSnapshot calls schedule only one probe', async () => {
    const { service, getProbeCalls } = createService({
      latestSnapshot: null,
      syncStateRows: [null],
      probeDelayMs: 60,
    });

    const [first, second] = await Promise.all([
      service.getFiltersSnapshot(),
      service.getFiltersSnapshot(),
    ]);

    expect(first.sets[0]?.code).toBe('OGN');
    expect(second.sets[0]?.code).toBe('OGN');
    expect(getProbeCalls()).toBe(1);
  });

  test('ensureExpandedPrintCounts still waits for probe completion', async () => {
    const { service } = createService({
      latestSnapshot: null,
      syncStateRows: [null],
      probeDelayMs: 40,
    });

    const started = performance.now();
    const snapshot = await service.ensureExpandedPrintCounts();
    const elapsed = performance.now() - started;

    expect(snapshot.sets[0]?.printCount).toBe(200);
    expect(elapsed).toBeGreaterThanOrEqual(35);
  });

  test('getFiltersMeta responds without waiting for probe', async () => {
    const { service } = createService({
      latestSnapshot: null,
      syncStateRows: [null, null, null, { key: 'prices', contentHash: 'prices-hash' }],
      probeDelayMs: 80,
    });

    const started = performance.now();
    const meta = await service.getFiltersMeta();
    const elapsed = performance.now() - started;

    expect(meta.snapshot.sets[0]?.code).toBe('OGN');
    expect(meta.pricesCatalogHash).toBe('prices-hash');
    expect(meta.catalogHash).toBe('');
    expect(elapsed).toBeLessThan(30);
  });

  test('getFiltersMeta includes catalog hash when sync state is populated', async () => {
    const { service } = createService({
      latestSnapshot: enrichedFilters,
      syncStateRows: [
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'prices', contentHash: 'prices-hash' },
      ],
    });

    const meta = await service.getFiltersMeta();

    expect(meta.catalogHash).toBe(matchingFingerprint);
    expect(meta.pricesCatalogHash).toBe('prices-hash');
    expect(meta.snapshot.sets[0]?.printCount).toBe(200);
  });

  test('getFiltersSnapshot uses latest DB snapshot when probe is disabled', async () => {
    const { service, getProbeCalls, restoreEnv } = createService({
      latestSnapshot: enrichedFilters,
      syncStateRows: [{ key: 'catalog', contentHash: 'outdated-hash', rowCount: 1396 }],
      probeDisabled: true,
    });

    try {
      const snapshot = await service.getFiltersSnapshot();
      expect(snapshot.sets[0]?.printCount).toBe(200);
      expect(getProbeCalls()).toBe(0);
    } finally {
      restoreEnv();
    }
  });

  test('getFiltersMeta overlays local print counts when upstream set totals lag', async () => {
    const upstreamFilters: FilterSnapshot = {
      ...baseFilters,
      sets: [{ id: 'ven', name: 'Vendetta', code: 'VEN', count: 58 }],
    };
    const { service } = createService({
      latestSnapshot: upstreamFilters,
      syncStateRows: [
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'prices', contentHash: 'prices-hash' },
      ],
      localSetCounts: [{ code: 'VEN', name: 'Vendetta', printCount: 228 }],
    });

    const meta = await service.getFiltersMeta();

    expect(meta.snapshot.sets.find((set) => set.code === 'VEN')?.printCount).toBe(228);
  });

  test('getFiltersMeta adds sets that exist locally but not in upstream filters', async () => {
    const { service } = createService({
      latestSnapshot: baseFilters,
      syncStateRows: [
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'prices', contentHash: 'prices-hash' },
      ],
      localSetCounts: [{ code: 'VEN', name: 'Vendetta', printCount: 228 }],
    });

    const meta = await service.getFiltersMeta();
    const vendetta = meta.snapshot.sets.find((set) => set.code === 'VEN');

    expect(vendetta).toMatchObject({
      code: 'VEN',
      name: 'Vendetta',
      count: 228,
      printCount: 228,
    });
  });

  test('getFiltersMeta matches upstream set codes case-insensitively', async () => {
    const upstreamFilters: FilterSnapshot = {
      ...baseFilters,
      sets: [{ id: 'ven', name: 'Vendetta', code: 'ven', count: 58, printCount: 58 }],
    };
    const { service } = createService({
      latestSnapshot: upstreamFilters,
      syncStateRows: [
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 1396 },
        { key: 'prices', contentHash: 'prices-hash' },
      ],
      localSetCounts: [{ code: 'VEN', name: 'Vendetta', printCount: 228 }],
    });

    const meta = await service.getFiltersMeta();
    const vendettaSets = meta.snapshot.sets.filter(
      (set) => normalizeSetCode(set.code ?? set.id) === 'VEN'
    );

    expect(vendettaSets).toHaveLength(1);
    expect(vendettaSets[0]?.printCount).toBe(228);
  });

  test('getFiltersMeta skips local aggregate when snapshot totals match sync row count', async () => {
    const currentSnapshot: FilterSnapshot = {
      ...enrichedFilters,
      sets: enrichedFilters.sets.map((set) => ({ ...set, foilPrintCount: 0 })),
    };
    const { service, getLocalAggregateCalls } = createService({
      latestSnapshot: currentSnapshot,
      syncStateRows: [
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 200 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 200 },
        { key: 'catalog', contentHash: matchingFingerprint, rowCount: 200 },
        { key: 'prices', contentHash: 'prices-hash' },
      ],
      localSetCounts: [{ code: 'OGN', name: 'Origins', printCount: 200 }],
    });

    await service.getFiltersMeta();

    expect(getLocalAggregateCalls()).toBe(0);
  });
});

function normalizeSetCode(code: string): string {
  return code.toUpperCase();
}
