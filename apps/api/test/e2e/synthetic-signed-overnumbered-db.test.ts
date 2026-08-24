import { afterAll, describe, expect, test, setDefaultTimeout } from 'bun:test';
import {
  CardDetailResponse,
  CardsListResponse,
  type PaLogicalCard,
} from '@riftbound/contracts';
import { eq, inArray } from 'drizzle-orm';
import { cards, variants } from '../../src/db/schema.js';
import { buildSyntheticSignedOvernumbered } from '../../src/lib/synthetic-signed-overnumbered.js';
import { apiJson, getContext } from './support.js';

setDefaultTimeout(120_000);

const CARD_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffff00000001';
const PARENT_VARIANT_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffff00000002';
const SYNTHETIC_VARIANT_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffff00000003';
const PA_SIGNED_VARIANT_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffff00000004';
const SET_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffff00000005';
const PARENT_VN = 'ZYS-189';
const SIGNED_VN = 'ZYS-189*';
const CARD_NAME = 'E2E Synthetic Signed Overnumbered';

function parentLogical(): PaLogicalCard {
  return {
    id: CARD_ID,
    name: CARD_NAME,
    type: 'Unit',
    super: 'Champion',
    description: 'Regression fixture for local Overnumbered Signed materialization.',
    energy: 4,
    might: 5,
    power: 2,
    tags: ['E2E'],
    colors: [],
    variants: [
      {
        id: PARENT_VARIANT_ID,
        variantNumber: PARENT_VN,
        imageUrl: 'https://cdn.piltoverarchive.com/cards/ZYS-189.webp',
        rarity: 'Showcase',
        variantType: 'Overnumbered',
        foilMode: 'foil_only',
        variantTypes: ['Overnumbered'],
        showInLibrary: true,
        isCollectible: true,
        variantLabel: 'Overnumbered',
        flavorText: null,
        artist: null,
        releaseDate: null,
        cardmarketId: 898141,
        tcgplayerId: null,
        parentVariantId: null,
        set: {
          id: SET_ID,
          prefix: 'ZYS',
          name: 'E2E Synthetic Signed Set',
          releaseDate: null,
        },
      },
    ],
  };
}

async function cleanupFixture(): Promise<void> {
  const { db, cardCache } = getContext();
  await db
    .delete(variants)
    .where(
      inArray(variants.id, [
        PARENT_VARIANT_ID,
        SYNTHETIC_VARIANT_ID,
        PA_SIGNED_VARIANT_ID,
      ])
    );
  await db.delete(variants).where(eq(variants.variantNumber, SIGNED_VN));
  await db.delete(variants).where(eq(variants.variantNumber, PARENT_VN));
  await db.delete(cards).where(eq(cards.id, CARD_ID));
  cardCache.invalidateSearchCache();
}

describe('synthetic Overnumbered Signed (DB)', () => {
  afterAll(async () => {
    await cleanupFixture();
  });

  test('local synthetic sibling stays on card detail and search', async () => {
    const { cardCache, db } = getContext();
    await cleanupFixture();

    const parent = parentLogical();
    await cardCache.upsertFromUpstream(parent);

    const parentVariant = parent.variants[0]!;
    const synthetic = buildSyntheticSignedOvernumbered(parentVariant, 898161, {
      id: SYNTHETIC_VARIANT_ID,
      imageUrl: null,
    });

    const now = new Date();
    await db.insert(variants).values({
      id: synthetic.id,
      cardId: CARD_ID,
      variantNumber: synthetic.variantNumber,
      rarity: synthetic.rarity,
      variantType: synthetic.variantType,
      foilMode: synthetic.foilMode,
      variantTypes: synthetic.variantTypes,
      imageUrl: synthetic.imageUrl,
      flavorText: null,
      artist: null,
      releaseDate: null,
      variantLabel: synthetic.variantLabel,
      showInLibrary: true,
      isCollectible: true,
      cardmarketId: synthetic.cardmarketId ?? null,
      tcgplayerId: null,
      parentVariantId: PARENT_VARIANT_ID,
      setId: SET_ID,
      contentHash: 'synthetic-e2e',
      upstreamRaw: synthetic,
      fetchedAt: now,
      updatedAt: now,
    });

    await db
      .update(cards)
      .set({
        upstreamRaw: {
          ...parent,
          variants: [...parent.variants, synthetic],
        },
        updatedAt: now,
      })
      .where(eq(cards.id, CARD_ID));

    cardCache.invalidateSearchCache();

    const fromParent = await cardCache.getByVariantNumber(PARENT_VN);
    expect(fromParent.source).toBe('cache');
    expect(fromParent.detail.variants.map((row) => row.variantNumber).sort()).toEqual(
      [PARENT_VN, SIGNED_VN].sort()
    );

    const fromSigned = await cardCache.getByVariantNumber(SIGNED_VN);
    expect(fromSigned.source).toBe('cache');
    expect(
      fromSigned.detail.variants.some((row) => row.variantNumber === SIGNED_VN)
    ).toBe(true);

    const httpDetail = CardDetailResponse.parse(
      await apiJson<unknown>(`/api/v1/cards/${encodeURIComponent(SIGNED_VN)}`)
    );
    expect(
      httpDetail.data.variants.some((row) => row.variantNumber === SIGNED_VN)
    ).toBe(true);
    expect(
      httpDetail.data.variants.find((row) => row.variantNumber === SIGNED_VN)
        ?.variantLabel
    ).toBe('Overnumbered Signed');

    const search = CardsListResponse.parse(
      await apiJson<unknown>(
        `/api/v1/cards?q=${encodeURIComponent('signed')}&limit=50&sortBy=name&dir=asc`
      )
    );
    expect(search.data.some((row) => row.variantNumber === SIGNED_VN)).toBe(true);
  });

  test('PA upsert overlays upstream fields without rewriting the local primary key', async () => {
    const { cardCache, db } = getContext();
    await cleanupFixture();

    const parent = parentLogical();
    await cardCache.upsertFromUpstream(parent);

    const parentVariant = parent.variants[0]!;
    const synthetic = buildSyntheticSignedOvernumbered(parentVariant, 898161, {
      id: SYNTHETIC_VARIANT_ID,
      imageUrl: null,
    });
    const now = new Date();
    await db.insert(variants).values({
      id: synthetic.id,
      cardId: CARD_ID,
      variantNumber: synthetic.variantNumber,
      rarity: synthetic.rarity,
      variantType: synthetic.variantType,
      foilMode: synthetic.foilMode,
      variantTypes: synthetic.variantTypes,
      imageUrl: synthetic.imageUrl,
      flavorText: null,
      artist: null,
      releaseDate: null,
      variantLabel: synthetic.variantLabel,
      showInLibrary: true,
      isCollectible: true,
      cardmarketId: 898161,
      tcgplayerId: null,
      parentVariantId: PARENT_VARIANT_ID,
      setId: SET_ID,
      contentHash: 'synthetic-e2e',
      upstreamRaw: synthetic,
      fetchedAt: now,
      updatedAt: now,
    });

    const paSigned = {
      ...synthetic,
      id: PA_SIGNED_VARIANT_ID,
      cardmarketId: 898999,
      variantLabel: 'Overnumbered Signed',
      imageUrl: 'https://cdn.piltoverarchive.com/cards/ZYS-189s.webp',
    };

    await expect(
      cardCache.upsertFromUpstream({
        ...parent,
        variants: [...parent.variants, paSigned],
      })
    ).resolves.toBe(true);

    const rows = await db
      .select({
        id: variants.id,
        variantNumber: variants.variantNumber,
        cardmarketId: variants.cardmarketId,
        imageUrl: variants.imageUrl,
        upstreamRaw: variants.upstreamRaw,
      })
      .from(variants)
      .where(eq(variants.variantNumber, SIGNED_VN));

    expect(rows).toHaveLength(1);
    // Local PK stays — collection FKs use variant_number; rewriting id is unnecessary.
    expect(rows[0]?.id).toBe(SYNTHETIC_VARIANT_ID);
    expect(rows[0]?.cardmarketId).toBe(898999);
    expect(rows[0]?.imageUrl).toBe(
      'https://cdn.piltoverarchive.com/cards/ZYS-189s.webp'
    );
    expect((rows[0]?.upstreamRaw as { id?: string }).id).toBe(PA_SIGNED_VARIANT_ID);

    const duplicatePaId = await db
      .select({ id: variants.id })
      .from(variants)
      .where(eq(variants.id, PA_SIGNED_VARIANT_ID));
    expect(duplicatePaId).toHaveLength(0);
  });
});
