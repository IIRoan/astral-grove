import { beforeEach, describe, expect, mock, test } from 'bun:test';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:7000';

const getAuthCookieHeader = mock(() => 'better-auth.session_token=test-session');

mock.module('@/lib/auth-cookie', () => ({
  getAuthCookieHeader,
}));

interface RecordedRequest {
  url: string;
  init: RequestInit | undefined;
}

const requests: RecordedRequest[] = [];

const fetchMock = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
  requests.push({ url: String(input), init });
  return new Response(
    JSON.stringify({
      data: [
        { variantNumber: 'OGN-001', isFoil: false, quantity: 2 },
        { variantNumber: 'OGN-999', isFoil: false, quantity: 0 },
      ],
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
});

globalThis.fetch = fetchMock as typeof fetch;

const { fetchRemoteCollectionQuantities } = await import('./remoteCollectionService');

beforeEach(() => {
  requests.length = 0;
  fetchMock.mockClear();
  getAuthCookieHeader.mockClear();
});

describe('fetchRemoteCollectionQuantities', () => {
  test('posts variant numbers to the quantities endpoint', async () => {
    const rows = await fetchRemoteCollectionQuantities(['OGN-001', 'OGN-999']);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe('http://localhost:7000/api/v1/collection/quantities');
    expect(requests[0]?.init?.method).toBe('POST');
    expect(requests[0]?.init?.body).toBe(
      JSON.stringify({ variantNumbers: ['OGN-001', 'OGN-999'] })
    );
    expect(rows).toEqual([
      { variantNumber: 'OGN-001', isFoil: false, quantity: 2 },
      { variantNumber: 'OGN-999', isFoil: false, quantity: 0 },
    ]);
  });

  test('returns an empty array without calling the API', async () => {
    const rows = await fetchRemoteCollectionQuantities([]);

    expect(rows).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  test('chunks variant numbers into batches of 200', async () => {
    const variantNumbers = Array.from({ length: 205 }, (_, index) => `OGN-${String(index + 1).padStart(3, '0')}`);

    await fetchRemoteCollectionQuantities(variantNumbers);

    expect(requests).toHaveLength(2);
    expect(JSON.parse(String(requests[0]?.init?.body)).variantNumbers).toHaveLength(200);
    expect(JSON.parse(String(requests[1]?.init?.body)).variantNumbers).toHaveLength(5);
  });
});
