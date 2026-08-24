import { beforeEach, describe, expect, mock, test } from 'bun:test';

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:7000';

const getAuthCookieHeader = mock(() => 'better-auth.session_token=test-session');

mock.module('@/lib/auth-cookie', () => ({
  getAuthCookieHeader,
}));

const requests: Array<{ url: string; init?: RequestInit }> = [];

const defaultFetch = mock(async (input: RequestInfo | URL, init?: RequestInit) => {
  requests.push({ url: String(input), init });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

beforeEach(() => {
  requests.length = 0;
  getAuthCookieHeader.mockClear();
  globalThis.fetch = defaultFetch as typeof fetch;
  defaultFetch.mockClear();
});

const { authedFetch, authedFetchText, RemoteApiError } =
  await import('@/src/api/authedClient');

describe('authedFetch', () => {
  test('attaches session cookie on native runtimes', async () => {
    const data = await authedFetch<{ ok: boolean }>('/api/v1/collection');
    expect(data.ok).toBe(true);
    expect(requests[0]?.url).toBe('http://localhost:7000/api/v1/collection');
    const headers = requests[0]?.init?.headers as Record<string, string>;
    expect(headers.cookie).toBe('better-auth.session_token=test-session');
  });

  test('throws RemoteApiError with status and body', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('nope', { status: 401 });
    }) as typeof fetch;

    await expect(authedFetch('/api/v1/wishlist')).rejects.toBeInstanceOf(
      RemoteApiError
    );
  });
});

describe('authedFetchText', () => {
  test('returns raw response text', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('a,b,c', { status: 200 });
    }) as typeof fetch;

    const csv = await authedFetchText('/api/v1/collection/export', {
      accept: 'text/csv',
    });
    expect(csv).toBe('a,b,c');
  });
});
