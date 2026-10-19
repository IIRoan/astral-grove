import type {
  CardDetail,
  CardsBatchResponse as CardsBatch,
  CardsListQuery,
  GlobalSearchQuery,
  PriceStatsBatchRequest,
} from '@riftbound/contracts';
import {
  CardDetailResponse,
  chunkArray,
  CardsBatchResponse,
  CardsListResponse,
  CatalogIndexResponse,
  FiltersResponse,
  GlobalSearchResponse,
  HealthResponse,
  PriceHistoryResponse,
  PriceStatsBatchResponse,
  PricesListResponse,
} from '@riftbound/contracts';
import type { z } from 'zod';
import { apiErrorMessage, fetchWithApiWake } from '@/lib/api-fetch';
import { getApiUrl } from '@/lib/api-url';

// Unauthenticated JSON client for catalog/prices/filters; user data uses authedClient.ts.

const API_URL = getApiUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    body: string
  ) {
    super(apiErrorMessage(status, body));
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: Pick<RequestInit, 'method' | 'body'>
): Promise<T> {
  // Every route here is a catalog/price read, including the batch POSTs.
  const res = await fetchWithApiWake(
    `${API_URL}${path}`,
    {
      method: init?.method,
      body: init?.body,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    },
    { readOnly: true }
  );
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  const json: unknown = await res.json();
  return schema.parse(json);
}

export const api = {
  health: () => apiFetch('/api/v1/health', HealthResponse),

  listCards: (query: Partial<CardsListQuery>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query) as [
      keyof CardsListQuery,
      CardsListQuery[keyof CardsListQuery],
    ][]) {
      if (v === undefined || v === null || v === '') continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    return apiFetch(`/api/v1/cards${qs ? `?${qs}` : ''}`, CardsListResponse);
  },

  getCatalogIndex: () => apiFetch('/api/v1/cards/index', CatalogIndexResponse),

  globalSearch: (query: Partial<GlobalSearchQuery>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query) as [
      keyof GlobalSearchQuery,
      GlobalSearchQuery[keyof GlobalSearchQuery],
    ][]) {
      if (v === undefined || v === null || v === '') continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    return apiFetch(`/api/v1/search${qs ? `?${qs}` : ''}`, GlobalSearchResponse);
  },

  getCard: (variantNumber: string) =>
    apiFetch(`/api/v1/cards/${encodeURIComponent(variantNumber)}`, CardDetailResponse),

  // The API caps batches at 100 variants; larger lists are split and merged.
  batchCards: async (variantNumbers: string[]): Promise<CardsBatch> => {
    const pages = await Promise.all(
      chunkArray(variantNumbers, 100).map((batch) =>
        apiFetch('/api/v1/cards/batch', CardsBatchResponse, {
          method: 'POST',
          body: JSON.stringify({ variantNumbers: batch }),
        })
      )
    );
    const sources = new Set(pages.map((page) => page.meta.source));
    return {
      data: pages.flatMap((page) => page.data),
      meta: {
        found: pages.reduce((sum, page) => sum + page.meta.found, 0),
        notFound: pages.flatMap((page) => page.meta.notFound),
        source: sources.size === 1 ? (pages[0]?.meta.source ?? 'cache') : 'mixed',
      },
    };
  },

  getFilters: () => apiFetch('/api/v1/filters', FiltersResponse),

  getPrices: (query: {
    cardmarketId?: number;
    variantNumber?: string;
    isFoil?: boolean;
  }) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const qs = params.toString();
    return apiFetch(`/api/v1/prices${qs ? `?${qs}` : ''}`, PricesListResponse);
  },

  getPriceHistory: (query: {
    cardmarketId?: number;
    variantNumber?: string;
    isFoil?: boolean;
    days?: number;
  }) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const qs = params.toString();
    return apiFetch(
      `/api/v1/prices/history${qs ? `?${qs}` : ''}`,
      PriceHistoryResponse
    );
  },

  // The API caps stats batches at 200 items; larger lists are split and merged.
  getPriceStatsBatch: async (
    body: PriceStatsBatchRequest
  ): Promise<z.infer<typeof PriceStatsBatchResponse>> => {
    const pages = await Promise.all(
      chunkArray(body.items, 200).map((items) =>
        apiFetch('/api/v1/prices/stats/batch', PriceStatsBatchResponse, {
          method: 'POST',
          body: JSON.stringify({ ...body, items }),
        })
      )
    );
    return {
      data: pages.flatMap((page) => page.data),
      meta: {
        days: pages[0]?.meta.days ?? body.days,
        rowCount: pages.reduce((sum, page) => sum + page.meta.rowCount, 0),
      },
    };
  },
};

export type { CardDetail };
