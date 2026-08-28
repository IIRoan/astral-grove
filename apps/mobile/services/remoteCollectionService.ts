import type {
  CollectionActivityEvent,
  CollectionItem,
  WishlistItem,
} from '@riftbound/contracts';
import {
  chunkArray,
  CollectionImportResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
  CollectionRecentAddsResponse,
  WishlistListResponse,
} from '@riftbound/contracts';
import { authedFetch, authedFetchText, parseOrThrow } from '@/src/api/authedClient';

export { RemoteApiError } from '@/src/api/authedClient';

const COLLECTION_VARIANT_BATCH_SIZE = 200;

async function postCollectionQuantitiesBatch(
  variantNumbers: string[]
): Promise<Array<{ variantNumber: string; isFoil: boolean; quantity: number }>> {
  const res = await authedFetch<{
    data: Array<{ variantNumber: string; isFoil: boolean; quantity: number }>;
  }>('/api/v1/collection/quantities', {
    method: 'POST',
    body: { variantNumbers },
  });
  return parseOrThrow('collection.quantities.parse', CollectionQuantitiesResponse, res)
    .data;
}

async function postCollectionRecentAddsBatch(
  variantNumbers: string[]
): Promise<CollectionActivityEvent[]> {
  const res = await authedFetch<{ data: CollectionActivityEvent[] }>(
    '/api/v1/collection/recent-adds',
    {
      method: 'POST',
      body: { variantNumbers },
    }
  );
  return parseOrThrow('collection.recentAdds.parse', CollectionRecentAddsResponse, res)
    .data;
}

export async function fetchRemoteCollection(): Promise<CollectionItem[]> {
  const res = await authedFetch<{ data: CollectionItem[] }>('/api/v1/collection');
  return parseOrThrow('collection.list.parse', CollectionListResponse, res).data;
}

export async function fetchRemoteCollectionQuantities(
  variantNumbers: string[]
): Promise<Array<{ variantNumber: string; isFoil: boolean; quantity: number }>> {
  const unique = [...new Set(variantNumbers.filter(Boolean))];
  if (unique.length === 0) return [];
  const chunks = chunkArray(unique, COLLECTION_VARIANT_BATCH_SIZE);
  if (chunks.length === 1) {
    return postCollectionQuantitiesBatch(chunks[0] ?? []);
  }
  const batches = await Promise.all(
    chunks.map((chunk) => postCollectionQuantitiesBatch(chunk))
  );
  return batches.flat();
}

export async function fetchRemoteCollectionRecentAdds(
  variantNumbers: string[]
): Promise<CollectionActivityEvent[]> {
  const unique = [...new Set(variantNumbers.filter(Boolean))];
  if (unique.length === 0) return [];
  const chunks = chunkArray(unique, COLLECTION_VARIANT_BATCH_SIZE);
  if (chunks.length === 1) {
    return postCollectionRecentAddsBatch(chunks[0] ?? []);
  }
  const batches = await Promise.all(
    chunks.map((chunk) => postCollectionRecentAddsBatch(chunk))
  );
  return batches.flat();
}

export async function remoteAddToCollection(
  variantNumber: string,
  delta = 1,
  isFoil?: boolean
): Promise<void> {
  await authedFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
    method: 'POST',
    body: { delta, ...(isFoil === undefined ? {} : { isFoil }) },
  });
}

export async function remoteRemoveFromCollection(
  variantNumber: string,
  delta = 1,
  isFoil?: boolean
): Promise<void> {
  await authedFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`, {
    method: 'POST',
    body: { delta, ...(isFoil === undefined ? {} : { isFoil }) },
  });
}

export async function remoteSetCollectionQuantity(
  variantNumber: string,
  quantity: number,
  isFoil?: boolean
): Promise<void> {
  await authedFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}`, {
    method: 'PUT',
    body: {
      variantNumber,
      quantity,
      ...(isFoil === undefined ? {} : { isFoil }),
    },
  });
}

export async function remoteDeleteFromCollection(
  variantNumber: string,
  isFoil?: boolean
): Promise<void> {
  const query = isFoil === undefined ? '' : `?isFoil=${isFoil ? 'true' : 'false'}`;
  await authedFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}${query}`, {
    method: 'DELETE',
  });
}

export async function remoteBatchSyncCollection(
  items: Array<{ variantNumber: string; quantity: number }>
): Promise<void> {
  await authedFetch('/api/v1/collection/batch', {
    method: 'POST',
    body: {
      items: items.map((item) => ({
        variantNumber: item.variantNumber,
        quantity: item.quantity,
        condition: 'near_mint',
        language: 'en',
      })),
    },
  });
}

export async function remoteExportCollectionCsv(): Promise<string> {
  return authedFetchText('/api/v1/collection/export', { accept: 'text/csv' });
}

export async function remoteImportCollectionItems(
  items: Array<{
    variantNumber: string;
    quantity: number;
    condition?: string;
    language?: string;
    isFoil?: boolean;
    notes?: string | null;
    isGraded?: boolean;
    gradeCompany?: string | null;
    gradeScore?: string | null;
  }>
): Promise<{
  imported: number;
  totalCopies: number;
  failedRows: number;
  errors: Array<{ row: number; message: string }>;
}> {
  const res = await authedFetch<{ data: unknown }>('/api/v1/collection/import', {
    method: 'POST',
    body: { items },
  });
  const parsed = parseOrThrow(
    'collection.import.parse',
    CollectionImportResponse,
    res
  ).data;
  return {
    imported: parsed.imported,
    totalCopies: parsed.totalCopies,
    failedRows: parsed.failedRows,
    errors: parsed.errors,
  };
}

export async function remoteClearCollection(): Promise<void> {
  await authedFetch('/api/v1/collection/all', {
    method: 'DELETE',
  });
}

export async function fetchRemoteWishlist(): Promise<WishlistItem[]> {
  const res = await authedFetch<{ data: WishlistItem[] }>('/api/v1/wishlist');
  return parseOrThrow('wishlist.list.parse', WishlistListResponse, res).data;
}

export async function remoteAddToWishlist(variantNumber: string): Promise<void> {
  await authedFetch(`/api/v1/wishlist/${encodeURIComponent(variantNumber)}`, {
    method: 'PUT',
    body: { variantNumber },
  });
}

export async function remoteRemoveFromWishlist(variantNumber: string): Promise<void> {
  await authedFetch(`/api/v1/wishlist/${encodeURIComponent(variantNumber)}`, {
    method: 'DELETE',
  });
}
