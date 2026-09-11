import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  smallint,
  jsonb,
  timestamp,
  date,
  integer,
  boolean,
  numeric,
  char,
  primaryKey,
  index,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core';
import { user } from './auth-schema.js';

const realArray = customType<{ data: number[]; driverData: number[] }>({
  dataType() {
    return 'real[]';
  },
});

export const sets = pgTable('sets', {
  id: uuid('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  releaseDate: text('release_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const colors = pgTable('colors', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull().unique(),
  hexCode: text('hex_code'),
  imageUrl: text('image_url'),
});

export const cards = pgTable(
  'cards',
  {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    super: text('super'),
    description: text('description').notNull(),
    energy: smallint('energy').notNull(),
    might: smallint('might').notNull(),
    power: smallint('power').notNull(),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    attachText: text('attach_text'),
    effect: text('effect'),
    mightBonus: smallint('might_bonus').default(0),
    maxCopies: smallint('max_copies'),
    banEffectiveDate: timestamp('ban_effective_date', { withTimezone: true }),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    embedding: realArray('embedding'),
    embeddingModel: text('embedding_model'),
    embeddedHash: char('embedded_hash', { length: 64 }),
    nameNorm: text('name_norm').generatedAlwaysAs(
      sql`public.normalize_card_name_v1(name)`
    ),
    nameSquashed: text('name_squashed').generatedAlwaysAs(
      sql`replace(public.normalize_card_name_v1(name), ' ', '')`
    ),
    rulesSearchText: text('rules_search_text').generatedAlwaysAs(
      sql`coalesce(description, '') || E'\\n' || coalesce(effect, '') || E'\\n' || coalesce(attach_text, '')`
    ),
    upstreamRaw: jsonb('upstream_raw').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('cards_name_norm_trgm_idx').using('gin', t.nameNorm.op('gin_trgm_ops')),
    index('cards_name_squashed_trgm_idx').using(
      'gin',
      t.nameSquashed.op('gin_trgm_ops')
    ),
    index('cards_rules_search_text_trgm_idx').using(
      'gin',
      t.rulesSearchText.op('gin_trgm_ops')
    ),
    index('cards_type_tokens_idx').using(
      'gin',
      sql`string_to_array(lower(trim("type")), ' ')`
    ),
    index('cards_super_lower_idx').on(sql`lower(${t.super})`),
  ]
);

export const cardColors = pgTable(
  'card_colors',
  {
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    colorId: uuid('color_id')
      .notNull()
      .references(() => colors.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.colorId] })]
);

export const variants = pgTable(
  'variants',
  {
    id: uuid('id').primaryKey(),
    cardId: uuid('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    variantNumber: text('variant_number').notNull().unique(),
    rarity: text('rarity').notNull(),
    variantType: text('variant_type').notNull(),
    foilMode: text('foil_mode').notNull(),
    variantTypes: jsonb('variant_types').$type<string[]>().notNull(),
    imageUrl: text('image_url').notNull(),
    flavorText: text('flavor_text'),
    artist: text('artist'),
    releaseDate: text('release_date'),
    variantLabel: text('variant_label').notNull(),
    showInLibrary: boolean('show_in_library').notNull(),
    isCollectible: boolean('is_collectible').notNull(),
    cardmarketId: integer('cardmarket_id'),
    tcgplayerId: integer('tcgplayer_id'),
    parentVariantId: uuid('parent_variant_id'),
    setId: uuid('set_id')
      .notNull()
      .references(() => sets.id),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    upstreamRaw: jsonb('upstream_raw').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('variants_cardmarket_id_idx').on(t.cardmarketId),
    index('variants_card_id_idx').on(t.cardId),
    index('variants_set_id_idx').on(t.setId),
    index('variants_number_trgm_idx').using(
      'gin',
      sql`lower(${t.variantNumber}) gin_trgm_ops`
    ),
    index('variants_label_trgm_idx').using(
      'gin',
      sql`lower(${t.variantLabel}) gin_trgm_ops`
    ),
    index('variants_artist_trgm_idx').using(
      'gin',
      sql`lower(coalesce(${t.artist}, '')) gin_trgm_ops`
    ),
    index('variants_flavor_trgm_idx').using('gin', t.flavorText.op('gin_trgm_ops')),
    index('variants_type_lower_idx').on(sql`lower(${t.variantType})`),
  ]
);

export const prices = pgTable(
  'prices',
  {
    id: uuid('id').primaryKey(),
    cardmarketId: integer('cardmarket_id').notNull(),
    isFoil: boolean('is_foil').notNull(),
    provider: text('provider').notNull().default('cardmarket'),
    currency: text('currency').notNull().default('EUR'),
    lowPrice: numeric('low_price', { precision: 12, scale: 2 }),
    marketPrice: numeric('market_price', { precision: 12, scale: 2 }),
    midPrice: numeric('mid_price', { precision: 12, scale: 2 }),
    highPrice: numeric('high_price', { precision: 12, scale: 2 }),
    avg1Day: numeric('avg_1_day', { precision: 12, scale: 2 }),
    avg7Day: numeric('avg_7_day', { precision: 12, scale: 2 }),
    avg30Day: numeric('avg_30_day', { precision: 12, scale: 2 }),
    upstreamLastUpdated: timestamp('upstream_last_updated', {
      withTimezone: true,
    }).notNull(),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('prices_cardmarket_foil_idx').on(t.cardmarketId, t.isFoil)]
);

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardmarketId: integer('cardmarket_id').notNull(),
    isFoil: boolean('is_foil').notNull(),
    provider: text('provider').notNull().default('cardmarket'),
    currency: text('currency').notNull().default('EUR'),
    lowPrice: numeric('low_price', { precision: 12, scale: 2 }),
    marketPrice: numeric('market_price', { precision: 12, scale: 2 }),
    midPrice: numeric('mid_price', { precision: 12, scale: 2 }),
    highPrice: numeric('high_price', { precision: 12, scale: 2 }),
    avg1Day: numeric('avg_1_day', { precision: 12, scale: 2 }),
    avg7Day: numeric('avg_7_day', { precision: 12, scale: 2 }),
    avg30Day: numeric('avg_30_day', { precision: 12, scale: 2 }),
    upstreamLastUpdated: timestamp('upstream_last_updated', {
      withTimezone: true,
    }).notNull(),
    contentHash: char('content_hash', { length: 64 }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('price_history_unique_snapshot_idx').on(
      t.cardmarketId,
      t.isFoil,
      t.upstreamLastUpdated,
      t.contentHash
    ),
    index('price_history_cardmarket_foil_captured_idx').on(
      t.cardmarketId,
      t.isFoil,
      t.capturedAt
    ),
  ]
);

export const priceDaily = pgTable(
  'price_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cardmarketId: integer('cardmarket_id').notNull(),
    isFoil: boolean('is_foil').notNull(),
    priceDate: date('price_date').notNull(),
    provider: text('provider').notNull().default('cardmarket'),
    currency: text('currency').notNull().default('EUR'),
    lowPrice: numeric('low_price', { precision: 12, scale: 2 }),
    marketPrice: numeric('market_price', { precision: 12, scale: 2 }),
    midPrice: numeric('mid_price', { precision: 12, scale: 2 }),
    highPrice: numeric('high_price', { precision: 12, scale: 2 }),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('price_daily_unique_day_idx').on(t.cardmarketId, t.isFoil, t.priceDate),
    index('price_daily_lookup_idx').on(t.cardmarketId, t.isFoil, t.priceDate),
  ]
);

export const syncState = pgTable('sync_state', {
  key: text('key').primaryKey(),
  contentHash: char('content_hash', { length: 64 }).notNull(),
  rowCount: integer('row_count').default(0),
  lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastError: text('last_error'),
  status: text('status').notNull().default('idle'),
});

export const filterSnapshots = pgTable('filter_snapshots', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  snapshot: jsonb('snapshot').notNull(),
  contentHash: char('content_hash', { length: 64 }).notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
});

export const CARD_CONDITIONS = [
  'mint',
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged',
  'unspecified',
] as const;

export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const COLLECTION_MEMBER_ROLES = ['owner', 'member'] as const;
export type CollectionMemberRole = (typeof COLLECTION_MEMBER_ROLES)[number];

export const COLLECTION_INVITE_STATUSES = [
  'pending',
  'accepted',
  'revoked',
  'expired',
] as const;
export type CollectionInviteStatus = (typeof COLLECTION_INVITE_STATUSES)[number];

/** Inventory container; items hang off collection, not directly off user. */
export const collections = pgTable('collections', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Exactly one active membership per user; collections cap at 2 members (app-enforced). */
export const collectionMembers = pgTable(
  'collection_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('collection_members_user_id_idx').on(t.userId),
    index('collection_members_collection_id_idx').on(t.collectionId),
  ]
);

export const collectionInvites = pgTable(
  'collection_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    inviterUserId: text('inviter_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('collection_invites_token_idx').on(t.token),
    index('collection_invites_collection_id_idx').on(t.collectionId),
    index('collection_invites_inviter_user_id_idx').on(t.inviterUserId),
  ]
);

/** Owned stack uniqueness: collection + variant + condition + language (NM vs LP separately). */
export const collectionItems = pgTable(
  'collection_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    variantNumber: text('variant_number')
      .notNull()
      .references(() => variants.variantNumber, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull().default(1),
    condition: text('condition').notNull().default('near_mint'),
    language: text('language').notNull().default('en'),
    isFoil: boolean('is_foil').notNull().default(false),
    notes: text('notes'),
    isGraded: boolean('is_graded').notNull().default(false),
    gradeCompany: text('grade_company'),
    gradeScore: text('grade_score'),
    acquiredAt: timestamp('acquired_at', { withTimezone: true }),
    acquiredPriceCents: integer('acquired_price_cents'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('collection_items_collection_variant_condition_lang_foil_idx').on(
      t.collectionId,
      t.variantNumber,
      t.condition,
      t.language,
      t.isFoil
    ),
    index('collection_items_collection_id_idx').on(t.collectionId),
    index('collection_items_variant_number_idx').on(t.variantNumber),
  ]
);

/** Append-only mutation history; collection_id nullable so actor history survives collection delete. */
export const COLLECTION_AUDIT_ACTIONS = [
  'add',
  'remove',
  'upsert',
  'delete',
  'clear',
  'batch',
  'import',
  'share_merge',
  'share_discard',
  'share_leave',
] as const;

export type CollectionAuditAction = (typeof COLLECTION_AUDIT_ACTIONS)[number];

export const collectionAuditEvents = pgTable(
  'collection_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id').references(() => collections.id, {
      onDelete: 'set null',
    }),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    action: text('action').notNull(),
    variantNumber: text('variant_number'),
    condition: text('condition'),
    language: text('language'),
    isFoil: boolean('is_foil'),
    quantityBefore: integer('quantity_before'),
    quantityAfter: integer('quantity_after'),
    quantityDelta: integer('quantity_delta'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('collection_audit_events_collection_created_idx').on(
      t.collectionId,
      t.createdAt
    ),
    index('collection_audit_events_actor_created_idx').on(t.actorUserId, t.createdAt),
    index('collection_audit_events_variant_created_idx').on(
      t.variantNumber,
      t.createdAt
    ),
  ]
);

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    variantNumber: text('variant_number')
      .notNull()
      .references(() => variants.variantNumber, { onDelete: 'restrict' }),
    priority: smallint('priority').notNull().default(0),
    targetPriceCents: integer('target_price_cents'),
    notes: text('notes'),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('wishlist_items_user_variant_idx').on(t.userId, t.variantNumber),
    index('wishlist_items_user_id_idx').on(t.userId),
  ]
);

export const collectionsRelations = relations(collections, ({ many }) => ({
  members: many(collectionMembers),
  items: many(collectionItems),
  invites: many(collectionInvites),
}));

export const collectionMembersRelations = relations(collectionMembers, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionMembers.collectionId],
    references: [collections.id],
  }),
  user: one(user, { fields: [collectionMembers.userId], references: [user.id] }),
}));

export const collectionInvitesRelations = relations(collectionInvites, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionInvites.collectionId],
    references: [collections.id],
  }),
  inviter: one(user, {
    fields: [collectionInvites.inviterUserId],
    references: [user.id],
  }),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
  variant: one(variants, {
    fields: [collectionItems.variantNumber],
    references: [variants.variantNumber],
  }),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  user: one(user, { fields: [wishlistItems.userId], references: [user.id] }),
  variant: one(variants, {
    fields: [wishlistItems.variantNumber],
    references: [variants.variantNumber],
  }),
}));

export const userDecks = pgTable(
  'user_decks',
  {
    id: text('id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    payload: jsonb('payload').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.id] }),
    index('user_decks_user_id_idx').on(t.userId),
    index('user_decks_updated_at_idx').on(t.userId, t.updatedAt),
  ]
);

export const userDecksRelations = relations(userDecks, ({ one }) => ({
  user: one(user, { fields: [userDecks.userId], references: [user.id] }),
}));

/** Appearance preferences keyed by device profile so phone and desktop stay independent. */
export const userSettings = pgTable(
  'user_settings',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    device: text('device').notNull(),
    settings: jsonb('settings').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.device] })]
);

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, { fields: [userSettings.userId], references: [user.id] }),
}));
