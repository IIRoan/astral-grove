import { fetchWithApiWake } from '@/lib/api-fetch';
import { getApiUrl } from '@/lib/api-url';
import { getAuthCookieHeader } from '@/lib/auth-cookie';
import { logActionFailure } from '@/lib/logger';

// Authed routes: attach Better Auth cookies manually (public catalog uses client.ts).

export const API_URL = getApiUrl();

const isBrowserRuntime = typeof document !== 'undefined';

export class RemoteApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: string
  ) {
    super(`API ${String(status)} ${path}: ${body}`);
    this.name = 'RemoteApiError';
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };

  if (!isBrowserRuntime) {
    const cookie = getAuthCookieHeader();
    if (cookie) headers.cookie = cookie;
  }

  return headers;
}

export async function authedFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; headers?: Record<string, string> }
): Promise<T> {
  const method = init?.method ?? 'GET';
  const headers = authHeaders({
    ...(init?.body == null ? {} : { 'Content-Type': 'application/json' }),
    ...init?.headers,
  });

  let res: Response;
  try {
    res = await fetchWithApiWake(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers,
      body: init?.body == null ? undefined : JSON.stringify(init.body),
    });
  } catch (error) {
    logActionFailure('api.fetch', error, { path, method });
    throw error;
  }

  const text = await res.text();
  if (!res.ok) {
    const apiError = new RemoteApiError(res.status, path, text);
    logActionFailure('api.request', apiError, {
      path,
      method,
      status: res.status,
      hasAuthCookie: Boolean(headers.cookie),
    });
    throw apiError;
  }

  try {
    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    logActionFailure('api.parse', error, { path, method });
    throw error;
  }
}

export async function authedFetchText(
  path: string,
  init?: { method?: string; accept?: string }
): Promise<string> {
  const method = init?.method ?? 'GET';
  const headers = authHeaders({
    Accept: init?.accept ?? 'text/plain',
  });

  let res: Response;
  try {
    res = await fetchWithApiWake(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers,
    });
  } catch (error) {
    logActionFailure('api.fetch', error, { path, method });
    throw error;
  }

  const text = await res.text();
  if (!res.ok) {
    const apiError = new RemoteApiError(res.status, path, text);
    logActionFailure('api.request', apiError, { path, method, status: res.status });
    throw apiError;
  }

  return text;
}

export function parseOrThrow<T>(
  action: string,
  schema: { parse: (input: unknown) => T },
  input: unknown,
  context?: Record<string, unknown>
): T {
  try {
    return schema.parse(input);
  } catch (error) {
    logActionFailure(action, error, context);
    throw error;
  }
}
