import { describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import type { Database } from '../../src/db/client.js';
import { cards, sets, variants } from '../../src/db/schema.js';
import { CardmarketIdBackfillService } from '../../src/services/cardmarket-id-backfill.js';
import { productCatalogDownloadUrl } from '../../src/upstream/cardmarket-products.js';
import { getContext } from './support.js';

const RADIANCE = 6659;
const T1 = 6705;
const SERAPHINE = 'Seraphine, Not Alone';
const PRODUCTS = [
  { idProduct: 904078, name: SERAPHINE, idExpansion: T1 },
  { idProduct: 904080, name: SERAPHINE, idExpansion: T1 },
  { idProduct: 917339, name: SERAPHINE, idExpansion: RADIANCE },
  { idProduct: 917340, name: SERAPHINE, idExpansion: RADIANCE },
  { idProduct: 917466, name: SERAPHINE, idExpansion: RADIANCE },
  { idProduct: 917200, name: 'Radiance expansion anchor', idExpansion: RADIANCE },
  { idProduct: 847100, name: 'Origins expansion anchor', idExpansion: 6286 },
  { idProduct: 847151, name: 'Promo regression card', idExpansion: 6286 },
  { idProduct: 861138, name: 'Promo regression card', idExpansion: 6322 },
];

type Printing = {
  number: string;
  label: string;
  cardmarketId?: number;
  upstreamCardmarketId?: number;
  cardName?: string;
  variantType?: string;
};

async function backfillFixture(
  printings: Printing[]
): Promise<Map<string, number | null>> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input) !== productCatalogDownloadUrl(22)) {
      throw new Error(`Unexpected fixture request: ${String(input)}`);
    }
    return Response.json({
      version: 1,
      createdAt: '2026-10-18T00:00:00.000Z',
      products: PRODUCTS.map((product) => ({ ...product, idCategory: 1655 })),
    });
  }) as typeof fetch;

  const rollback = new Error('Roll back Cardmarket matching fixtures');
  let result = new Map<string, number | null>();
  try {
    await getContext().db.transaction(async (tx) => {
      const suffix = crypto.randomUUID().replaceAll('-', '');
      const setId = crypto.randomUUID();
      await tx.insert(sets).values({
        id: setId,
        code: `MATCH-${suffix}`,
        name: 'Cardmarket matching regression',
      });

      const cardIds = new Map<string, string>();
      const variantIds = new Map<string, string>();
      const now = new Date();
      for (const printing of printings) {
        const name = printing.cardName ?? SERAPHINE;
        let cardId = cardIds.get(name);
        if (!cardId) {
          cardId = crypto.randomUUID();
          cardIds.set(name, cardId);
          await tx.insert(cards).values({
            id: cardId,
            name,
            type: 'Unit',
            description: '',
            energy: 1,
            might: 1,
            power: 1,
            contentHash: '0'.repeat(64),
            upstreamRaw: {},
            fetchedAt: now,
          });
        }

        const id = crypto.randomUUID();
        variantIds.set(printing.number, id);
        await tx.insert(variants).values({
          id,
          cardId,
          variantNumber: `${suffix}-${printing.number}`,
          rarity: 'Rare',
          variantType: printing.variantType ?? printing.label,
          foilMode: 'foil_only',
          variantTypes: [printing.variantType ?? printing.label],
          imageUrl: 'https://example.com/card.webp',
          variantLabel: printing.label,
          showInLibrary: true,
          isCollectible: true,
          cardmarketId: printing.cardmarketId ?? null,
          setId,
          contentHash: '0'.repeat(64),
          upstreamRaw: { cardmarketId: printing.upstreamCardmarketId ?? null },
          fetchedAt: now,
        });
      }

      await new CardmarketIdBackfillService(
        tx as unknown as Database
      ).backfillMissingIds(22);
      for (const [number, id] of variantIds) {
        const [row] = await tx
          .select({ cardmarketId: variants.cardmarketId })
          .from(variants)
          .where(eq(variants.id, id));
        result.set(number, row?.cardmarketId ?? null);
      }
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    globalThis.fetch = originalFetch;
  }
  return result;
}

describe('Cardmarket expansion matching (e2e)', () => {
  test('Radiance Seraphine never receives a T1 product when its set has a mapped anchor', async () => {
    const result = await backfillFixture([
      { number: 'RAD-138', label: 'Standard' },
      { number: 'RAD-138a', label: 'Alt Art' },
      { number: 'RAD-SP5', label: 'K/DA', variantType: 'Alt Art' },
      {
        number: 'RAD-001',
        label: 'Standard',
        cardName: 'Radiance expansion anchor',
        cardmarketId: 917200,
        upstreamCardmarketId: 917200,
      },
    ]);

    expect(result.get('RAD-138')).toBe(917339);
    expect(result.get('RAD-138a')).toBe(917340);
    expect(result.get('RAD-SP5')).toBe(917466);
  });

  test('infers the Radiance expansion when upstream omitted every product id in the set', async () => {
    const result = await backfillFixture([
      { number: 'RAD-138', label: 'Standard' },
      { number: 'RAD-138a', label: 'Alt Art' },
      { number: 'RAD-SP5', label: 'K/DA', variantType: 'Alt Art' },
      { number: 'RAD-001', label: 'Standard', cardName: 'Radiance expansion anchor' },
    ]);

    expect(result.get('RAD-138')).toBe(917339);
    expect(result.get('RAD-138a')).toBe(917340);
    expect(result.get('RAD-SP5')).toBe(917466);
  });

  test('repairs persisted cross-expansion backfills without changing upstream ids', async () => {
    const result = await backfillFixture([
      { number: 'RAD-138', label: 'Standard', cardmarketId: 904078 },
      { number: 'RAD-138a', label: 'Alt Art', cardmarketId: 904080 },
      {
        number: 'RAD-SP5',
        label: 'K/DA',
        variantType: 'Alt Art',
        cardmarketId: 917466,
        upstreamCardmarketId: 917466,
      },
      {
        number: 'RAD-001',
        label: 'Standard',
        cardName: 'Radiance expansion anchor',
        cardmarketId: 917200,
        upstreamCardmarketId: 917200,
      },
    ]);

    expect(result.get('RAD-138')).toBe(917339);
    expect(result.get('RAD-138a')).toBe(917340);
    expect(result.get('RAD-SP5')).toBe(917466);
    expect(result.get('RAD-001')).toBe(917200);
  });

  test('keeps promo listings in their separate Cardmarket expansion', async () => {
    const result = await backfillFixture([
      {
        number: 'OGN-034',
        label: 'Standard',
        cardName: 'Promo regression card',
        cardmarketId: 847151,
        upstreamCardmarketId: 847151,
      },
      {
        number: 'OGN-034-Skirmish',
        label: 'Summoner Skirmish',
        variantType: 'Promo',
        cardName: 'Promo regression card',
      },
    ]);

    expect(result.get('OGN-034')).toBe(847151);
    expect(result.get('OGN-034-Skirmish')).toBe(861138);
  });

  test('leaves ambiguous printings unmapped instead of guessing between T1 and Radiance', async () => {
    const result = await backfillFixture([
      { number: 'RAD-138', label: 'Standard' },
      { number: 'RAD-138a', label: 'Alt Art' },
    ]);

    expect(result.get('RAD-138')).toBeNull();
    expect(result.get('RAD-138a')).toBeNull();
  });

  test('preserves explicit upstream product ids even when another expansion wins', async () => {
    const result = await backfillFixture([
      {
        number: 'T1-001',
        label: 'Alt Art',
        cardmarketId: 904078,
        upstreamCardmarketId: 904078,
      },
      {
        number: 'RAD-001',
        label: 'Standard',
        cardName: 'Radiance expansion anchor',
        cardmarketId: 917200,
        upstreamCardmarketId: 917200,
      },
      {
        number: 'RAD-001-Foil',
        label: 'Foil',
        cardName: 'Radiance expansion anchor',
        cardmarketId: 917200,
        upstreamCardmarketId: 917200,
      },
    ]);

    expect(result.get('T1-001')).toBe(904078);
  });

  test('T1 printings keep their own products when Radiance has the same card name', async () => {
    const result = await backfillFixture([
      {
        number: 'T1-001',
        label: 'Alt Art',
        cardmarketId: 904078,
        upstreamCardmarketId: 904078,
      },
      { number: 'T1-002', label: 'Alt Art Signed', variantType: 'Alt Art' },
    ]);

    expect(result.get('T1-001')).toBe(904078);
    expect(result.get('T1-002')).toBe(904080);
  });

  test('maps regular and promo printings separately when both ids are missing', async () => {
    const result = await backfillFixture([
      { number: 'OGN-034', label: 'Standard', cardName: 'Promo regression card' },
      {
        number: 'OGN-034-Skirmish',
        label: 'Summoner Skirmish',
        variantType: 'Promo',
        cardName: 'Promo regression card',
      },
      {
        number: 'OGN-001',
        label: 'Standard',
        cardName: 'Origins expansion anchor',
        cardmarketId: 847100,
        upstreamCardmarketId: 847100,
      },
    ]);

    expect(result.get('OGN-034')).toBe(847151);
    expect(result.get('OGN-034-Skirmish')).toBe(861138);
  });

  test('foil printings continue to share the mapped base product id', async () => {
    const result = await backfillFixture([
      {
        number: 'RAD-138',
        label: 'Standard',
        cardmarketId: 917339,
        upstreamCardmarketId: 917339,
      },
      { number: 'RAD-138-Foil', label: 'Foil', variantType: 'Standard' },
    ]);

    expect(result.get('RAD-138-Foil')).toBe(917339);
  });
});
