import { Elysia } from 'elysia';
import { DeckDetailResponse, DeckListResponse, DeckUpsertRequest, DecksListQuery } from '@riftbound/contracts';
import type { Auth } from '../auth.js';
import { logActionFailure } from '../lib/logger.js';
import { parseRequest } from '../lib/request-validation.js';
import { getSessionUser, unauthorized } from '../lib/session.js';
import type { DeckService } from '../services/deck-service.js';
import { DeckReadOnlyError } from '../services/deck-service.js';

function isMissingDecksTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('user_decks') && message.includes('does not exist');
}

export function createDecksRoutes(decks: DeckService, auth: Auth) {
  return new Elysia({ prefix: '/api/v1/decks' })
    .get('/', { detail: { tags: ['decks'] } }, async ({ request, set, query }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      try {
        const parsed = parseRequest(DecksListQuery, {
          ...query,
          source: typeof query.source === 'string' ? query.source : 'all',
        });
        const result = await decks.listForUser(user.id, parsed);
        return DeckListResponse.parse({
          data: result.items,
          meta: {
            total: result.total,
            owned: result.owned,
            imported: result.imported,
            ...(result.pagination ? { pagination: result.pagination } : {}),
          },
        });
      } catch (error) {
        logActionFailure('decks.list', error, { userId: user.id });
        if (isMissingDecksTableError(error)) {
          set.status = 503;
          return {
            error: 'DECKS_STORAGE_UNAVAILABLE',
            message: 'Deck storage is not migrated yet. Run database migrations.',
          };
        }
        throw error;
      }
    })
    .get('/:id', { detail: { tags: ['decks'] } }, async ({ request, set, params }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      try {
        const deck = await decks.getForUser(user.id, params.id);
        if (!deck) {
          set.status = 404;
          return { error: 'Deck not found' };
        }
        return DeckDetailResponse.parse({ data: deck });
      } catch (error) {
        logActionFailure('decks.get', error, { userId: user.id, deckId: params.id });
        if (isMissingDecksTableError(error)) {
          set.status = 503;
          return {
            error: 'DECKS_STORAGE_UNAVAILABLE',
            message: 'Deck storage is not migrated yet. Run database migrations.',
          };
        }
        throw error;
      }
    })
    .post('/:id/import', { detail: { tags: ['decks'] } }, async ({ request, set, params }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      try {
        const saved = await decks.importFromUpstream(user.id, params.id);
        if (!saved) {
          set.status = 404;
          return { error: 'Deck not found' };
        }
        return DeckDetailResponse.parse({ data: saved });
      } catch (error) {
        logActionFailure('decks.import', error, { userId: user.id, deckId: params.id });
        if (isMissingDecksTableError(error)) {
          set.status = 503;
          return {
            error: 'DECKS_STORAGE_UNAVAILABLE',
            message: 'Deck storage is not migrated yet. Run database migrations.',
          };
        }
        throw error;
      }
    })
    .put('/:id', { detail: { tags: ['decks'] } }, async ({ request, set, params, body }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const parsed = parseRequest(DeckUpsertRequest, { ...(body as object), id: params.id });
      if (parsed.id !== params.id) {
        set.status = 400;
        return { error: 'Deck id mismatch' };
      }
      try {
        const saved = await decks.upsert(user.id, parsed);
        return DeckDetailResponse.parse({ data: saved });
      } catch (error) {
        if (error instanceof DeckReadOnlyError) {
          set.status = 403;
          return {
            error: 'DECK_READ_ONLY',
            message: 'Imported Piltover Archive decks are read-only',
          };
        }
        logActionFailure('decks.upsert', error, { userId: user.id, deckId: params.id });
        if (isMissingDecksTableError(error)) {
          set.status = 503;
          return {
            error: 'DECKS_STORAGE_UNAVAILABLE',
            message: 'Deck storage is not migrated yet. Run database migrations.',
          };
        }
        throw error;
      }
    })
    .delete('/:id', { detail: { tags: ['decks'] } }, async ({ request, set, params }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      try {
        const deleted = await decks.delete(user.id, params.id);
        if (!deleted) {
          set.status = 404;
          return { error: 'Deck not found' };
        }
        return { data: { id: params.id } };
      } catch (error) {
        if (error instanceof DeckReadOnlyError) {
          set.status = 403;
          return {
            error: 'DECK_READ_ONLY',
            message: 'Imported Piltover Archive decks are read-only',
          };
        }
        logActionFailure('decks.delete', error, { userId: user.id, deckId: params.id });
        if (isMissingDecksTableError(error)) {
          set.status = 503;
          return {
            error: 'DECKS_STORAGE_UNAVAILABLE',
            message: 'Deck storage is not migrated yet. Run database migrations.',
          };
        }
        throw error;
      }
    });
}
