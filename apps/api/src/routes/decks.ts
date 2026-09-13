import { Elysia } from 'elysia';
import {
  CreateDeckVersionRequest,
  DeckDetailResponse,
  DeckListResponse,
  DeckUpsertRequest,
  DecksListQuery,
  IdResponse,
  RenameDeckVersionRequest,
} from '@riftbound/contracts';
import type { Auth } from '../auth.js';
import { logActionFailure } from '../lib/logger.js';
import { mergeRequestBody, parseRequest } from '../lib/request-validation.js';
import { getSessionUser, unauthorized } from '../lib/session.js';
import type { DeckService } from '../services/deck-service.js';
import {
  DeckLastVersionError,
  DeckReadOnlyError,
  DeckVersionLimitError,
  DeckVersionNotFoundError,
} from '../services/deck-service.js';

function isMissingDecksTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    (message.includes('user_decks') || message.includes('user_deck_versions')) &&
    message.includes('does not exist')
  );
}

function storageUnavailable() {
  return {
    error: 'DECKS_STORAGE_UNAVAILABLE',
    message: 'Deck storage is not migrated yet. Run database migrations.',
  };
}

function versionRouteError(
  error: unknown,
  set: { status?: number | string }
): Record<string, string> | null {
  if (error instanceof DeckReadOnlyError) {
    set.status = 403;
    return {
      error: 'DECK_READ_ONLY',
      message: 'Imported Piltover Archive decks are read-only',
    };
  }
  if (error instanceof DeckVersionNotFoundError) {
    set.status = 404;
    return { error: 'Deck version not found' };
  }
  if (error instanceof DeckLastVersionError) {
    set.status = 409;
    return { error: 'DECK_LAST_VERSION', message: error.message };
  }
  if (error instanceof DeckVersionLimitError) {
    set.status = 409;
    return { error: 'DECK_VERSION_LIMIT', message: error.message };
  }
  return null;
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
          return storageUnavailable();
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
          return storageUnavailable();
        }
        throw error;
      }
    })
    .post(
      '/:id/import',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params }) => {
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
          logActionFailure('decks.import', error, {
            userId: user.id,
            deckId: params.id,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    )
    .post(
      '/:id/versions',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const parsed = parseRequest(CreateDeckVersionRequest, body);
        try {
          const saved = await decks.createVersion(user.id, params.id, parsed.name);
          return DeckDetailResponse.parse({ data: saved });
        } catch (error) {
          const mapped = versionRouteError(error, set);
          if (mapped) return mapped;
          logActionFailure('decks.versions.create', error, {
            userId: user.id,
            deckId: params.id,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    )
    .put(
      '/:id/versions/:versionId',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const parsed = parseRequest(
          DeckUpsertRequest,
          mergeRequestBody(body, { id: params.id })
        );
        if (parsed.id !== params.id) {
          set.status = 400;
          return { error: 'Deck id mismatch' };
        }
        try {
          const saved = await decks.upsertVersion(
            user.id,
            params.id,
            params.versionId,
            parsed
          );
          return DeckDetailResponse.parse({ data: saved });
        } catch (error) {
          const mapped = versionRouteError(error, set);
          if (mapped) return mapped;
          logActionFailure('decks.versions.upsert', error, {
            userId: user.id,
            deckId: params.id,
            versionId: params.versionId,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    )
    .patch(
      '/:id/versions/:versionId',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const parsed = parseRequest(RenameDeckVersionRequest, body);
        try {
          const saved = await decks.renameVersion(
            user.id,
            params.id,
            params.versionId,
            parsed.name
          );
          return DeckDetailResponse.parse({ data: saved });
        } catch (error) {
          const mapped = versionRouteError(error, set);
          if (mapped) return mapped;
          logActionFailure('decks.versions.rename', error, {
            userId: user.id,
            deckId: params.id,
            versionId: params.versionId,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    )
    .post(
      '/:id/versions/:versionId/activate',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        try {
          const saved = await decks.activateVersion(
            user.id,
            params.id,
            params.versionId
          );
          return DeckDetailResponse.parse({ data: saved });
        } catch (error) {
          const mapped = versionRouteError(error, set);
          if (mapped) return mapped;
          logActionFailure('decks.versions.activate', error, {
            userId: user.id,
            deckId: params.id,
            versionId: params.versionId,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    )
    .delete(
      '/:id/versions/:versionId',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        try {
          const saved = await decks.deleteVersion(user.id, params.id, params.versionId);
          return DeckDetailResponse.parse({ data: saved });
        } catch (error) {
          const mapped = versionRouteError(error, set);
          if (mapped) return mapped;
          logActionFailure('decks.versions.delete', error, {
            userId: user.id,
            deckId: params.id,
            versionId: params.versionId,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    )
    .put(
      '/:id',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const parsed = parseRequest(
          DeckUpsertRequest,
          mergeRequestBody(body, { id: params.id })
        );
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
          logActionFailure('decks.upsert', error, {
            userId: user.id,
            deckId: params.id,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    )
    .delete(
      '/:id',
      { detail: { tags: ['decks'] } },
      async ({ request, set, params }) => {
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
          return IdResponse.parse({ data: { id: params.id } });
        } catch (error) {
          if (error instanceof DeckReadOnlyError) {
            set.status = 403;
            return {
              error: 'DECK_READ_ONLY',
              message: 'Imported Piltover Archive decks are read-only',
            };
          }
          logActionFailure('decks.delete', error, {
            userId: user.id,
            deckId: params.id,
          });
          if (isMissingDecksTableError(error)) {
            set.status = 503;
            return storageUnavailable();
          }
          throw error;
        }
      }
    );
}
