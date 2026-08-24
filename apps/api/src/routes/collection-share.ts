import { Elysia } from 'elysia';
import {
  CollectionShareAcceptRequest,
  CollectionShareAcceptResponse,
  CollectionShareInviteCreateResponse,
  CollectionShareInvitePreviewResponse,
  CollectionShareLeaveResponse,
  CollectionShareStatusResponse,
} from '@riftbound/contracts';
import type { Auth } from '../auth.js';
import { parseRequest } from '../lib/request-validation.js';
import { getSessionUser, unauthorized } from '../lib/session.js';
import {
  CollectionShareError,
  type CollectionShareService,
} from '../services/collection-share-service.js';

export function createCollectionShareRoutes(share: CollectionShareService, auth: Auth) {
  return new Elysia({ prefix: '/api/v1/collection/share' })
    .get('/', { detail: { tags: ['collection-share'] } }, async ({ request, set }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const status = await share.getStatus(user.id);
      return CollectionShareStatusResponse.parse({ data: status });
    })
    .post(
      '/invite',
      { detail: { tags: ['collection-share'] } },
      async ({ request, set }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        try {
          const invite = await share.createInvite(user.id);
          return CollectionShareInviteCreateResponse.parse({ data: invite });
        } catch (error) {
          if (error instanceof CollectionShareError) {
            set.status = error.httpStatus;
            return { error: error.code, message: error.message };
          }
          throw error;
        }
      }
    )
    .post(
      '/invite/revoke',
      { detail: { tags: ['collection-share'] } },
      async ({ request, set }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        await share.revokeInvite(user.id);
        return { data: { ok: true } };
      }
    )
    .get(
      '/invite/:token',
      { detail: { tags: ['collection-share'] } },
      async ({ request, set, params }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        try {
          const preview = await share.previewInvite(user.id, params.token);
          return CollectionShareInvitePreviewResponse.parse({ data: preview });
        } catch (error) {
          if (error instanceof CollectionShareError) {
            set.status = error.httpStatus;
            return { error: error.code, message: error.message };
          }
          throw error;
        }
      }
    )
    .post(
      '/invite/:token/accept',
      { detail: { tags: ['collection-share'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const parsed = parseRequest(CollectionShareAcceptRequest, body);
        try {
          const status = await share.acceptInvite(user.id, params.token, parsed.mode);
          return CollectionShareAcceptResponse.parse({ data: status });
        } catch (error) {
          if (error instanceof CollectionShareError) {
            set.status = error.httpStatus;
            return { error: error.code, message: error.message };
          }
          throw error;
        }
      }
    )
    .post(
      '/leave',
      { detail: { tags: ['collection-share'] } },
      async ({ request, set }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        try {
          const status = await share.leave(user.id);
          return CollectionShareLeaveResponse.parse({ data: status });
        } catch (error) {
          if (error instanceof CollectionShareError) {
            set.status = error.httpStatus;
            return { error: error.code, message: error.message };
          }
          throw error;
        }
      }
    );
}
