import { describe, expect, test, setDefaultTimeout, beforeAll } from 'bun:test';
import { count, eq, inArray, isNull, sql } from 'drizzle-orm';
import { PriceStatsBatchResponse, SyncPricesResponse } from '@riftbound/contracts';
import { CardmarketIdBackfillService } from '../../src/services/cardmarket-id-backfill.js';
import { adminAuthHeaders, apiJson, getContext, getEnv } from './support.js';
import { variants } from '../../src/db/schema.js';

setDefaultTimeout(300_000);

async function cardmarketIds(
  variantNumbers: string[]
): Promise<Map<string, number | null>> {
  const { db } = getContext();
  const rows = await db
    .select({
      variantNumber: variants.variantNumber,
      cardmarketId: variants.cardmarketId,
    })
    .from(variants)
    .where(inArray(variants.variantNumber, variantNumbers));

  return new Map(rows.map((row) => [row.variantNumber, row.cardmarketId ?? null]));
}

async function postPriceSync(): Promise<SyncPricesResponse> {
  return SyncPricesResponse.parse(
    await apiJson<unknown>('/api/v1/sync/prices', {
      method: 'POST',
      headers: adminAuthHeaders(),
    })
  );
}

async function ensurePromoDistinctFromStandard(
  standardVn: string,
  promoVn: string
): Promise<void> {
  const { db } = getContext();
  const ids = await cardmarketIds([standardVn, promoVn]);
  const standardId = ids.get(standardVn);
  const promoId = ids.get(promoVn);
  if (promoId != null && standardId != null && promoId !== standardId) return;

  await db.execute(
    sql`UPDATE variants SET cardmarket_id = NULL WHERE variant_number = ${promoVn}`
  );
  const sync = await postPriceSync();
  expect(sync.data.cardmarketIdsBackfilled).toBeGreaterThan(0);
}

describe('Cardmarket id backfill (e2e)', () => {
  beforeAll(async () => {
    const { db } = getContext();
    const env = getEnv();
    await new CardmarketIdBackfillService(db).backfillMissingIds(
      env.CARDMARKET_GAME_ID
    );
  });

  test('catalog has a Cardmarket product id on every variant after backfill', async () => {
    const { db } = getContext();
    const [row] = await db
      .select({ value: count() })
      .from(variants)
      .where(isNull(variants.cardmarketId));
    expect(row?.value ?? 0).toBe(0);
  });

  test('promo SKUs map to a different Cardmarket product than their standard printing', async () => {
    await ensurePromoDistinctFromStandard('OGN-034', 'OGN-034-Skirmish');
    await ensurePromoDistinctFromStandard('OGS-001', 'OGS-001-Nexus');

    const ids = await cardmarketIds([
      'OGN-034',
      'OGN-034-Skirmish',
      'OGS-001',
      'OGS-001-Nexus',
      'OGN-193',
      'OGN-193a-Regionals',
    ]);

    expect(ids.get('OGN-034-Skirmish')).not.toBeNull();
    expect(ids.get('OGN-034-Skirmish')).not.toBe(ids.get('OGN-034'));
    expect(ids.get('OGS-001-Nexus')).not.toBeNull();
    expect(ids.get('OGS-001-Nexus')).not.toBe(ids.get('OGS-001'));
    expect(ids.get('OGN-193a-Regionals')).not.toBeNull();
    expect(ids.get('OGN-193a-Regionals')).not.toBe(ids.get('OGN-193'));
  });

  test('POST /api/v1/sync/prices backfills a cleared promo when the price guide is unchanged', async () => {
    const { db } = getContext();
    await ensurePromoDistinctFromStandard('OGN-034', 'OGN-034-Skirmish');

    await db.execute(
      sql`UPDATE variants SET cardmarket_id = NULL WHERE variant_number = 'OGN-034-Skirmish'`
    );

    const sync = await postPriceSync();
    expect(sync.data.changed).toBe(false);
    expect(sync.data.rowCount).toBeGreaterThan(1000);
    expect(sync.data.cardmarketIdsBackfilled).toBeGreaterThan(0);

    const ids = await cardmarketIds(['OGN-034', 'OGN-034-Skirmish']);
    expect(ids.get('OGN-034-Skirmish')).not.toBeNull();
    expect(ids.get('OGN-034-Skirmish')).not.toBe(ids.get('OGN-034'));
  });

  test('-Foil rows reuse the base printing id when a token shares the same logical card', async () => {
    const { db } = getContext();
    const foilVn = 'SFD-099-Foil';
    const [foilRow] = await db
      .select({ cardmarketId: variants.cardmarketId })
      .from(variants)
      .where(eq(variants.variantNumber, foilVn))
      .limit(1);

    if (foilRow?.cardmarketId == null) {
      await new CardmarketIdBackfillService(db).backfillMissingIds(
        getEnv().CARDMARKET_GAME_ID
      );
    }

    const ids = await cardmarketIds(['SFD-099', foilVn, 'UNL-223']);
    expect(ids.get('SFD-099-Foil')).toBe(ids.get('SFD-099'));
    expect(ids.get('SFD-099-Foil')).not.toBe(ids.get('UNL-223'));
  });

  test('backfilled promo ids resolve live price stats over HTTP', async () => {
    await ensurePromoDistinctFromStandard('OGN-034', 'OGN-034-Skirmish');

    const stats = PriceStatsBatchResponse.parse(
      await apiJson<unknown>('/api/v1/prices/stats/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days: 30,
          items: [{ variantNumber: 'OGN-034-Skirmish' }],
        }),
      })
    );

    const row = stats.data[0];
    expect(row?.variantNumber).toBe('OGN-034-Skirmish');
    expect(row?.cardmarketId).not.toBeNull();
    expect(row?.currentPrice).not.toBeNull();
    expect(row?.points.length).toBeGreaterThan(0);
  });
});
