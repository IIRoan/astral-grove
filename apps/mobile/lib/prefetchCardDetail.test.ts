import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import type { CardListItem } from '@riftbound/contracts';
import { cardQueryKeys } from '@/src/api/queryKeys';

const batchCards = mock(async (variantNumbers: string[]) => ({
  data: [
    {
      id: 'card-1',
      name: 'Test Card',
      description: 'Batch rules text.',
      banEffectiveDate: null,
      variants: [
        {
          variantNumber: 'OGN-001',
          variantLabel: 'Standard',
          variantType: 'Standard',
          imageUrl: null,
          prices: [],
        },
        {
          variantNumber: 'OGN-001a',
          variantLabel: 'Alt',
          variantType: 'Alternate Art',
          imageUrl: null,
          prices: [],
        },
      ],
    },
    {
      id: 'card-2',
      name: 'Other',
      description: '',
      banEffectiveDate: null,
      variants: [
        {
          variantNumber: 'OGN-002',
          variantLabel: 'Standard',
          variantType: 'Standard',
          imageUrl: null,
          prices: [],
        },
      ],
    },
  ].filter((card) =>
    card.variants.some((variant) => variantNumbers.includes(variant.variantNumber))
  ),
  meta: {
    found: variantNumbers.length,
    notFound: [] as string[],
    source: 'cache' as const,
  },
}));

const getCard = mock(async () => {
  throw new Error('getCard should not be used for catalog prefetch');
});

mock.module('expo-image', () => ({
  Image: { prefetch: mock(async () => false) },
}));

mock.module('@/src/api/client', () => ({
  api: { batchCards, getCard },
}));

mock.module('@/lib/imageSessionCache', () => ({
  markSessionImageLoaded: mock(() => undefined),
}));

mock.module('@/utils/resolveImageUrl', () => ({
  resolveImageUrl: (url: string | null | undefined) => url ?? null,
}));

const {
  ensureCardDetail,
  fetchCardDetailNow,
  flushCardDetailPrefetch,
  prefetchCardDetail,
  resetCardDetailPrefetchQueue,
} = await import('@/lib/prefetchCardDetail');

function listItem(variantNumber: string): CardListItem {
  return {
    cardId: '11111111-1111-1111-1111-111111111111',
    name: variantNumber,
    variantNumber,
    type: 'Unit',
    energy: 1,
    might: 1,
    power: 0,
    rarity: 'Common',
    setCode: 'OGN',
    colors: [],
    imageUrl: 'https://example.com/card.webp',
    cardmarketId: null,
    priceEur: null,
    printings: [
      {
        variantNumber,
        variantLabel: 'Standard',
        isFoil: false,
        priceEur: null,
      },
    ],
    isBanned: false,
  };
}

beforeEach(() => {
  batchCards.mockClear();
  getCard.mockClear();
  resetCardDetailPrefetchQueue();
});

describe('prefetchCardDetail', () => {
  test('coalesces many list rows into one batch POST', async () => {
    const queryClient = new QueryClient();

    prefetchCardDetail(queryClient, listItem('OGN-001'));
    prefetchCardDetail(queryClient, listItem('OGN-002'));
    prefetchCardDetail(queryClient, listItem('OGN-001'));

    await flushCardDetailPrefetch();

    expect(batchCards).toHaveBeenCalledTimes(1);
    expect(batchCards.mock.calls[0]?.[0]).toEqual(['OGN-001', 'OGN-002']);
    expect(getCard).not.toHaveBeenCalled();

    expect(queryClient.getQueryData(cardQueryKeys.detail('OGN-001'))).toMatchObject({
      data: { name: 'Test Card' },
      meta: { contentHash: 'batch-prefetch' },
    });
    expect(queryClient.getQueryData(cardQueryKeys.detail('OGN-001a'))).toMatchObject({
      data: { name: 'Test Card' },
    });
    expect(queryClient.getQueryData(cardQueryKeys.detail('OGN-002'))).toMatchObject({
      data: { name: 'Other' },
    });
  });

  test('skips variants that already have fresh hydrated cache data', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(cardQueryKeys.detail('OGN-001'), {
      data: {
        id: 'cached',
        name: 'Cached',
        description: 'Already loaded rules text.',
        banEffectiveDate: null,
        variants: [],
      },
      meta: { source: 'cache', contentHash: 'x' },
    });

    prefetchCardDetail(queryClient, listItem('OGN-001'));
    await flushCardDetailPrefetch();

    expect(batchCards).not.toHaveBeenCalled();
  });

  test('fetchCardDetailNow uses a direct GET and does not wait on the batch queue', async () => {
    getCard.mockImplementation(async (variantNumber: string) => ({
      data: {
        id: 'card-direct',
        name: 'Direct',
        type: 'Unit',
        super: null,
        description: 'Rules text from GET.',
        energy: 1,
        might: 1,
        power: 0,
        tags: [],
        colors: [],
        banEffectiveDate: null,
        variants: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            variantNumber,
            rarity: 'Common',
            variantType: 'Standard',
            variantLabel: 'Standard',
            foilMode: 'nonfoil_only',
            imageUrl: 'https://example.com/card.webp',
            cardmarketId: null,
            tcgplayerId: null,
            releaseDate: null,
            artist: null,
            prices: [],
          },
        ],
      },
      meta: { source: 'upstream', contentHash: 'get' },
    }));

    const queryClient = new QueryClient();
    // Queue a batch that would otherwise delay the open path.
    prefetchCardDetail(queryClient, listItem('OGN-099'));

    const detail = await fetchCardDetailNow(queryClient, 'OGN-050');
    expect(getCard).toHaveBeenCalledWith('OGN-050');
    expect(detail.data.description).toBe('Rules text from GET.');
    expect(queryClient.getQueryData(cardQueryKeys.detail('OGN-050'))).toMatchObject({
      data: { description: 'Rules text from GET.' },
    });
  });

  test('ensureCardDetail is a no-op when description is already cached', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(cardQueryKeys.detail('OGN-001'), {
      data: { description: 'Cached rules' },
      meta: { source: 'cache', contentHash: 'x' },
    });
    ensureCardDetail(queryClient, 'OGN-001');
    expect(getCard).not.toHaveBeenCalled();
  });

  test('skips variants whose hydrated description is an empty string', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(cardQueryKeys.detail('OGN-002'), {
      data: {
        id: 'cached-empty',
        name: 'Empty Rules',
        description: '',
        banEffectiveDate: null,
        variants: [],
      },
      meta: { source: 'cache', contentHash: 'batch-prefetch' },
    });

    prefetchCardDetail(queryClient, listItem('OGN-002'));
    await flushCardDetailPrefetch();

    expect(batchCards).not.toHaveBeenCalled();
  });

  test('still prefetches list-placeholder seeds with empty description', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(cardQueryKeys.detail('OGN-001'), {
      data: {
        id: 'placeholder',
        name: 'Placeholder',
        description: '',
        banEffectiveDate: null,
        variants: [],
      },
      meta: { source: 'cache', contentHash: 'list-placeholder' },
    });

    prefetchCardDetail(queryClient, listItem('OGN-001'));
    await flushCardDetailPrefetch();

    expect(batchCards).toHaveBeenCalledTimes(1);
  });
});
