import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

process.env.EXPO_PUBLIC_API_URL = 'http://localhost:7000';

const getAuthCookieHeader = mock(async () => 'better-auth.session_token=test-session');

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
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: undefined,
  });
  requests.length = 0;
  getAuthCookieHeader.mockClear();
  globalThis.fetch = defaultFetch as typeof fetch;
  defaultFetch.mockClear();
});
afterAll(() => {
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
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

test('native JSON and export requests identify the client alongside its stored cookie', async () => {
  await authedFetch('/api/v1/collection', { method: 'POST', body: { quantity: 1 } });
  await authedFetchText('/api/v1/collection/export');
  for (const { init } of requests) {
    expect(new Headers(init?.headers).get('x-astral-request')).toBe('1');
    expect(new Headers(init?.headers).get('cookie')).toBe(
      'better-auth.session_token=test-session'
    );
    expect(init?.credentials).toBe('include');
  }
  expect(getAuthCookieHeader).toHaveBeenCalledTimes(2);
});

test('browser requests use browser cookies and retain compatibility with existing CORS allowlists', async () => {
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {} });
  await authedFetch('/api/v1/collection', { method: 'POST', body: { quantity: 1 } });
  await authedFetchText('/api/v1/collection/export');
  for (const { init } of requests) {
    expect(new Headers(init?.headers).has('x-astral-request')).toBe(false);
    expect(new Headers(init?.headers).has('cookie')).toBe(false);
    expect(init?.credentials).toBe('include');
  }
  expect(getAuthCookieHeader).not.toHaveBeenCalled();
});
