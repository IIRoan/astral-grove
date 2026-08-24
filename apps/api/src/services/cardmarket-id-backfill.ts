import { eq, isNotNull, isNull } from 'drizzle-orm';
import type { PaLogicalCard, PaVariant } from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { cards, prices, sets, variants } from '../db/schema.js';
import {
  buildSetExpansionMap,
  inferExpansionId,
  matchVariantsToProducts,
  type VariantForCardmarketMatch,
} from '../lib/cardmarket-id-match.js';
import { resolveSignedOvernumberedImageUrl } from '../lib/signature-image.js';
import {
  buildSyntheticSignedOvernumbered,
  isSignedOvernumbered,
  isUnsignedOvernumbered,
  leftoverCardmarketProducts,
  signedOvernumberedVariantNumber,
} from '../lib/synthetic-signed-overnumbered.js';
import { paVariantHash } from './card-mapper.js';
import {
  fetchCardmarketProductCatalog,
  type CardmarketProduct,
} from '../upstream/cardmarket-products.js';

interface UnmappedVariantRow {
  id: string;
  variantNumber: string;
  variantLabel: string;
  variantType: string;
  rarity: string;
  cardName: string;
  setCode: string;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

export class CardmarketIdBackfillService {
  constructor(private readonly db: Database) {}

  async backfillMissingIds(
    gameId: number
  ): Promise<{ updated: number; skipped: number; syntheticsCreated: number }> {
    const exportData = await fetchCardmarketProductCatalog(gameId);
    const productsById = new Map(
      exportData.products.map((product) => [product.idProduct, product] as const)
    );
    const productsByExpansion = groupBy(exportData.products, (product) =>
      String(product.idExpansion)
    );

    const mappedRows = await this.db
      .select({
        setCode: sets.code,
        cardmarketId: variants.cardmarketId,
      })
      .from(variants)
      .innerJoin(sets, eq(variants.setId, sets.id))
      .where(isNotNull(variants.cardmarketId));

    const setExpansionMap = buildSetExpansionMap(
      mappedRows.flatMap((row) =>
        row.cardmarketId == null
          ? []
          : [{ setCode: row.setCode, cardmarketId: row.cardmarketId }]
      ),
      productsById
    );

    const unmapped = await this.db
      .select({
        id: variants.id,
        variantNumber: variants.variantNumber,
        variantLabel: variants.variantLabel,
        variantType: variants.variantType,
        rarity: variants.rarity,
        cardName: cards.name,
        setCode: sets.code,
      })
      .from(variants)
      .innerJoin(cards, eq(variants.cardId, cards.id))
      .innerJoin(sets, eq(variants.setId, sets.id))
      .where(isNull(variants.cardmarketId));

    const priceRankByProduct = await this.loadFoilTrendRanks();
    const assignments = new Map<string, number>();

    const bySet = groupBy(unmapped, (row) => row.setCode);
    for (const [setCode, setVariants] of bySet) {
      const expansionId =
        setExpansionMap.get(setCode) ??
        inferExpansionId(setVariants, productsByExpansion);
      if (expansionId == null) continue;

      const expansionProducts = productsByExpansion.get(String(expansionId)) ?? [];
      const productsByName = groupBy(expansionProducts, (product) => product.name);

      const byName = groupBy(setVariants, (row) => row.cardName);
      for (const [cardName, cardVariants] of byName) {
        const products = productsByName.get(cardName) ?? [];
        if (products.length === 0) continue;

        const matches = matchVariantsToProducts(
          cardVariants.map(toMatchVariant),
          products,
          priceRankByProduct
        );

        for (const variant of cardVariants) {
          const cardmarketId = matches.get(variant.variantNumber);
          if (cardmarketId == null) continue;
          assignments.set(variant.id, cardmarketId);
        }
      }
    }

    let updated = 0;
    for (const [variantId, cardmarketId] of assignments) {
      await this.db
        .update(variants)
        .set({ cardmarketId, updatedAt: new Date() })
        .where(eq(variants.id, variantId));
      updated += 1;
    }

    const syntheticsCreated = await this.materializeMissingSignedOvernumbered(
      productsByExpansion,
      setExpansionMap,
      priceRankByProduct
    );

    return { updated, skipped: unmapped.length - updated, syntheticsCreated };
  }

  /** Materialize local `{vn}*` for Cardmarket Signed Overnumbered leftovers not yet in PA (e.g. VEN-189*). */
  private async materializeMissingSignedOvernumbered(
    productsByExpansion: Map<string, CardmarketProduct[]>,
    setExpansionMap: Map<string, number>,
    priceRankByProduct: ReadonlyMap<number, number>
  ): Promise<number> {
    const rows = await this.db
      .select({
        id: variants.id,
        cardId: variants.cardId,
        variantNumber: variants.variantNumber,
        variantLabel: variants.variantLabel,
        variantType: variants.variantType,
        cardmarketId: variants.cardmarketId,
        upstreamRaw: variants.upstreamRaw,
        cardName: cards.name,
        setCode: sets.code,
      })
      .from(variants)
      .innerJoin(cards, eq(variants.cardId, cards.id))
      .innerJoin(sets, eq(variants.setId, sets.id));

    const byCard = groupBy(rows, (row) => row.cardId);
    let created = 0;

    for (const cardVariants of byCard.values()) {
      const first = cardVariants[0];
      if (!first) continue;

      const hasSigned = cardVariants.some((row) =>
        isSignedOvernumbered({
          variantNumber: row.variantNumber,
          variantLabel: row.variantLabel,
          variantType: row.variantType,
        })
      );
      if (hasSigned) continue;

      const overnumberedParents = cardVariants.filter((row) =>
        isUnsignedOvernumbered({
          variantLabel: row.variantLabel,
          variantType: row.variantType,
        })
      );
      if (overnumberedParents.length !== 1) continue;

      const parentRow = overnumberedParents[0]!;
      const signedVn = signedOvernumberedVariantNumber(parentRow.variantNumber);
      if (
        cardVariants.some(
          (row) => row.variantNumber.toLowerCase() === signedVn.toLowerCase()
        )
      ) {
        continue;
      }

      const expansionId = setExpansionMap.get(first.setCode);
      if (expansionId == null) continue;

      const expansionProducts = productsByExpansion.get(String(expansionId)) ?? [];
      const products = expansionProducts.filter(
        (product) => product.name === first.cardName
      );
      if (products.length === 0) continue;

      const usedIds = new Set(
        cardVariants
          .map((row) => row.cardmarketId)
          .filter((id): id is number => id != null)
      );
      const leftovers = leftoverCardmarketProducts(
        products,
        usedIds,
        priceRankByProduct
      );
      const leftover = leftovers[0];
      if (!leftover) continue;

      const parentVariant = parentRow.upstreamRaw as PaVariant;
      const signatureImageUrl = await resolveSignedOvernumberedImageUrl(
        first.cardName,
        signedVn
      );
      const synthetic = buildSyntheticSignedOvernumbered(
        parentVariant,
        leftover.idProduct,
        {
          imageUrl: signatureImageUrl,
        }
      );
      const now = new Date();

      const inserted = await this.db
        .insert(variants)
        .values({
          id: synthetic.id,
          cardId: parentRow.cardId,
          variantNumber: synthetic.variantNumber,
          rarity: synthetic.rarity,
          variantType: synthetic.variantType,
          foilMode: synthetic.foilMode,
          variantTypes: synthetic.variantTypes,
          imageUrl: synthetic.imageUrl,
          flavorText: synthetic.flavorText ?? null,
          artist: synthetic.artist ?? null,
          releaseDate: synthetic.releaseDate ?? null,
          variantLabel: synthetic.variantLabel,
          showInLibrary: synthetic.showInLibrary,
          isCollectible: synthetic.isCollectible,
          cardmarketId: synthetic.cardmarketId ?? null,
          tcgplayerId: synthetic.tcgplayerId ?? null,
          parentVariantId: synthetic.parentVariantId ?? null,
          setId: synthetic.set.id,
          contentHash: paVariantHash(synthetic),
          upstreamRaw: synthetic,
          fetchedAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: variants.variantNumber })
        .returning({ id: variants.id });

      if (inserted.length === 0) continue;

      const cardRow = await this.db.query.cards.findFirst({
        where: eq(cards.id, parentRow.cardId),
      });
      if (cardRow) {
        const logical = cardRow.upstreamRaw as PaLogicalCard;
        const alreadyListed = logical.variants.some(
          (row) =>
            row.variantNumber.toLowerCase() === synthetic.variantNumber.toLowerCase()
        );
        if (!alreadyListed) {
          const nextVariants = [...logical.variants, synthetic].sort((a, b) =>
            a.variantNumber.localeCompare(b.variantNumber)
          );
          await this.db
            .update(cards)
            .set({
              upstreamRaw: { ...logical, variants: nextVariants },
              updatedAt: now,
            })
            .where(eq(cards.id, parentRow.cardId));
        }
      }

      created += 1;
    }

    return created;
  }

  private async loadFoilTrendRanks(): Promise<Map<number, number>> {
    const rows = await this.db
      .select({
        cardmarketId: prices.cardmarketId,
        marketPrice: prices.marketPrice,
      })
      .from(prices)
      .where(eq(prices.isFoil, true));

    const ranks = new Map<number, number>();
    for (const row of rows) {
      const market = row.marketPrice == null ? 0 : Number(row.marketPrice);
      ranks.set(row.cardmarketId, Number.isFinite(market) ? market : 0);
    }
    return ranks;
  }
}

function toMatchVariant(row: UnmappedVariantRow): VariantForCardmarketMatch {
  return {
    variantNumber: row.variantNumber,
    variantLabel: row.variantLabel,
    variantType: row.variantType,
    rarity: row.rarity,
  };
}
