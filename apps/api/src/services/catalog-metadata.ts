import { FilterSnapshot } from '@riftbound/contracts';
import { desc, eq, sql } from 'drizzle-orm';
import { computeCatalogTotal, sumSetPrintCounts } from '../lib/catalog-total.js';
import { catalogFingerprint, entityHash } from '../lib/hash.js';
import type { Database } from '../db/client.js';
import { filterSnapshots, sets, syncState, variants } from '../db/schema.js';
import type { PaClient } from '../upstream/pa-client.js';
import {
  enrichFilterSnapshotWithPrintCounts,
  probeExpandedCatalog,
  snapshotHasPrintCounts,
} from './catalog-probe.js';

export type FiltersMeta = {
  snapshot: FilterSnapshot;
  cachedAt: string;
  catalogHash: string;
  pricesCatalogHash: string;
  variantCount: number;
};

type ProbeContext = {
  baseFilters: FilterSnapshot;
  fingerprint: string;
  latestParsed: FilterSnapshot | null;
  needsProbe: boolean;
};

function normalizeSetCode(code: string): string {
  return code.toUpperCase();
}

export class CatalogMetadataService {
  private probePromise: Promise<FilterSnapshot> | null = null;

  constructor(
    private readonly db: Database,
    private readonly pa: PaClient
  ) {}

  async getFiltersMeta(): Promise<FiltersMeta> {
    const snapshot = await this.withLocalSetCounts(
      await this.withLocalFoilPrintCounts(await this.getFiltersSnapshot())
    );
    const latest = await this.db.query.filterSnapshots.findFirst({
      orderBy: [desc(filterSnapshots.capturedAt)],
    });
    const catalog = await this.db.query.syncState.findFirst({
      where: eq(syncState.key, 'catalog'),
    });
    const prices = await this.db.query.syncState.findFirst({
      where: eq(syncState.key, 'prices'),
    });

    return {
      snapshot,
      cachedAt: (latest?.capturedAt ?? new Date()).toISOString(),
      catalogHash: catalog?.contentHash ?? '',
      pricesCatalogHash: prices?.contentHash ?? '',
      variantCount: computeCatalogTotal(snapshot, catalog?.rowCount ?? 0),
    };
  }

  /** Overlay local per-set print totals when upstream filter metadata lags (logical vs print). */
  private async withLocalSetCounts(snapshot: FilterSnapshot): Promise<FilterSnapshot> {
    if (snapshot.sets.length === 0) {
      return snapshot;
    }

    const catalog = await this.db.query.syncState.findFirst({
      where: eq(syncState.key, 'catalog'),
    });
    const syncedTotal = catalog?.rowCount ?? 0;
    if (syncedTotal > 0 && sumSetPrintCounts(snapshot) >= syncedTotal) {
      return snapshot;
    }

    try {
      const rows = await this.db
        .select({
          code: sets.code,
          name: sets.name,
          printCount: sql<number>`count(*) filter (where ${variants.isCollectible})::int`,
        })
        .from(variants)
        .innerJoin(sets, eq(variants.setId, sets.id))
        .groupBy(sets.code, sets.name);

      if (rows.length === 0) return snapshot;

      const localByCode = Object.fromEntries(
        rows.map((row) => [normalizeSetCode(row.code), row])
      );
      const seen = new Set<string>();

      const updatedSets = snapshot.sets.map((set) => {
        const key = normalizeSetCode(set.code ?? set.id);
        seen.add(key);
        const local = localByCode[key];
        if (!local || local.printCount <= 0) return set;

        const current = set.printCount ?? set.count;
        return {
          ...set,
          printCount: Math.max(current, local.printCount),
        };
      });

      for (const [code, local] of Object.entries(localByCode)) {
        if (seen.has(code) || local.printCount <= 0) continue;
        updatedSets.push({
          id: code.toLowerCase(),
          code: local.code,
          name: local.name,
          count: local.printCount,
          printCount: local.printCount,
        });
      }

      return { ...snapshot, sets: updatedSets };
    } catch {
      return snapshot;
    }
  }

  /** Overlay foil printing counts from the local catalog so dashboards work before a re-probe. */
  private async withLocalFoilPrintCounts(
    snapshot: FilterSnapshot
  ): Promise<FilterSnapshot> {
    if (
      snapshot.sets.length === 0 ||
      snapshot.sets.every((set) => set.foilPrintCount != null)
    ) {
      return snapshot;
    }

    try {
      const rows = await this.db
        .select({
          code: sets.code,
          foilPrintCount: sql<number>`count(*) filter (
            where ${variants.foilMode} ilike 'foil_only'
               or ${variants.variantNumber} ilike '%foil%'
               or ${variants.variantLabel} ilike '%foil%'
               or ${variants.variantType} ilike '%foil%'
          )::int`,
        })
        .from(variants)
        .innerJoin(sets, eq(variants.setId, sets.id))
        .groupBy(sets.code);

      if (rows.length === 0) return snapshot;

      const foilByCode = Object.fromEntries(
        rows.map((row) => [row.code, row.foilPrintCount])
      );
      return {
        ...snapshot,
        sets: snapshot.sets.map((set) => ({
          ...set,
          foilPrintCount: foilByCode[set.code ?? set.id] ?? set.foilPrintCount ?? 0,
        })),
      };
    } catch {
      return snapshot;
    }
  }

  /** Best-effort snapshot for HTTP — never blocks on an in-flight catalog probe. */
  async getFiltersSnapshot(): Promise<FilterSnapshot> {
    if (process.env.CATALOG_PROBE_DISABLED === 'true') {
      return this.loadLatestSnapshot();
    }

    const context = await this.prepareProbeContext();
    if (!context.needsProbe && context.latestParsed) {
      return context.latestParsed;
    }

    void this.scheduleProbe(context.baseFilters, context.fingerprint);
    return context.latestParsed ?? context.baseFilters;
  }

  /** Blocks until expanded print counts are ready — used by catalog sync. */
  async ensureExpandedPrintCounts(force = false): Promise<FilterSnapshot> {
    if (process.env.CATALOG_PROBE_DISABLED === 'true') {
      return this.loadLatestSnapshot();
    }

    const context = await this.prepareProbeContext(force);
    if (!context.needsProbe && context.latestParsed) {
      return context.latestParsed;
    }

    return this.scheduleProbe(context.baseFilters, context.fingerprint);
  }

  private async prepareProbeContext(force = false): Promise<ProbeContext> {
    const probe = await this.pa.listCards({ limit: 1, page: 1 });
    const fingerprint = catalogFingerprint(
      probe.pagination.total,
      probe.meta?.filters ?? {}
    );
    const baseFilters = FilterSnapshot.parse(
      probe.meta?.filters ?? {
        colors: [],
        sets: [],
        types: [],
        supertypes: [],
        rarities: [],
        variants: [],
      }
    );

    const existing = await this.db.query.syncState.findFirst({
      where: eq(syncState.key, 'catalog'),
    });
    const latest = await this.loadLatestSnapshotRecord();
    const latestParsed = latest?.snapshot ?? null;

    const needsProbe =
      force ||
      !latestParsed ||
      !snapshotHasPrintCounts(latestParsed) ||
      existing?.contentHash !== fingerprint;

    return { baseFilters, fingerprint, latestParsed, needsProbe };
  }

  private scheduleProbe(
    baseFilters: FilterSnapshot,
    fingerprint: string
  ): Promise<FilterSnapshot> {
    if (!this.probePromise) {
      this.probePromise = this.runProbe(baseFilters, fingerprint).finally(() => {
        this.probePromise = null;
      });
    }

    return this.probePromise;
  }

  private async runProbe(
    baseFilters: FilterSnapshot,
    fingerprint: string
  ): Promise<FilterSnapshot> {
    console.log('Probing expanded catalog print counts from Piltover Archive…');
    const expanded = await probeExpandedCatalog(this.pa);
    const enriched = enrichFilterSnapshotWithPrintCounts(
      baseFilters,
      expanded.setPrintTotals,
      expanded.setFoilPrintTotals
    );

    const now = new Date();
    await this.db.insert(filterSnapshots).values({
      snapshot: enriched,
      contentHash: entityHash(enriched),
    });
    await this.db
      .insert(syncState)
      .values({
        key: 'catalog',
        status: 'idle',
        contentHash: fingerprint,
        rowCount: expanded.catalogPrintTotal,
        lastAttemptAt: now,
        lastSuccessAt: now,
        lastError: null,
      })
      .onConflictDoUpdate({
        target: syncState.key,
        set: {
          status: 'idle',
          contentHash: fingerprint,
          rowCount: expanded.catalogPrintTotal,
          lastAttemptAt: now,
          lastSuccessAt: now,
          lastError: null,
        },
      });

    return enriched;
  }

  private async loadLatestSnapshotRecord() {
    const row = await this.db.query.filterSnapshots.findFirst({
      orderBy: [desc(filterSnapshots.capturedAt)],
    });
    if (!row?.snapshot) return null;
    return { snapshot: FilterSnapshot.parse(row.snapshot), capturedAt: row.capturedAt };
  }

  private async loadLatestSnapshot(): Promise<FilterSnapshot> {
    const latest = await this.loadLatestSnapshotRecord();
    if (latest) return latest.snapshot;

    const probe = await this.pa.listCards({ limit: 1, page: 1 });
    return FilterSnapshot.parse(
      probe.meta?.filters ?? {
        colors: [],
        sets: [],
        types: [],
        supertypes: [],
        rarities: [],
        variants: [],
      }
    );
  }
}
