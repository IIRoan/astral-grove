import { z } from 'zod';
import { Pagination } from './cards.js';
import { dataResponse, dataMetaResponse, QueryBooleanString } from './common.js';
import { DeckCardInput, DeckEntryInput, DeckFormat } from './deck-rules.js';

export const DeckSortField = z.enum([
  'trending',
  'likes',
  'views',
  'createdAt',
  'editedAt',
]);

export const DecksListQuery = z.object({
  q: z.string().max(200).optional(),
  // Forwarded upstream as legend:<name> in the search query.
  legend: z.string().optional(),
  // Each set prefix is forwarded as set:<prefix>.
  sets: z.string().optional(),
  isLegal: QueryBooleanString.optional(),
  hasGuide: QueryBooleanString.optional(),
  hasVideo: QueryBooleanString.optional(),
  hasMatchups: QueryBooleanString.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(25),
  sort: DeckSortField.default('trending'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  source: z.enum(['owned', 'imported', 'all']).default('all'),
  preview: QueryBooleanString.optional(),
});

export const StoredDeckPayload = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string().optional(),
  // Defaults to constructed for older payloads.
  format: DeckFormat.default('constructed'),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  legend: DeckCardInput.nullable(),
  champion: DeckCardInput.nullable(),
  mainDeck: z.array(DeckEntryInput),
  runes: z.array(DeckEntryInput),
  battlefields: z.array(DeckEntryInput),
  sideboard: z.array(DeckEntryInput),
  // Upstream deck id after successful sync of our owned copy.
  upstreamId: z.string().optional(),
  // Tracks the community deck source for duplicate-import detection.
  importedFromId: z.string().optional(),
  syncWarnings: z.array(z.string()).optional(),
});

export const DeckSource = z.enum(['owned', 'imported']);

export const DeckListItem = StoredDeckPayload.extend({
  source: DeckSource,
  readOnly: z.boolean(),
  authorName: z.string().optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  isLegal: z.boolean().optional(),
  setPrefixes: z.array(z.string()).optional(),
  hasGuide: z.boolean().optional(),
  hasVideo: z.boolean().optional(),
  hasMatchups: z.boolean().optional(),
  videoUrl: z.string().optional(),
  bannedCardNames: z.array(z.string()).optional(),
});

export const DeckUpsertRequest = StoredDeckPayload;

export const DeckListResponse = dataMetaResponse(
  z.array(DeckListItem),
  z.object({
    total: z.number().int(),
    owned: z.number().int(),
    imported: z.number().int(),
    pagination: Pagination.optional(),
  })
);

export const DeckDetailResponse = dataResponse(DeckListItem);

export type StoredDeckPayload = z.infer<typeof StoredDeckPayload>;
export type DeckListItem = z.infer<typeof DeckListItem>;
export type DeckSource = z.infer<typeof DeckSource>;
export type DeckSortField = z.infer<typeof DeckSortField>;
export type DecksListQuery = z.infer<typeof DecksListQuery>;
export type DeckUpsertRequest = z.infer<typeof DeckUpsertRequest>;
