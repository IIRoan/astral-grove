import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { CardListItem } from '@riftbound/contracts';
import type { CollectionEntry } from './collectionService';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:7000';

const getCookie = mock(() => 'better-auth.session_token=test-session');
const getAuthCookieHeader = mock(() => 'better-auth.session_token=test-session');

mock.module('@/src/lib/auth-client', () => ({
  authClient: {
    getCookie,
  },
}));

mock.module('@/lib/auth-cookie', () => ({
  getAuthCookieHeader,
}));

interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
}

const requests: RecordedRequest[] = [];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
  requests.push({ url: String(input), init });
  return jsonResponse({
    data: {
      id: '11111111-1111-1111-1111-111111111111',
      variantNumber: 'SFD-R05a',
      quantity: 1,
      condition: 'near_mint',
      language: 'en',
      isFoil: true,
      notes: null,
      isGraded: false,
      gradeCompany: null,
      gradeScore: null,
      acquiredAt: null,
      acquiredPriceCents: null,
      addedAt: '2026-07-03T00:00:00.000Z',
      updatedAt: '2026-07-03T00:00:00.000Z',
      name: 'SFD Foil',
      imageUrl: 'https://example.com/sfd-r05a.webp',
      setCode: 'SFD',
      rarity: 'Rare',
      type: 'Rune',
      variantLabel: 'Foil',
    },
  });
});

globalThis.fetch = fetchMock as typeof fetch;

const {
  addDetailToCollection,
  addToCollection,
  updateCollectionQuantity,
  filterCollection,
} = await import('./collectionService');
const { getCollectedPrintingsForDetailCard, getCollectedPrintingsForListCard } =
  await import('@/utils/collectionRemove');
const { remoteAddToCollection, remoteAddToWishlist, remoteRemoveFromWishlist } =
  await import('./remoteCollectionService');

const listCard: CardListItem = {
  cardId: '22222222-2222-2222-2222-222222222222',
  variantNumber: 'SFD-R05',
  name: 'SFD Rune',
  type: 'Rune',
  energy: 0,
  might: 0,
  power: 0,
  rarity: 'Rare',
  setCode: 'SFD',
  colors: [],
  imageUrl: 'https://example.com/sfd-r05.webp',
  cardmarketId: null,
  priceEur: null,
  printings: [
    {
      variantNumber: 'SFD-R05',
      variantLabel: 'Standard',
      isFoil: false,
      priceEur: null,
    },
    {
      variantNumber: 'SFD-R05a',
      variantLabel: 'Foil',
      isFoil: true,
      priceEur: null,
    },
  ],
  isBanned: false,
};

beforeEach(() => {
  requests.length = 0;
  fetchMock.mockClear();
  getCookie.mockClear();
  getAuthCookieHeader.mockClear();
});

function expectPostToSelectedVariant(variantNumber: string, isFoil = true) {
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe(
    `http://localhost:7000/api/v1/collection/${variantNumber}/add`
  );
  expect(requests[0]?.init?.method).toBe('POST');
  expect(requests[0]?.init?.credentials).toBe('include');
  expect(requests[0]?.init?.body).toBe(JSON.stringify({ delta: 1, isFoil }));
  expect(new Headers(requests[0]?.init?.headers).get('content-type')).toBe(
    'application/json'
  );
}

function expectWriteRequest({
  url,
  method,
  body,
}: {
  url: string;
  method: string;
  body?: unknown;
}) {
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe(`http://localhost:7000${url}`);
  expect(requests[0]?.init?.method).toBe(method);
  expect(requests[0]?.init?.credentials).toBe('include');
  expect(requests[0]?.init?.body).toBe(
    body === undefined ? undefined : JSON.stringify(body)
  );
  if (body !== undefined) {
    expect(new Headers(requests[0]?.init?.headers).get('content-type')).toBe(
      'application/json'
    );
  }
}

describe('remote collection writes', () => {
  test('adds a selected variant with an authenticated POST request', async () => {
    await remoteAddToCollection('SFD-R05a', 1, true);

    expect(getAuthCookieHeader).toHaveBeenCalled();
    expectPostToSelectedVariant('SFD-R05a', true);
  });
});

describe('remote wishlist writes', () => {
  test('adds a wishlist item with an authenticated PUT request', async () => {
    await remoteAddToWishlist('SFD-R05a');

    expect(getAuthCookieHeader).toHaveBeenCalled();
    expectWriteRequest({
      url: '/api/v1/wishlist/SFD-R05a',
      method: 'PUT',
      body: { variantNumber: 'SFD-R05a' },
    });
  });

  test('removes a wishlist item with an authenticated DELETE request', async () => {
    await remoteRemoveFromWishlist('SFD-R05a');

    expect(getAuthCookieHeader).toHaveBeenCalled();
    expectWriteRequest({
      url: '/api/v1/wishlist/SFD-R05a',
      method: 'DELETE',
    });
  });
});

describe('collection add flows', () => {
  test('quick-add stores the printing selected from the card picker', async () => {
    await addToCollection(listCard, { variantNumber: 'SFD-R05a' });

    expectPostToSelectedVariant('SFD-R05a');
  });

  test('detail printing row stores the exact printing that was clicked', async () => {
    await addDetailToCollection(
      {
        name: 'SFD Rune',
        type: 'Rune',
        variants: [
          {
            variantNumber: 'SFD-R05',
            imageUrl: 'https://example.com/sfd-r05.webp',
            rarity: 'Rare',
            variantLabel: 'Standard',
            variantType: 'standard',
            prices: [],
          },
          {
            variantNumber: 'SFD-R05a',
            imageUrl: 'https://example.com/sfd-r05a.webp',
            rarity: 'Rare',
            variantLabel: 'Foil',
            variantType: 'foil',
            prices: [],
          },
        ],
      },
      'SFD-R05a'
    );

    expectPostToSelectedVariant('SFD-R05a');
  });

  test('detail add matches variant numbers case-insensitively', async () => {
    await addDetailToCollection(
      {
        name: 'SFD Rune',
        type: 'Rune',
        variants: [
          {
            variantNumber: 'SFD-R05a',
            imageUrl: 'https://example.com/sfd-r05a.webp',
            rarity: 'Rare',
            variantLabel: 'Foil',
            variantType: 'foil',
            prices: [],
          },
        ],
      },
      'sfd-r05a'
    );

    expectPostToSelectedVariant('SFD-R05a');
  });
});

describe('collection quantity floors', () => {
  test('setting quantity below zero deletes instead of writing a negative quantity', async () => {
    await updateCollectionQuantity('SFD-R05a', -1);

    expectWriteRequest({
      url: '/api/v1/collection/SFD-R05a',
      method: 'DELETE',
    });
  });

  test('remove options only include positive owned quantities', () => {
    const rows = getCollectedPrintingsForListCard(
      listCard,
      new Map([
        [
          'SFD-R05',
          {
            variantNumber: 'SFD-R05',
            name: 'SFD Rune',
            imageUrl: 'https://example.com/sfd-r05.webp',
            setCode: 'SFD',
            rarity: 'Rare',
            type: 'Rune',
            variantLabel: 'Standard',
            isFoil: false,
            quantity: 0,
            addedAt: 0,
            updatedAt: 0,
          },
        ],
        [
          'SFD-R05a',
          {
            variantNumber: 'SFD-R05a',
            name: 'SFD Rune',
            imageUrl: 'https://example.com/sfd-r05a.webp',
            setCode: 'SFD',
            rarity: 'Rare',
            type: 'Rune',
            variantLabel: 'Foil',
            isFoil: true,
            quantity: -1,
            addedAt: 0,
            updatedAt: 0,
          },
        ],
      ])
    );

    expect(rows).toEqual([]);
  });

  test('detail remove options only include positive owned quantities', () => {
    const rows = getCollectedPrintingsForDetailCard(
      {
        variants: [
          {
            variantNumber: 'SFD-R05',
            variantLabel: 'Standard',
            variantType: 'standard',
          },
          {
            variantNumber: 'SFD-R05a',
            variantLabel: 'Foil',
            variantType: 'foil',
          },
        ],
      },
      new Map([
        [
          'SFD-R05',
          {
            variantNumber: 'SFD-R05',
            name: 'SFD Rune',
            imageUrl: 'https://example.com/sfd-r05.webp',
            setCode: 'SFD',
            rarity: 'Rare',
            type: 'Rune',
            variantLabel: 'Standard',
            isFoil: false,
            quantity: 0,
            addedAt: 0,
            updatedAt: 0,
          },
        ],
        [
          'SFD-R05a',
          {
            variantNumber: 'SFD-R05a',
            name: 'SFD Rune',
            imageUrl: 'https://example.com/sfd-r05a.webp',
            setCode: 'SFD',
            rarity: 'Rare',
            type: 'Rune',
            variantLabel: 'Foil',
            isFoil: true,
            quantity: -1,
            addedAt: 0,
            updatedAt: 0,
          },
        ],
      ])
    );

    expect(rows).toEqual([]);
  });
});

describe('filterCollection', () => {
  const ambessa: CollectionEntry = {
    variantNumber: 'VEN-153',
    name: 'Ambessa, Matriarch of War',
    imageUrl: 'https://example.com/ambessa.webp',
    setCode: 'VEN',
    rarity: 'Rare',
    type: 'Legend',
    variantLabel: 'Standard',
    isFoil: false,
    quantity: 1,
    addedAt: 0,
    updatedAt: 0,
  };

  test('matches the second word of a punctuated title', () => {
    expect(filterCollection([ambessa], 'ambessa matriarch')).toEqual([ambessa]);
    expect(filterCollection([ambessa], 'matriarch')).toEqual([ambessa]);
  });

  test('matches a one-letter typo of Ambessa', () => {
    expect(filterCollection([ambessa], 'embessa')).toEqual([ambessa]);
  });

  test('matches Stagazer when the query is stargazer', () => {
    const stagazer: CollectionEntry = {
      ...ambessa,
      variantNumber: 'VEN-098',
      name: 'Stagazer',
      type: 'Unit',
    };
    expect(filterCollection([stagazer], 'stargazer')).toEqual([stagazer]);
  });
});
