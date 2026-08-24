import { inArray } from 'drizzle-orm';
import { chunkArray } from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { variants } from '../db/schema.js';
import type { CardCacheService } from './card-cache.js';
import type { PaClient } from '../upstream/pa-client.js';

const UPSTREAM_BATCH_SIZE = 50;

export function normalizeVariantNumber(value: string): string {
  return value.trim();
}

export class VariantResolver {
  constructor(
    private readonly db: Database,
    private readonly cardCache: CardCacheService,
    private readonly pa: PaClient
  ) {}

  private addToLookup(lookup: Map<string, string>, variantNumber: string): void {
    lookup.set(variantNumber.toLowerCase(), variantNumber);
  }

  private async refreshLookup(
    lookup: Map<string, string>,
    variantNumbers: string[]
  ): Promise<void> {
    if (variantNumbers.length === 0) return;
    const rows = await this.db
      .select({ variantNumber: variants.variantNumber })
      .from(variants)
      .where(inArray(variants.variantNumber, variantNumbers));
    for (const row of rows) {
      this.addToLookup(lookup, row.variantNumber);
    }
  }

  async loadLookupMap(variantNumbers: string[]): Promise<Map<string, string>> {
    const unique = [
      ...new Set(variantNumbers.map(normalizeVariantNumber).filter(Boolean)),
    ];
    const lookup = new Map<string, string>();

    if (unique.length === 0) return lookup;

    await this.refreshLookup(lookup, unique);

    let missing = unique.filter((vn) => !lookup.has(vn.toLowerCase()));
    if (missing.length === 0) return lookup;

    for (const chunk of chunkArray(missing, UPSTREAM_BATCH_SIZE)) {
      const batch = await this.pa.batchCards(chunk);
      const fetchedVariants = new Set<string>();

      for (const item of batch.data) {
        if (fetchedVariants.has(item.variantNumber)) continue;
        fetchedVariants.add(item.variantNumber);
        const logical = await this.pa.getCard(item.variantNumber);
        await this.cardCache.upsertFromUpstream(logical);
        for (const variant of logical.variants) {
          this.addToLookup(lookup, variant.variantNumber);
        }
      }

      for (const vn of batch.notFound) {
        try {
          const logical = await this.pa.getCard(vn);
          await this.cardCache.upsertFromUpstream(logical);
          for (const variant of logical.variants) {
            this.addToLookup(lookup, variant.variantNumber);
          }
        } catch {}
      }
    }

    missing = unique.filter((vn) => !lookup.has(vn.toLowerCase()));
    await this.refreshLookup(lookup, missing);

    return lookup;
  }

  resolveVariantNumber(
    lookup: Map<string, string>,
    variantNumber: string
  ): string | null {
    const normalized = normalizeVariantNumber(variantNumber);
    return lookup.get(normalized.toLowerCase()) ?? null;
  }
}
