import { and, asc, count, eq, inArray, isNotNull, sql, type SQL } from 'drizzle-orm';
import type {
  CardsListQuery,
  CardDetail,
  CardListItem,
  GlobalSearchQuery,
  GlobalSearchResponse,
} from '@riftbound/contracts';
import {
  PaCardsListResponse,
  fuseSearchResultIds,
  type PaLogicalCard,
  type PaPriceRow,
  type PaVariant,
} from '@riftbound/contracts';
import type { Database } from '../db/client.js';
import { cardColors, cards, colors, sets, syncState, variants } from '../db/schema.js';
import { PaApiError, type PaClient } from '../upstream/pa-client.js';
import {
  mapCardDetail,
  mapListItem,
  mapListItemFromDbRow,
  candidateGroupMaxMarketPrice,
  type ListItemDbRow,
  groupCardListItems,
  paCardHash,
  paVariantHash,
} from './card-mapper.js';
import type { PriceCacheService } from './price-cache.js';
import type { ImageStoreService } from './image-store.js';
import { rankEmbeddings, type EmbeddingService } from './embeddings.js';
import {
  logSearchCacheHit,
  logSearchComplete,
  logSearchGlobal,
  logSearchPipeline,
  logSearchPostgresQuery,
  logSearchReconcile,
  summarizeCardsListQuery,
  summarizeGlobalSearchQuery,
  summarizeHydrationTimings,
} from '../lib/search-metrics.js';
import { TtlCache } from '../lib/ttl-cache.js';
import {
  buildSearchCandidateQuery,
  buildSearchCandidateQueryUnsorted,
  buildSearchFilterWhere,
  buildSearchTypeIntentWhere,
  buildSearchWhere,
  shouldMaterializeThenPage,
} from '../lib/search-sql.js';
import {
  groupSearchCandidateRows,
  searchGroupKeyForRow,
  searchRankCardFromGroup,
  sortCandidateGroupsByEnergy,
  sortCandidateGroupsByName,
  sortCandidateGroupsByVariantNumber,
  sortCandidateGroupsLexically,
  type SearchCandidateGroup,
} from '../lib/search-candidates.js';
import {
  buildUpstreamListParams,
  maxUpstreamBackfillPages,
  resolveUpstreamReconcileMode,
  upstreamCheckKey,
} from '../lib/upstream-list-params.js';

const SEARCH_RESULT_TTL_MS = 5 * 60 * 1000;
const UPSTREAM_CHECK_TTL_MS = 15 * 60 * 1000;
const VARIANT_ID_RESOLVE_TTL_MS = 30 * 60 * 1000;

type SearchResult = {
  items: CardListItem[];
  total: number;
  catalogHash: string;
  source: 'cache' | 'upstream' | 'mixed';
};

export type LocalSearchTimings = {
  dbMs: number;
  colorsMs: number;
  pricesMs: number;
  mapMs: number;
  groupMs: number;
  countMs: number;
  rankMs: number;
  totalMs: number;
};

function searchGroupKeyForItem(item: CardListItem): string {
  const printing = item.printings[0];
  if (!printing) return item.cardId;
  return searchGroupKeyForRow({
    cardId: item.cardId,
    variantNumber: printing.variantNumber,
    variantLabel: printing.variantLabel,
    foilMode: printing.foilMode ?? '',
  });
}

function searchCacheKey(
  query: CardsListQuery,
  catalogHash: string,
  pricesCatalogHash: string
): string {
  return JSON.stringify({
    catalogHash,
    pricesCatalogHash,
    q: query.q?.trim().toLowerCase() ?? '',
    sets: query.sets ?? '',
    colors: query.colors ?? '',
    colorMode: query.colorMode ?? 'all',
    types: query.types ?? '',
    super: query.super ?? '',
    rarities: query.rarities ?? '',
    variants: query.variants ?? '',
    energyMin: query.energyMin,
    energyMax: query.energyMax,
    powerMin: query.powerMin,
    powerMax: query.powerMax,
    mightMin: query.mightMin,
    mightMax: query.mightMax,
    excludeTokens: query.excludeTokens ?? '',
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    dir: query.dir,
  });
}

export class CardCacheService {
  private readonly searchCache = new TtlCache<SearchResult>(SEARCH_RESULT_TTL_MS, 100);
  private readonly upstreamCheckCache = new TtlCache<true>(UPSTREAM_CHECK_TTL_MS, 200);
  private readonly variantIdResolveCache = new TtlCache<string>(
    VARIANT_ID_RESOLVE_TTL_MS,
    1000
  );
  private catalogHashMemo: string | null = null;
  private pricesCatalogHashMemo: string | null = null;

  constructor(
    private readonly db: Database,
    private readonly pa: PaClient,
    private readonly prices: PriceCacheService,
    private readonly images: ImageStoreService,
    private readonly embeddings: EmbeddingService | null = null
  ) {}

  private async priceRowsForLogicalCard(card: PaLogicalCard) {
    const cardmarketIds = card.variants
      .map((variant) => variant.cardmarketId)
      .filter((id): id is number => id != null);
    return this.prices.getRowsForCardmarketIds(cardmarketIds);
  }

  private overlayVariantMarketplaceIds(
    variant: PaVariant,
    dbVariant: {
      cardmarketId: number | null;
      tcgplayerId: number | null;
    }
  ): PaVariant {
    return {
      ...variant,
      // Prefer upstream ids when present — backfill can latch onto a Signed CM SKU.
      cardmarketId: variant.cardmarketId ?? dbVariant.cardmarketId ?? null,
      tcgplayerId: variant.tcgplayerId ?? dbVariant.tcgplayerId ?? null,
    };
  }

  private mergeVariantMarketplaceIds(
    card: PaLogicalCard,
    dbVariants: Array<{
      variantNumber: string;
      cardmarketId: number | null;
      tcgplayerId: number | null;
    }>
  ): PaLogicalCard {
    const byNumber = new Map(
      dbVariants.map((row) => [row.variantNumber.toLowerCase(), row] as const)
    );

    return {
      ...card,
      variants: card.variants.map((variant) => {
        const dbRow = byNumber.get(variant.variantNumber.toLowerCase());
        if (!dbRow) return variant;
        return {
          ...variant,
          cardmarketId: variant.cardmarketId ?? dbRow.cardmarketId ?? null,
          tcgplayerId: variant.tcgplayerId ?? dbRow.tcgplayerId ?? null,
        };
      }),
    };
  }

  /** Push non-null upstream marketplace ids even when the card content hash is unchanged. */
  private async applyUpstreamMarketplaceIds(card: PaLogicalCard): Promise<void> {
    const now = new Date();
    let pricesFingerprintDirty = false;
    for (const variant of card.variants) {
      if (variant.cardmarketId == null && variant.tcgplayerId == null) continue;
      pricesFingerprintDirty = true;
      const patch: {
        cardmarketId?: number;
        tcgplayerId?: number;
        updatedAt: Date;
      } = { updatedAt: now };
      if (variant.cardmarketId != null) patch.cardmarketId = variant.cardmarketId;
      if (variant.tcgplayerId != null) patch.tcgplayerId = variant.tcgplayerId;
      // Match by variant_number — synthetic rows may keep a local id after PA catalogs them.
      await this.db
        .update(variants)
        .set(patch)
        .where(eq(variants.variantNumber, variant.variantNumber));
    }
    if (pricesFingerprintDirty) {
      this.invalidatePricesSearchCache();
    }
  }

  invalidateSearchCache(): void {
    this.searchCache.clear();
    this.catalogHashMemo = null;
    this.pricesCatalogHashMemo = null;
  }

  /** Search cache keys include the prices fingerprint — refresh after marketplace id patches. */
  private invalidatePricesSearchCache(): void {
    this.pricesCatalogHashMemo = null;
    this.searchCache.clear();
  }

  async getCatalogHash(): Promise<string> {
    if (this.catalogHashMemo != null) return this.catalogHashMemo;
    const row = await this.db.query.syncState.findFirst({
      where: eq(syncState.key, 'catalog'),
    });
    const hash = row?.contentHash ?? '';
    this.catalogHashMemo = hash;
    return hash;
  }

  async getPricesCatalogHash(): Promise<string> {
    if (this.pricesCatalogHashMemo != null) return this.pricesCatalogHashMemo;
    const [pricesRow, mappedCountRow] = await Promise.all([
      this.db.query.syncState.findFirst({
        where: eq(syncState.key, 'prices'),
      }),
      this.db
        .select({ value: count() })
        .from(variants)
        .where(isNotNull(variants.cardmarketId)),
    ]);
    const mappedCount = mappedCountRow[0]?.value ?? 0;
    const hash = `${pricesRow?.contentHash ?? ''}:${String(mappedCount)}`;
    this.pricesCatalogHashMemo = hash;
    return hash;
  }

  async upsertFromUpstream(card: PaLogicalCard): Promise<boolean> {
    const hash = paCardHash(card);
    const existing = await this.db.query.cards.findFirst({
      where: eq(cards.id, card.id),
    });
    if (existing?.contentHash === hash) {
      await this.applyUpstreamMarketplaceIds(card);
      return false;
    }

    const now = new Date();

    await this.db.transaction(async (tx) => {
      for (const c of card.colors) {
        await tx
          .insert(colors)
          .values({
            id: c.id,
            name: c.name,
            hexCode: c.hexCode ?? null,
            imageUrl: c.imageUrl ?? null,
          })
          .onConflictDoUpdate({
            target: colors.id,
            set: {
              name: c.name,
              hexCode: c.hexCode ?? null,
              imageUrl: c.imageUrl ?? null,
            },
          });
      }

      await tx
        .insert(cards)
        .values({
          id: card.id,
          name: card.name,
          type: card.type,
          super: card.super ?? null,
          description: card.description,
          energy: card.energy,
          might: card.might,
          power: card.power,
          tags: card.tags,
          attachText: card.attachText ?? null,
          effect: card.effect ?? null,
          mightBonus: card.mightBonus ?? 0,
          maxCopies: card.maxCopies ?? null,
          banEffectiveDate: card.banEffectiveDate
            ? new Date(card.banEffectiveDate)
            : null,
          contentHash: hash,
          upstreamRaw: card,
          fetchedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: cards.id,
          set: {
            name: card.name,
            type: card.type,
            super: card.super ?? null,
            description: card.description,
            energy: card.energy,
            might: card.might,
            power: card.power,
            tags: card.tags,
            attachText: card.attachText ?? null,
            effect: card.effect ?? null,
            mightBonus: card.mightBonus ?? 0,
            maxCopies: card.maxCopies ?? null,
            banEffectiveDate: card.banEffectiveDate
              ? new Date(card.banEffectiveDate)
              : null,
            contentHash: hash,
            upstreamRaw: card,
            fetchedAt: now,
            updatedAt: now,
          },
        });

      await tx.delete(cardColors).where(eq(cardColors.cardId, card.id));

      for (const c of card.colors) {
        await tx.insert(cardColors).values({ cardId: card.id, colorId: c.id });
      }

      for (const variant of card.variants) {
        await this.upsertVariant(tx, card.id, variant, now);
      }
    });

    if (this.embeddings) {
      try {
        await this.embeddings.upsertCardEmbedding(card);
      } catch (error) {
        console.warn(`Embedding skipped for ${card.name}:`, error);
      }
    }

    return true;
  }

  private mapDetail(
    card: PaLogicalCard,
    priceRows: Parameters<typeof mapCardDetail>[1]
  ) {
    return mapCardDetail(this.images.rewriteCard(card), priceRows);
  }

  private mapItem(
    card: PaLogicalCard,
    variant: PaVariant,
    priceRows: Parameters<typeof mapListItem>[2]
  ) {
    const rewritten = this.images.rewriteCard(card);
    const fromCard = rewritten.variants.find(
      (v) => v.variantNumber === variant.variantNumber
    );
    // Prefer caller marketplace IDs — DB overlays live on variant; upstreamRaw often still null (e.g. VEN).
    const rewrittenVariant: PaVariant = {
      ...(fromCard ?? variant),
      imageUrl: this.images.rewriteImageUrl((fromCard ?? variant).imageUrl),
      cardmarketId: variant.cardmarketId ?? fromCard?.cardmarketId ?? null,
      tcgplayerId: variant.tcgplayerId ?? fromCard?.tcgplayerId ?? null,
    };
    return mapListItem(rewritten, rewrittenVariant, priceRows);
  }

  private async upsertVariant(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    cardId: string,
    variant: PaVariant,
    now: Date
  ) {
    const vHash = paVariantHash(variant);

    await tx
      .insert(sets)
      .values({
        id: variant.set.id,
        code: variant.set.prefix,
        name: variant.set.name,
        releaseDate: variant.set.releaseDate ?? null,
      })
      .onConflictDoUpdate({
        target: sets.id,
        set: {
          code: variant.set.prefix,
          name: variant.set.name,
          releaseDate: variant.set.releaseDate ?? null,
          updatedAt: now,
        },
      });

    // Synthetic Signed rows keep local PK when PA later catalogs same variant_number (unique VN; collection FKs unsafe to delete+insert).
    const existingByNumber = await tx.query.variants.findFirst({
      where: eq(variants.variantNumber, variant.variantNumber),
      columns: { id: true, cardmarketId: true },
    });
    if (existingByNumber && existingByNumber.id !== variant.id) {
      await tx
        .update(variants)
        .set({
          cardId,
          rarity: variant.rarity,
          variantType: variant.variantType,
          foilMode: variant.foilMode,
          variantTypes: variant.variantTypes,
          imageUrl: variant.imageUrl,
          flavorText: variant.flavorText ?? null,
          artist: variant.artist ?? null,
          releaseDate: variant.releaseDate ?? null,
          variantLabel: variant.variantLabel,
          showInLibrary: variant.showInLibrary,
          isCollectible: variant.isCollectible,
          contentHash: vHash,
          upstreamRaw: variant,
          cardmarketId: variant.cardmarketId ?? existingByNumber.cardmarketId ?? null,
          tcgplayerId: variant.tcgplayerId ?? null,
          parentVariantId: variant.parentVariantId ?? null,
          setId: variant.set.id,
          fetchedAt: now,
          updatedAt: now,
        })
        .where(eq(variants.id, existingByNumber.id));
      return;
    }

    await tx
      .insert(variants)
      .values({
        id: variant.id,
        cardId,
        variantNumber: variant.variantNumber,
        rarity: variant.rarity,
        variantType: variant.variantType,
        foilMode: variant.foilMode,
        variantTypes: variant.variantTypes,
        imageUrl: variant.imageUrl,
        flavorText: variant.flavorText ?? null,
        artist: variant.artist ?? null,
        releaseDate: variant.releaseDate ?? null,
        variantLabel: variant.variantLabel,
        showInLibrary: variant.showInLibrary,
        isCollectible: variant.isCollectible,
        cardmarketId: variant.cardmarketId ?? null,
        tcgplayerId: variant.tcgplayerId ?? null,
        parentVariantId: variant.parentVariantId ?? null,
        setId: variant.set.id,
        contentHash: vHash,
        upstreamRaw: variant,
        fetchedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: variants.id,
        set: {
          cardId,
          variantNumber: variant.variantNumber,
          rarity: variant.rarity,
          variantType: variant.variantType,
          foilMode: variant.foilMode,
          variantTypes: variant.variantTypes,
          imageUrl: variant.imageUrl,
          flavorText: variant.flavorText ?? null,
          artist: variant.artist ?? null,
          releaseDate: variant.releaseDate ?? null,
          variantLabel: variant.variantLabel,
          showInLibrary: variant.showInLibrary,
          isCollectible: variant.isCollectible,
          contentHash: vHash,
          upstreamRaw: variant,
          cardmarketId: sql`coalesce(excluded.cardmarket_id, ${variants.cardmarketId})`,
          tcgplayerId: variant.tcgplayerId ?? null,
          parentVariantId: variant.parentVariantId ?? null,
          setId: variant.set.id,
          fetchedAt: now,
          updatedAt: now,
        },
      });
  }

  async getByVariantNumber(
    variantNumber: string,
    options?: { refresh?: boolean }
  ): Promise<{
    detail: CardDetail;
    source: 'cache' | 'upstream' | 'cache-refreshed';
    contentHash: string;
  }> {
    const cached = await this.loadCardDetailFromDb(variantNumber);

    if (cached && !options?.refresh) {
      return {
        detail: cached.detail,
        source: 'cache',
        contentHash: cached.contentHash,
      };
    }

    try {
      const upstream = await this.pa.getCard(variantNumber);
      const changed = await this.upsertFromUpstream(upstream);
      if (changed || options?.refresh) {
        this.invalidateSearchCache();
      }
      // Reload so local-only siblings (e.g. synthetic Overnumbered Signed) stay visible.
      const reloaded = await this.loadCardDetailFromDb(variantNumber);
      if (reloaded) {
        return {
          detail: reloaded.detail,
          source: cached ? (changed ? 'cache-refreshed' : 'cache') : 'upstream',
          contentHash: reloaded.contentHash,
        };
      }
      const priceRows = await this.priceRowsForLogicalCard(upstream);
      return {
        detail: this.mapDetail(upstream, priceRows),
        source: cached ? (changed ? 'cache-refreshed' : 'cache') : 'upstream',
        contentHash: paCardHash(upstream),
      };
    } catch (err) {
      // Local-only synthetics (VEN-189*) absent from PA — serve cache on 404; do not hide failures for real cards.
      const notFound = err instanceof PaApiError && err.status === 404;
      const localOnlySynthetic = variantNumber.trim().endsWith('*');
      if (cached && notFound && localOnlySynthetic) {
        return {
          detail: cached.detail,
          source: 'cache',
          contentHash: cached.contentHash,
        };
      }
      throw err;
    }
  }

  async resolveVariantNumbersFromUpstream(
    refs: Array<{ variantId: string; cardId: string }>,
    resolved: Map<string, string>
  ): Promise<void> {
    const pending = new Map<string, string>();

    for (const ref of refs) {
      if (resolved.has(ref.variantId)) continue;

      const local = await this.resolveVariantNumberLocally(ref.variantId, ref.cardId);
      if (local) {
        resolved.set(ref.variantId, local);
        continue;
      }

      pending.set(ref.variantId, ref.cardId);
    }

    if (pending.size > 0) {
      await this.discoverPendingVariantsInUpstreamCatalog(pending, resolved);
    }
  }

  async resolveVariantNumberByUpstreamId(
    variantId: string,
    cardId: string
  ): Promise<string | null> {
    const local = await this.resolveVariantNumberLocally(variantId, cardId);
    if (local) return local;

    const pending = new Map<string, string>([[variantId, cardId]]);
    const resolved = new Map<string, string>();
    await this.discoverPendingVariantsInUpstreamCatalog(pending, resolved);
    return resolved.get(variantId) ?? null;
  }

  private async resolveVariantNumberLocally(
    variantId: string,
    cardId: string
  ): Promise<string | null> {
    const cached = this.variantIdResolveCache.get(variantId);
    if (cached) return cached;

    const byId = await this.db.query.variants.findFirst({
      where: eq(variants.id, variantId),
    });
    if (byId) {
      this.variantIdResolveCache.set(variantId, byId.variantNumber);
      return byId.variantNumber;
    }

    const cardRow = await this.db.query.cards.findFirst({
      where: eq(cards.id, cardId),
    });
    if (cardRow) {
      const logical = cardRow.upstreamRaw as PaLogicalCard;
      const fromRaw = logical.variants.find((variant) => variant.id === variantId);
      if (fromRaw) {
        await this.upsertFromUpstream(logical);
        this.variantIdResolveCache.set(variantId, fromRaw.variantNumber);
        return fromRaw.variantNumber;
      }

      const seedVariant = logical.variants[0];
      if (seedVariant) {
        try {
          const refreshed = await this.getByVariantNumber(seedVariant.variantNumber, {
            refresh: true,
          });
          const match = refreshed.detail.variants.find(
            (variant) => variant.id === variantId
          );
          if (match) {
            this.variantIdResolveCache.set(variantId, match.variantNumber);
            return match.variantNumber;
          }
        } catch {}
      }
    }

    const sibling = await this.db.query.variants.findFirst({
      where: eq(variants.cardId, cardId),
    });
    if (sibling) {
      try {
        const refreshed = await this.getByVariantNumber(sibling.variantNumber, {
          refresh: true,
        });
        const match = refreshed.detail.variants.find(
          (variant) => variant.id === variantId
        );
        if (match) {
          this.variantIdResolveCache.set(variantId, match.variantNumber);
          return match.variantNumber;
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  private async discoverPendingVariantsInUpstreamCatalog(
    pending: Map<string, string>,
    resolved: Map<string, string>
  ): Promise<void> {
    if (pending.size === 0) return;

    const pendingCardIds = new Set(pending.values());
    const fetchedCardIds = new Set<string>();
    let page = 1;
    const maxPages = 500;

    while (pending.size > 0 && page <= maxPages) {
      const upstream = await this.pa.listCards({ page, limit: 100 });
      const res = PaCardsListResponse.parse(upstream);

      for (const item of res.data) {
        if (pending.has(item.id)) {
          try {
            const logical = await this.pa.getCard(item.variantNumber);
            await this.upsertFromUpstream(logical);
            resolved.set(item.id, item.variantNumber);
            this.variantIdResolveCache.set(item.id, item.variantNumber);
            pending.delete(item.id);
          } catch (err) {
            console.warn(`Catalog discover skipped ${item.variantNumber}:`, err);
          }
          continue;
        }

        const listCardId =
          item.card &&
          typeof item.card === 'object' &&
          item.card !== null &&
          'id' in item.card &&
          typeof (item.card as { id?: unknown }).id === 'string'
            ? (item.card as { id: string }).id
            : undefined;
        if (
          !listCardId ||
          !pendingCardIds.has(listCardId) ||
          fetchedCardIds.has(listCardId)
        ) {
          continue;
        }

        fetchedCardIds.add(listCardId);
        try {
          const logical = await this.pa.getCard(item.variantNumber);
          await this.upsertFromUpstream(logical);
          for (const variant of logical.variants) {
            if (!pending.has(variant.id)) continue;
            resolved.set(variant.id, variant.variantNumber);
            this.variantIdResolveCache.set(variant.id, variant.variantNumber);
            pending.delete(variant.id);
          }
        } catch (err) {
          console.warn(`Catalog discover skipped logical card ${listCardId}:`, err);
        }
      }

      if (!res.pagination.hasNext || page >= res.pagination.totalPages) break;
      page += 1;
    }
  }

  private async loadCardDetailFromDb(variantNumber: string) {
    const [variantRow] = await this.db
      .select()
      .from(variants)
      .where(sql`lower(${variants.variantNumber}) = ${variantNumber.toLowerCase()}`)
      .limit(1);
    if (!variantRow) return null;

    const cardRow = await this.db.query.cards.findFirst({
      where: eq(cards.id, variantRow.cardId),
    });
    if (!cardRow) return null;

    const dbVariants = await this.db
      .select({
        variantNumber: variants.variantNumber,
        cardmarketId: variants.cardmarketId,
        tcgplayerId: variants.tcgplayerId,
        upstreamRaw: variants.upstreamRaw,
      })
      .from(variants)
      .where(eq(variants.cardId, variantRow.cardId));

    const withLocals = this.mergeLocalOnlyVariants(
      cardRow.upstreamRaw as PaLogicalCard,
      dbVariants
    );
    const upstream = this.mergeVariantMarketplaceIds(withLocals, dbVariants);
    const priceRows = await this.priceRowsForLogicalCard(upstream);
    return {
      detail: this.mapDetail(upstream, priceRows),
      contentHash: cardRow.contentHash,
    };
  }

  /** Keep DB-only printings (synthetic Signed Overnumbered) on the logical card. */
  private mergeLocalOnlyVariants(
    card: PaLogicalCard,
    dbVariants: Array<{
      variantNumber: string;
      cardmarketId: number | null;
      tcgplayerId: number | null;
      upstreamRaw: unknown;
    }>
  ): PaLogicalCard {
    const known = new Set(
      card.variants.map((variant) => variant.variantNumber.toLowerCase())
    );
    const extras: PaVariant[] = [];
    for (const row of dbVariants) {
      if (known.has(row.variantNumber.toLowerCase())) continue;
      const raw = row.upstreamRaw as PaVariant;
      extras.push({
        ...raw,
        cardmarketId: row.cardmarketId ?? raw.cardmarketId ?? null,
        tcgplayerId: row.tcgplayerId ?? raw.tcgplayerId ?? null,
      });
    }
    if (extras.length === 0) return card;
    return {
      ...card,
      variants: [...card.variants, ...extras].sort((a, b) =>
        a.variantNumber.localeCompare(b.variantNumber)
      ),
    };
  }

  async batchGet(variantNumbers: string[]): Promise<{
    found: CardDetail[];
    notFound: string[];
    source: 'cache' | 'mixed' | 'upstream';
  }> {
    const found: CardDetail[] = [];
    const missing: string[] = [];

    for (const vn of variantNumbers) {
      const cached = await this.loadCardDetailFromDb(vn);
      if (cached) {
        found.push(cached.detail);
      } else {
        missing.push(vn);
      }
    }

    if (missing.length === 0) {
      return { found, notFound: [], source: 'cache' };
    }

    const batch = await this.pa.batchCards(missing);
    for (const item of batch.data) {
      const logical = await this.pa.getCard(item.variantNumber);
      await this.upsertFromUpstream(logical);
      const priceRows = await this.priceRowsForLogicalCard(logical);
      found.push(this.mapDetail(logical, priceRows));
    }

    return {
      found,
      notFound: batch.notFound,
      source: found.length === variantNumbers.length ? 'upstream' : 'mixed',
    };
  }

  async search(query: CardsListQuery): Promise<SearchResult> {
    const pipelineStart = performance.now();
    const hashStart = performance.now();
    const [catalogHash, pricesCatalogHash] = await Promise.all([
      this.getCatalogHash(),
      this.getPricesCatalogHash(),
    ]);
    const hashMs = performance.now() - hashStart;
    const cacheKey = searchCacheKey(query, catalogHash, pricesCatalogHash);
    const hasSearchQuery = Boolean(query.q?.trim() && query.q.trim().length >= 2);

    if (!query.refresh) {
      const cached = this.searchCache.get(cacheKey);
      // Never serve a cached miss — newly added upstream cards must be discoverable on next search.
      if (cached && cached.total > 0 && !hasSearchQuery) {
        logSearchCacheHit({
          path: 'cards_list',
          ...summarizeCardsListQuery(query),
          itemsReturned: cached.items.length,
          total: cached.total,
          source: cached.source,
          totalMs: Math.round((performance.now() - pipelineStart) * 100) / 100,
        });
        return cached;
      }
    }

    let source: 'cache' | 'upstream' | 'mixed' = 'cache';
    const localStart = performance.now();
    let result = await this.searchLocal(query, catalogHash);
    const localMs = performance.now() - localStart;

    const reconcileMode = resolveUpstreamReconcileMode(
      query,
      result,
      this.upstreamCheckCache.has(upstreamCheckKey(query)) && !query.refresh
    );

    let reconcileMs = 0;
    if (reconcileMode === 'sync') {
      const reconcileStart = performance.now();
      const localTimings = result.timings;
      const reconciled = await this.reconcileSearchWithUpstream(query, result);
      result = localTimings
        ? { ...reconciled.result, timings: localTimings }
        : reconciled.result;
      source = reconciled.source;
      reconcileMs = performance.now() - reconcileStart;
    }

    const response: SearchResult = { ...result, source };
    if (response.total > 0 || response.source === 'upstream') {
      this.searchCache.set(cacheKey, response);
    } else {
      this.searchCache.delete(cacheKey);
    }

    logSearchPipeline({
      path: 'cards_list',
      ...summarizeCardsListQuery(query),
      engine: 'postgres',
      cacheHit: false,
      hashMs: Math.round(hashMs * 100) / 100,
      localMs: Math.round(localMs * 100) / 100,
      reconcileMs: Math.round(reconcileMs * 100) / 100,
      reconciled: reconcileMode === 'sync',
      source: response.source,
      itemsReturned: response.items.length,
      total: response.total,
      totalMs: Math.round((performance.now() - pipelineStart) * 100) / 100,
    });

    return response;
  }

  private async resolveReconcileResult(
    query: CardsListQuery,
    localResult:
      { items: CardListItem[]; total: number; catalogHash?: string } | undefined,
    upserted: number
  ): Promise<{ items: CardListItem[]; total: number; catalogHash: string }> {
    if (upserted > 0 || !localResult) {
      // Reuse the hash from the pipeline start so cacheKey and result stay aligned.
      const catalogHash = localResult?.catalogHash ?? (await this.getCatalogHash());
      return this.searchLocal(query, catalogHash);
    }

    const catalogHash = localResult.catalogHash ?? (await this.getCatalogHash());
    return {
      items: localResult.items,
      total: localResult.total,
      catalogHash,
    };
  }

  private async reconcileSearchWithUpstream(
    query: CardsListQuery,
    localResult?: { items: CardListItem[]; total: number; catalogHash?: string }
  ): Promise<{
    result: { items: CardListItem[]; total: number; catalogHash: string };
    source: 'cache' | 'upstream' | 'mixed';
  }> {
    const checkKey = upstreamCheckKey(query);
    const localEmpty =
      (localResult?.total ?? 0) === 0 || (localResult?.items.length ?? 0) === 0;

    // Skip prior successful checks only with local hits; empty local always re-queries upstream.
    if (
      this.upstreamCheckCache.has(checkKey) &&
      !query.refresh &&
      !localEmpty &&
      localResult
    ) {
      const catalogHash = localResult.catalogHash ?? (await this.getCatalogHash());
      return {
        result: { items: localResult.items, total: localResult.total, catalogHash },
        source: 'cache',
      };
    }

    try {
      const reconcileStart = performance.now();
      let upserted = 0;
      let page = query.page;
      let upstreamTotal = 0;
      let pagesScanned = 0;
      let consecutiveCleanPages = 0;
      // Walk until local catches upstream (or hard cap); deck-builder identity used to stop at 5 pages and miss cards.
      const maxBackfillPages = maxUpstreamBackfillPages(query);
      const colorsOmittedForWithin =
        query.colorMode === 'within' && Boolean(query.colors);

      while (pagesScanned < maxBackfillPages) {
        const upstream = await this.pa.listCards(
          buildUpstreamListParams({ ...query, page })
        );
        pagesScanned += 1;
        upstreamTotal = upstream.pagination?.total ?? upstream.data.length;

        const upstreamVariantNumbers = upstream.data.map((item) => item.variantNumber);
        const existingLocally =
          await this.findExistingVariantNumbers(upstreamVariantNumbers);
        const missing = upstream.data.filter(
          (item) => !existingLocally.has(item.variantNumber.toLowerCase())
        );

        for (const item of missing) {
          try {
            const logical = await this.pa.getCard(item.variantNumber);
            await this.upsertFromUpstream(logical);
            upserted += 1;
          } catch (err) {
            console.warn(`Search backfill skipped ${item.variantNumber}:`, err);
          }
        }

        if (missing.length === 0) consecutiveCleanPages += 1;
        else consecutiveCleanPages = 0;

        const localTotal = (localResult?.total ?? 0) + upserted;

        // Local already covers upstream — skip remaining pages and avoid a second PG search.
        if (
          !localEmpty &&
          localResult &&
          upserted === 0 &&
          missing.length === 0 &&
          !colorsOmittedForWithin &&
          localTotal >= upstreamTotal
        ) {
          this.upstreamCheckCache.set(checkKey, true);
          const catalogHash = localResult.catalogHash ?? (await this.getCatalogHash());
          const tookMs = Math.round((performance.now() - reconcileStart) * 100) / 100;
          logSearchReconcile({
            ...summarizeCardsListQuery(query),
            pagesScanned,
            upserted,
            upstreamTotal,
            localTotal,
            tookMs,
            source: 'cache',
            sufficient: true,
          });
          return {
            result: { items: localResult.items, total: localResult.total, catalogHash },
            source: 'cache',
          };
        }

        const stillBehind = upstreamTotal > localTotal;
        const hasNext =
          Boolean(upstream.pagination?.hasNext) &&
          page < (upstream.pagination?.totalPages ?? page);

        // Within-mode without colors: upstream totals are broader — use clean-page streaks instead.
        const caughtUp = colorsOmittedForWithin
          ? consecutiveCleanPages >= 5
          : !stillBehind;

        if (caughtUp || !hasNext) break;
        page += 1;
      }

      if (upserted > 0) {
        this.invalidateSearchCache();
      }

      const result = await this.resolveReconcileResult(query, localResult, upserted);
      const reconcileFields = {
        ...summarizeCardsListQuery(query),
        pagesScanned,
        upserted,
        upstreamTotal,
        localTotal: result.total,
        tookMs: Math.round((performance.now() - reconcileStart) * 100) / 100,
      };

      if (upserted > 0) {
        this.upstreamCheckCache.set(checkKey, true);
        logSearchReconcile({ ...reconcileFields, source: 'mixed' });
        return { result, source: 'mixed' };
      }

      if (localEmpty && upstreamTotal === 0) {
        this.upstreamCheckCache.set(checkKey, true);
        logSearchReconcile({ ...reconcileFields, source: 'upstream' });
        return { result, source: 'upstream' };
      }

      // Upstream reports more matches — keep probing next request; skip when within-mode omitted colors.
      if (!colorsOmittedForWithin && upstreamTotal > result.total) {
        this.upstreamCheckCache.delete(checkKey);
      } else {
        this.upstreamCheckCache.set(checkKey, true);
      }

      if (pagesScanned > 0) {
        logSearchReconcile({ ...reconcileFields, source: 'cache' });
      }

      return { result, source: 'cache' };
    } catch (err) {
      console.warn('Upstream search unavailable, using local cache only:', err);
      return {
        result: await this.resolveReconcileResult(query, localResult, 0),
        source: 'cache',
      };
    }
  }

  private async findExistingVariantNumbers(
    variantNumbers: string[]
  ): Promise<Set<string>> {
    if (variantNumbers.length === 0) return new Set();
    const rows = await this.db
      .select({ variantNumber: variants.variantNumber })
      .from(variants)
      .where(
        sql`lower(${variants.variantNumber}) in (${sql.join(
          variantNumbers.map((value) => sql`${value.toLowerCase()}`),
          sql`, `
        )})`
      );
    return new Set(rows.map((row) => row.variantNumber.toLowerCase()));
  }

  async globalSearch(query: GlobalSearchQuery): Promise<GlobalSearchResponse> {
    const start = performance.now();
    const catalogHash = await this.getCatalogHash();
    const requestedTypes = (query.types ?? 'cards')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    const includeCards =
      requestedTypes.length === 0 || requestedTypes.includes('cards');
    const includeDecks = requestedTypes.includes('decks');

    const data: GlobalSearchResponse['data'] = {};
    let cardHits = 0;
    let cardTotal = 0;
    let searchMs = 0;

    if (includeCards) {
      const searchStart = performance.now();
      const result = await this.search({
        q: query.q,
        page: query.page,
        limit: query.limit,
        sortBy: 'name',
        dir: 'asc',
        colorMode: 'all',
      });
      searchMs = performance.now() - searchStart;
      cardHits = result.items.length;
      cardTotal = result.total;
      data.cards = {
        hits: result.items.map((item) => ({
          kind: 'card' as const,
          variantNumber: item.variantNumber,
          name: item.name,
          imageUrl: item.imageUrl,
          setCode: item.setCode,
          type: item.type,
          rarity: item.rarity,
        })),
        total: result.total,
      };
    }

    if (includeDecks) {
      data.decks = { hits: [], total: 0 };
    }

    const tookMs = Math.round(performance.now() - start);
    logSearchGlobal({
      path: 'global_search',
      ...summarizeGlobalSearchQuery(query),
      includeCards,
      includeDecks,
      hitsReturned: cardHits,
      total: cardTotal,
      searchMs: Math.round(searchMs * 100) / 100,
      tookMs,
    });

    return {
      data,
      meta: {
        tookMs,
        catalogHash,
      },
    };
  }

  private async searchLocal(
    query: CardsListQuery,
    catalogHash?: string
  ): Promise<{
    items: CardListItem[];
    total: number;
    catalogHash: string;
    timings?: LocalSearchTimings;
  }> {
    return this.searchLocalPostgres(query, catalogHash);
  }

  async searchLocalWithoutUpstream(query: CardsListQuery): Promise<{
    items: CardListItem[];
    total: number;
    catalogHash: string;
    timings: LocalSearchTimings;
  }> {
    const result = await this.searchLocal(query);
    return {
      ...result,
      timings: result.timings ?? {
        dbMs: 0,
        colorsMs: 0,
        pricesMs: 0,
        mapMs: 0,
        groupMs: 0,
        countMs: 0,
        rankMs: 0,
        totalMs: 0,
      },
    };
  }

  private async loadColorNamesByCardIds(
    cardIds: string[]
  ): Promise<Map<string, string[]>> {
    if (cardIds.length === 0) return new Map();

    const colorRows = await this.db
      .select({
        cardId: cardColors.cardId,
        colorName: colors.name,
      })
      .from(cardColors)
      .innerJoin(colors, eq(cardColors.colorId, colors.id))
      .where(inArray(cardColors.cardId, cardIds));

    const colorsByCard = new Map<string, string[]>();
    for (const row of colorRows) {
      const list = colorsByCard.get(row.cardId) ?? [];
      list.push(row.colorName);
      colorsByCard.set(row.cardId, list);
    }
    return colorsByCard;
  }

  private async hydrateSlimRows(
    rows: ListItemDbRow[],
    preloadedPrices?: PaPriceRow[]
  ): Promise<{
    items: CardListItem[];
    colorsMs: number;
    pricesMs: number;
    mapMs: number;
  }> {
    if (rows.length === 0) {
      return { items: [], colorsMs: 0, pricesMs: 0, mapMs: 0 };
    }

    const cardIds = [...new Set(rows.map((row) => row.cardId))];
    const cardmarketIds = rows
      .map((row) => row.cardmarketId)
      .filter((id): id is number => id != null);

    let colorsMs = 0;
    let pricesMs = 0;
    const colorsPromise = (async () => {
      const start = performance.now();
      const result = await this.loadColorNamesByCardIds(cardIds);
      colorsMs = performance.now() - start;
      return result;
    })();
    const pricesPromise = (async () => {
      if (preloadedPrices !== undefined) return preloadedPrices;
      const start = performance.now();
      const result = await this.prices.getRowsForCardmarketIds(cardmarketIds);
      pricesMs = performance.now() - start;
      return result;
    })();
    const [colorsByCard, priceRows] = await Promise.all([colorsPromise, pricesPromise]);

    const mapStart = performance.now();
    const items = rows.map((row) =>
      mapListItemFromDbRow(row, colorsByCard.get(row.cardId) ?? [], priceRows, (url) =>
        this.images.rewriteImageUrl(url)
      )
    );
    const mapMs = performance.now() - mapStart;

    return { items, colorsMs, pricesMs, mapMs };
  }

  private async searchLocalPostgres(
    query: CardsListQuery,
    catalogHash?: string
  ): Promise<{
    items: CardListItem[];
    total: number;
    catalogHash: string;
    timings: LocalSearchTimings;
  }> {
    const totalStart = performance.now();
    const where = buildSearchWhere(query);
    const offset = (query.page - 1) * query.limit;
    const materializeThenPage = shouldMaterializeThenPage(query);
    const resolvedCatalogHash = catalogHash ?? (await this.getCatalogHash());

    const dbStart = performance.now();
    const rows = materializeThenPage
      ? await buildSearchCandidateQueryUnsorted(this.db, where)
      : await buildSearchCandidateQuery(this.db, query)
          .limit(query.limit)
          .offset(offset);
    const dbMs = performance.now() - dbStart;

    logSearchPostgresQuery({
      path: 'cards_list',
      ...summarizeCardsListQuery(query),
      engine: 'postgres',
      materializeThenPage,
      fetchCap: null,
      variantsSelected: rows.length,
      dbMs: Math.round(dbMs * 100) / 100,
    });

    if (!materializeThenPage) {
      const {
        items: rawItems,
        colorsMs,
        pricesMs,
        mapMs,
      } = await this.hydrateSlimRows(rows);
      const hydration = summarizeHydrationTimings({ colorsMs, pricesMs, mapMs });
      const groupStart = performance.now();
      const grouped = groupCardListItems(rawItems);
      const groupMs = performance.now() - groupStart;
      const countStart = performance.now();
      const [totalRow] = await this.db
        .select({ value: count() })
        .from(variants)
        .innerJoin(cards, eq(variants.cardId, cards.id))
        .innerJoin(sets, eq(variants.setId, sets.id))
        .where(where);
      const countMs = performance.now() - countStart;
      const total = totalRow?.value ?? 0;
      const timings: LocalSearchTimings = {
        dbMs,
        colorsMs,
        pricesMs,
        mapMs,
        groupMs,
        countMs,
        rankMs: 0,
        totalMs: performance.now() - totalStart,
      };
      logSearchComplete({
        path: 'cards_list',
        engine: 'postgres',
        ...summarizeCardsListQuery(query),
        materializeThenPage,
        fetchCap: null,
        variantsSelected: rows.length,
        variantsHydrated: rawItems.length,
        groupedCount: grouped.length,
        itemsReturned: grouped.length,
        total,
        dbMs: Math.round(dbMs * 100) / 100,
        ...hydration,
        groupMs: Math.round(groupMs * 100) / 100,
        countMs: Math.round(countMs * 100) / 100,
        totalMs: Math.round(timings.totalMs * 100) / 100,
      });
      return { items: grouped, total, catalogHash: resolvedCatalogHash, timings };
    }

    const groupStart = performance.now();
    let groups = groupSearchCandidateRows(rows);
    let rankMs = 0;
    let pricesMs = 0;
    let sortPriceRows: PaPriceRow[] | undefined;

    if (query.sortBy === 'price') {
      const priceStart = performance.now();
      const cardmarketIds = groups.flatMap((group) =>
        group.rows
          .map((row) => row.cardmarketId)
          .filter((id): id is number => id != null)
      );
      sortPriceRows = await this.prices.getRowsForCardmarketIds(cardmarketIds);
      pricesMs = performance.now() - priceStart;
      const sign = query.dir === 'asc' ? 1 : -1;
      groups = [...groups].sort((left, right) => {
        const diff =
          (candidateGroupMaxMarketPrice(left.rows, sortPriceRows ?? []) -
            candidateGroupMaxMarketPrice(right.rows, sortPriceRows ?? [])) *
          sign;
        if (diff !== 0) return diff;
        return (left.rows[0]?.name ?? '').localeCompare(right.rows[0]?.name ?? '');
      });
    } else if (query.q?.trim()) {
      const rankStart = performance.now();
      groups = await this.rerankSearchGroups(
        query.q,
        groups,
        resolvedCatalogHash,
        and(buildSearchFilterWhere(query), buildSearchTypeIntentWhere(query))
      );
      rankMs = performance.now() - rankStart;
    } else if (query.sortBy === 'energy') {
      groups = sortCandidateGroupsByEnergy(groups, query.dir);
    } else if (query.sortBy === 'variantNumber') {
      groups = sortCandidateGroupsByVariantNumber(groups, query.dir);
    } else {
      groups = sortCandidateGroupsByName(groups, query.dir);
    }
    const groupMs = performance.now() - groupStart;

    const total = groups.length;
    const pageGroups = groups.slice(offset, offset + query.limit);
    const pageRows = pageGroups.flatMap((group) => group.rows);
    const {
      items: rawItems,
      colorsMs,
      pricesMs: pagePricesMs,
      mapMs,
    } = await this.hydrateSlimRows(pageRows, sortPriceRows);
    if (sortPriceRows === undefined) pricesMs = pagePricesMs;

    const grouped = groupCardListItems(rawItems);
    const byKey = new Map(
      grouped.map((item) => [searchGroupKeyForItem(item), item] as const)
    );
    const items = pageGroups.flatMap((group) => {
      const item = byKey.get(group.key);
      return item ? [item] : [];
    });

    const timings: LocalSearchTimings = {
      dbMs,
      colorsMs,
      pricesMs,
      mapMs,
      groupMs,
      countMs: 0,
      rankMs,
      totalMs: performance.now() - totalStart,
    };
    const hydration = summarizeHydrationTimings({ colorsMs, pricesMs, mapMs });
    logSearchComplete({
      path: 'cards_list',
      engine: 'postgres',
      ...summarizeCardsListQuery(query),
      materializeThenPage,
      fetchCap: null,
      variantsSelected: rows.length,
      variantsHydrated: pageRows.length,
      groupedCount: groups.length,
      itemsReturned: items.length,
      total,
      dbMs: Math.round(dbMs * 100) / 100,
      ...hydration,
      groupMs: Math.round(groupMs * 100) / 100,
      rankMs: Math.round(rankMs * 100) / 100,
      countMs: 0,
      totalMs: Math.round(timings.totalMs * 100) / 100,
    });

    return { items, total, catalogHash: resolvedCatalogHash, timings };
  }

  async countVariants(): Promise<number> {
    const [row] = await this.db.select({ value: count() }).from(variants);
    return row?.value ?? 0;
  }

  async listIndex(): Promise<{
    items: CardListItem[];
    total: number;
    catalogHash: string;
    pricesCatalogHash: string;
  }> {
    const rows = await this.db
      .select({
        card: cards,
        variant: variants,
        setCode: sets.code,
      })
      .from(variants)
      .innerJoin(cards, eq(variants.cardId, cards.id))
      .innerJoin(sets, eq(variants.setId, sets.id))
      .orderBy(asc(cards.name), asc(variants.variantNumber));

    const priceRows = await this.prices.getRowsForCardmarketIds(
      rows
        .map((row) => row.variant.cardmarketId)
        .filter((id): id is number => id != null)
    );

    const rawItems = rows.map((row) => {
      const logical = row.card.upstreamRaw as PaLogicalCard;
      const variant = this.overlayVariantMarketplaceIds(
        row.variant.upstreamRaw as PaVariant,
        row.variant
      );
      return this.mapItem(logical, variant, priceRows);
    });

    const items = groupCardListItems(rawItems);
    const [catalogHash, pricesCatalogHash] = await Promise.all([
      this.getCatalogHash(),
      this.getPricesCatalogHash(),
    ]);
    return {
      items,
      total: items.length,
      catalogHash,
      pricesCatalogHash,
    };
  }

  async backfillEmbeddings(): Promise<number> {
    if (!this.embeddings) return 0;
    return this.embeddings.embedMissing();
  }

  private async rerankSearchGroups(
    query: string,
    groups: SearchCandidateGroup[],
    catalogHash: string,
    filterWhere: SQL | undefined
  ): Promise<SearchCandidateGroup[]> {
    const lexical = sortCandidateGroupsLexically(groups, query);
    if (!this.embeddings?.isEnabled()) return lexical;

    try {
      const queryVector = await this.embeddings.embedQuery(query);
      if (!queryVector) return lexical;

      const stored = await this.embeddings.embeddingsForCatalog(catalogHash);
      if (stored.length === 0) return lexical;

      const vectorCardIds = rankEmbeddings(queryVector, stored).map((row) => row.id);
      if (vectorCardIds.length === 0) return lexical;

      const present = new Set(lexical.map((group) => group.cardId));
      const extraIds = vectorCardIds.filter((id) => !present.has(id)).slice(0, 16);
      let merged = lexical;
      if (extraIds.length > 0) {
        const extraWhere = filterWhere
          ? and(filterWhere, inArray(cards.id, extraIds))
          : inArray(cards.id, extraIds);
        const extraRows = await buildSearchCandidateQueryUnsorted(this.db, extraWhere);
        const extraGroups = groupSearchCandidateRows(extraRows);
        const seen = new Set(lexical.map((group) => group.key));
        merged = [...lexical, ...extraGroups.filter((group) => !seen.has(group.key))];
      }

      const cardsById = new Map(
        merged.map((group) => [group.key, searchRankCardFromGroup(group)])
      );
      const lexicalIds = lexical.map((group) => group.key);
      const vectorRank = new Map(vectorCardIds.map((id, index) => [id, index]));
      const vectorIds = [...merged]
        .filter((group) => vectorRank.has(group.cardId))
        .sort(
          (left, right) =>
            (vectorRank.get(left.cardId) ?? 999) - (vectorRank.get(right.cardId) ?? 999)
        )
        .map((group) => group.key);

      const fused = fuseSearchResultIds(lexicalIds, vectorIds, cardsById, query);
      const byKey = new Map(merged.map((group) => [group.key, group]));
      return fused.flatMap((id) => {
        const group = byKey.get(id);
        return group ? [group] : [];
      });
    } catch {
      return lexical;
    }
  }
}
