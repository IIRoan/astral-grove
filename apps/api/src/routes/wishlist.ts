import type { z } from 'zod';
import { Elysia } from 'elysia';
import {
  WishlistItemResponse,
  WishlistListResponse,
  WishlistUpsertRequest,
  type WishlistItem,
} from '@riftbound/contracts';
import type { Auth } from '../auth.js';
import { logActionFailure } from '../lib/logger.js';
import { parseRequest } from '../lib/request-validation.js';
import { getSessionUser, unauthorized } from '../lib/session.js';
import type { WishlistService } from '../services/wishlist-service.js';

const _UpsertBody = WishlistUpsertRequest.omit({ variantNumber: true });

function wishlistItemResponse(
  action: string,
  item: WishlistItem,
  context?: Record<string, unknown>
) {
  const parsed = WishlistItemResponse.safeParse({ data: item });
  if (!parsed.success) {
    logActionFailure(action, parsed.error, context);
    throw new Error('Wishlist response validation failed');
  }
  return parsed.data;
}

export function createWishlistRoutes(wishlist: WishlistService, auth: Auth) {
  return new Elysia({ prefix: '/api/v1/wishlist' })
    .get('/', { detail: { tags: ['wishlist'] } }, async ({ request, set }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const result = await wishlist.listForUser(user.id);
      const parsed = WishlistListResponse.safeParse({
        data: result.items,
        meta: { total: result.total },
      });
      if (!parsed.success) {
        logActionFailure('wishlist.list', parsed.error, { total: result.total });
        throw new Error('Wishlist list response validation failed');
      }
      return parsed.data;
    })
    .put('/:variantNumber', { detail: { tags: ['wishlist'] } }, async ({ request, set, params, body }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      const parsed = parseRequest(WishlistUpsertRequest, {
        ...(body as z.infer<typeof _UpsertBody>),
        variantNumber: params.variantNumber,
      });
      const item = await wishlist.upsert(user.id, {
        variantNumber: parsed.variantNumber,
        priority: parsed.priority,
        targetPriceCents: parsed.targetPriceCents ?? null,
        notes: parsed.notes ?? null,
      });
      return wishlistItemResponse('wishlist.upsert', item, {
        variantNumber: parsed.variantNumber,
      });
    })
    .delete('/:variantNumber', { detail: { tags: ['wishlist'] } }, async ({ request, set, params }) => {
      const user = await getSessionUser(auth, request.headers);
      if (!user) {
        set.status = 401;
        return unauthorized();
      }
      await wishlist.remove(user.id, params.variantNumber);
      return { data: { ok: true } };
    });
}
