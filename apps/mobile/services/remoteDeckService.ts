import {
  DeckDetailResponse,
  DeckListResponse,
  type DeckListItem,
  type DecksListQuery,
  type StoredDeckPayload,
} from '@riftbound/contracts';
import { authedFetch, RemoteApiError } from '@/src/api/authedClient';

type DeckListPagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious?: boolean;
};

export { RemoteApiError };

export async function fetchRemoteDecks(
  options?: Partial<DecksListQuery>
): Promise<{ data: DeckListItem[]; pagination?: DeckListPagination }> {
  const params = new URLSearchParams();
  if (options?.q?.trim()) params.set('q', options.q.trim());
  if (options?.legend?.trim()) params.set('legend', options.legend.trim());
  if (options?.sets?.trim()) params.set('sets', options.sets.trim());
  if (options?.isLegal !== undefined) params.set('isLegal', String(options.isLegal));
  if (options?.hasGuide === true) params.set('hasGuide', 'true');
  if (options?.hasVideo === true) params.set('hasVideo', 'true');
  if (options?.hasMatchups === true) params.set('hasMatchups', 'true');
  if (options?.page !== undefined) params.set('page', String(options.page));
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.sort) params.set('sort', options.sort);
  if (options?.dir) params.set('dir', options.dir);
  if (options?.source && options.source !== 'all') params.set('source', options.source);
  if (options?.preview === true) params.set('preview', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await authedFetch<unknown>(`/api/v1/decks${qs}`);
  const parsed = DeckListResponse.parse(res);
  return { data: parsed.data, pagination: parsed.meta.pagination };
}

export async function fetchRemoteDeck(deckId: string): Promise<DeckListItem | null> {
  try {
    const res = await authedFetch<unknown>(
      `/api/v1/decks/${encodeURIComponent(deckId)}`
    );
    return DeckDetailResponse.parse(res).data;
  } catch (error) {
    if (error instanceof RemoteApiError && error.status === 404) return null;
    throw error;
  }
}

export async function remoteUpsertDeck(deck: StoredDeckPayload): Promise<DeckListItem> {
  const res = await authedFetch<unknown>(
    `/api/v1/decks/${encodeURIComponent(deck.id)}`,
    {
      method: 'PUT',
      body: deck,
    }
  );
  return DeckDetailResponse.parse(res).data;
}

export async function remoteImportDeck(deckId: string): Promise<DeckListItem> {
  const res = await authedFetch<unknown>(
    `/api/v1/decks/${encodeURIComponent(deckId)}/import`,
    {
      method: 'POST',
    }
  );
  return DeckDetailResponse.parse(res).data;
}

export async function remoteDeleteDeck(deckId: string): Promise<void> {
  await authedFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
    method: 'DELETE',
  });
}

export function isRemoteDeckReadOnlyError(error: unknown): boolean {
  return error instanceof RemoteApiError && error.status === 403;
}
