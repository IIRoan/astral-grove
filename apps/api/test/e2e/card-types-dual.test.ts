import { afterAll, describe, expect, test } from 'bun:test';
import { CardsListResponse, type PaLogicalCard } from '@riftbound/contracts';
import { eq } from 'drizzle-orm';
import { cards, variants } from '../../src/db/schema.js';
import { apiJson, getContext } from './support.js';

const DUAL_TYPE_CARD_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001';
const DUAL_TYPE_VARIANT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0002';
const DUAL_TYPE_SET_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0003';
const DUAL_TYPE_VARIANT_NUMBER = 'ZZZ-DUAL-001';
const DUAL_TYPE_NAME = 'E2E Dual Type Unit Gear';

function dualTypeFixture(): PaLogicalCard {
  return {
    id: DUAL_TYPE_CARD_ID,
    name: DUAL_TYPE_NAME,
    type: 'Unit Gear',
    description: 'Regression fixture for dual-type deck-builder filters.',
    energy: 2,
    might: 2,
    power: 0,
    tags: ['E2E'],
    // Colorless — avoids clashing with catalog color ids on name uniqueness.
    colors: [],
    variants: [
      {
        id: DUAL_TYPE_VARIANT_ID,
        variantNumber: DUAL_TYPE_VARIANT_NUMBER,
        imageUrl: 'https://example.com/zzz-dual-001.webp',
        rarity: 'Uncommon',
        variantType: 'Standard',
        foilMode: 'none',
        variantTypes: ['Standard'],
        showInLibrary: true,
        isCollectible: true,
        variantLabel: 'Standard',
        flavorText: null,
        artist: null,
        releaseDate: null,
        cardmarketId: null,
        tcgplayerId: null,
        parentVariantId: null,
        set: {
          id: DUAL_TYPE_SET_ID,
          prefix: 'ZZZ',
          name: 'E2E Dual Type Set',
        },
      },
    ],
  };
}

describe('dual-type card filters (Unit Gear regression)', () => {
  afterAll(async () => {
    const { db, cardCache } = getContext();
    await db.delete(variants).where(eq(variants.id, DUAL_TYPE_VARIANT_ID));
    await db.delete(cards).where(eq(cards.id, DUAL_TYPE_CARD_ID));
    cardCache.invalidateSearchCache();
  });

  test('deck-builder types=Unit,Gear,Spell includes dual-type cards', async () => {
    const { cardCache } = getContext();
    await cardCache.upsertFromUpstream(dualTypeFixture());
    cardCache.invalidateSearchCache();

    const deckBuilder = CardsListResponse.parse(
      await apiJson<unknown>(
        `/api/v1/cards?q=${encodeURIComponent(DUAL_TYPE_NAME)}&types=Unit,Gear,Spell&limit=10`
      )
    );
    expect(
      deckBuilder.data.some((row) => row.variantNumber === DUAL_TYPE_VARIANT_NUMBER)
    ).toBe(true);

    const unitOnly = CardsListResponse.parse(
      await apiJson<unknown>(
        `/api/v1/cards?q=${encodeURIComponent(DUAL_TYPE_NAME)}&types=Unit&limit=10`
      )
    );
    expect(
      unitOnly.data.some((row) => row.variantNumber === DUAL_TYPE_VARIANT_NUMBER)
    ).toBe(true);

    const gearOnly = CardsListResponse.parse(
      await apiJson<unknown>(
        `/api/v1/cards?q=${encodeURIComponent(DUAL_TYPE_NAME)}&types=Gear&limit=10`
      )
    );
    expect(
      gearOnly.data.some((row) => row.variantNumber === DUAL_TYPE_VARIANT_NUMBER)
    ).toBe(true);

    const spellOnly = CardsListResponse.parse(
      await apiJson<unknown>(
        `/api/v1/cards?q=${encodeURIComponent(DUAL_TYPE_NAME)}&types=Spell&limit=10`
      )
    );
    expect(
      spellOnly.data.some((row) => row.variantNumber === DUAL_TYPE_VARIANT_NUMBER)
    ).toBe(false);
  });
});
