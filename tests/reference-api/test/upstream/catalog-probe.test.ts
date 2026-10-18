import { describe, expect, test } from 'bun:test';
import { loadEnv } from '../../src/env.js';
import { PaClient } from '../../src/upstream/pa-client.js';
import { probeExpandedCatalog } from '../../src/services/catalog-probe.js';
import { sumVariantTypeCounts } from '../../src/lib/catalog-total.js';
import { FilterSnapshot } from '@riftbound/contracts';

const runUpstream = process.env.UPSTREAM_E2E === 'true';

describe.skipIf(!runUpstream)('upstream catalog probe (Piltover Archive)', () => {
  test('expanded collectible printing total is derived live from PA API', async () => {
    const env = loadEnv();
    const client = new PaClient(env);
    const result = await probeExpandedCatalog(client);

    const setSum = Object.values(result.setPrintTotals).reduce(
      (sum, count) => sum + count,
      0
    );
    expect(result.catalogPrintTotal).toBe(setSum);
    expect(result.catalogPrintTotal).toBeGreaterThan(result.logicalCardCount);

    const meta = await client.listCards({ limit: 1, page: 1 });
    const filters = FilterSnapshot.parse(
      meta.meta?.filters ?? {
        colors: [],
        sets: [],
        types: [],
        supertypes: [],
        rarities: [],
        variants: [],
      }
    );
    const logicalCardTotal = filters.sets.reduce((sum, set) => sum + set.count, 0);
    const variantTypeTotal = sumVariantTypeCounts(filters);

    expect(result.catalogPrintTotal).toBeGreaterThan(logicalCardTotal);
    expect(result.catalogPrintTotal).toBeGreaterThanOrEqual(variantTypeTotal);
    expect(result.logicalCardCount).toBeLessThanOrEqual(logicalCardTotal);
  }, 300_000);
});
