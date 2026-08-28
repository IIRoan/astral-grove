import { compress } from '@elysia/compress';
import { cors } from '@elysia/cors';
import { Elysia } from 'elysia';
import type postgres from 'postgres';
import { createAuth, type Auth } from './auth.js';
import { createDb, type Database } from './db/client.js';
import type { Env } from './env.js';
import { resolveCorsOrigins } from './lib/trusted-origins.js';
import { createAuthPlugin } from './plugins/auth.js';
import { errorPlugin } from './plugins/error-handler.js';
import { createRateLimitPlugin } from './plugins/rate-limit.js';
import { createSecurityHeadersPlugin } from './plugins/security-headers.js';
import { createCardsRoutes } from './routes/cards.js';
import { createImagesRoutes } from './routes/images.js';
import { createCollectionRoutes } from './routes/collection.js';
import { createCollectionShareRoutes } from './routes/collection-share.js';
import { createFiltersRoutes } from './routes/filters.js';
import { createPricesRoutes } from './routes/prices.js';
import { createHealthRoutes, createSyncRoutes } from './routes/sync.js';
import { createWishlistRoutes } from './routes/wishlist.js';
import { createDeckRulesRoutes } from './routes/deck-rules.js';
import { createDecksRoutes } from './routes/decks.js';
import { createSearchRoutes } from './routes/search.js';
import { CardCacheService } from './services/card-cache.js';
import { ImageStoreService } from './services/image-store.js';
import { CatalogMetadataService } from './services/catalog-metadata.js';
import { CollectionService } from './services/collection-service.js';
import { CollectionShareService } from './services/collection-share-service.js';
import { PriceCacheService } from './services/price-cache.js';
import { SyncEngine } from './services/sync-engine.js';
import { createEmbeddingService } from './services/embeddings.js';
import { WishlistService } from './services/wishlist-service.js';
import { DeckService } from './services/deck-service.js';
import { PaClient } from './upstream/pa-client.js';

export interface AppContext {
  app: Elysia;
  db: Database;
  client: postgres.Sql;
  auth: Auth;
  pa: PaClient;
  cardCache: CardCacheService;
  catalogMetadata: CatalogMetadataService;
  priceCache: PriceCacheService;
  syncEngine: SyncEngine;
  collectionService: CollectionService;
  collectionShareService: CollectionShareService;
  wishlistService: WishlistService;
  deckService: DeckService;
}

function buildApp(env: Env): AppContext {
  const { db, client } = createDb(env);
  const auth = createAuth(db, env);
  const authPlugin = createAuthPlugin(auth);
  const pa = new PaClient(env);
  const priceCache = new PriceCacheService(db);
  const imageStore = new ImageStoreService(env);
  const embeddings = createEmbeddingService(db, env);
  const cardCache = new CardCacheService(db, pa, priceCache, imageStore, embeddings);
  const catalogMetadata = new CatalogMetadataService(db, pa);
  const syncEngine = new SyncEngine(db, pa, cardCache, catalogMetadata);
  const collectionService = new CollectionService(db, cardCache, imageStore, pa);
  const collectionShareService = new CollectionShareService(db, env.PUBLIC_APP_URL);
  const wishlistService = new WishlistService(db, imageStore);
  const upstreamDeckWriteExtraHeader =
    env.UPSTREAM_DECK_WRITE_EXTRA_HEADER_NAME &&
    env.UPSTREAM_DECK_WRITE_EXTRA_HEADER_VALUE
      ? {
          name: env.UPSTREAM_DECK_WRITE_EXTRA_HEADER_NAME,
          value: env.UPSTREAM_DECK_WRITE_EXTRA_HEADER_VALUE,
        }
      : undefined;

  const deckService = new DeckService(db, pa, cardCache, upstreamDeckWriteExtraHeader);

  const app = new Elysia()
    .use(compress())
    .use(
      cors({
        origin: resolveCorsOrigins(env),
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
      })
    )
    .use(createSecurityHeadersPlugin(env))
    .use(createRateLimitPlugin(env))
    .use(errorPlugin)
    .use(authPlugin)
    .use(createHealthRoutes(db, syncEngine, env))
    .use(createImagesRoutes(imageStore))
    .use(createCardsRoutes(cardCache, env))
    .use(createSearchRoutes(cardCache))
    .use(createPricesRoutes(priceCache, db))
    .use(createFiltersRoutes(catalogMetadata))
    .use(createCollectionShareRoutes(collectionShareService, auth))
    .use(createCollectionRoutes(collectionService, auth, db))
    .use(createWishlistRoutes(wishlistService, auth))
    .use(createDeckRulesRoutes())
    .use(createDecksRoutes(deckService, auth))
    .use(createSyncRoutes(syncEngine, priceCache, cardCache, env))
    .get('/', () => ({
      name: 'astral-grove-api',
      health: '/api/v1/health',
      auth: '/api/auth',
    }));

  return {
    app,
    db,
    client,
    auth,
    pa,
    cardCache,
    catalogMetadata,
    priceCache,
    syncEngine,
    collectionService,
    collectionShareService,
    wishlistService,
    deckService,
  } as unknown as AppContext;
}

export function createApp(env: Env): AppContext {
  return buildApp(env);
}

export function startCatalogMetadataWarmup(ctx: AppContext, env: Env): void {
  if (!env.CATALOG_WARMUP_ON_START || process.env.CATALOG_PROBE_DISABLED === 'true') {
    return;
  }

  void ctx.catalogMetadata.ensureExpandedPrintCounts().catch((err: unknown) => {
    console.error('Catalog metadata warmup failed:', err);
  });
}

export function startSyncCrons(ctx: AppContext, env: Env): void {
  if (!env.SYNC_CRON_ENABLED) return;

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const ONE_DAY = 24 * 60 * 60 * 1000;

  setInterval(() => {
    void ctx.syncEngine.syncCatalog().catch((err: unknown) => {
      console.error('Catalog sync failed:', err);
    });
  }, SIX_HOURS);

  setInterval(() => {
    console.log(
      `[prices] In-process cron tick — starting Cardmarket sync (game=${String(env.CARDMARKET_GAME_ID)})`
    );
    void ctx.priceCache
      .syncFromCardmarket(env.CARDMARKET_GAME_ID, { trigger: 'cron' })
      .then((result) => {
        if (result.changed) {
          ctx.cardCache.invalidateSearchCache();
          console.log('[prices] Search cache invalidated after cron price change');
        } else if (result.cardmarketIdsBackfilled > 0) {
          ctx.cardCache.invalidateSearchCache();
          console.log(
            '[prices] Search cache invalidated after cron Cardmarket id backfill'
          );
        }
      })
      .catch((err: unknown) => {
        console.error('[prices] Cron Cardmarket sync failed:', err);
      });
  }, ONE_DAY);
}
