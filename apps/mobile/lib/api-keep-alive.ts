import { getApiUrl } from '@/lib/api-url';

/** Railway serverless sleeps after ~10 min without outbound traffic; ping well before that. */
export const API_KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000;

export function apiHealthUrl(apiUrl = getApiUrl()): string {
  return `${apiUrl.replace(/\/$/, '')}/api/v1/health`;
}

/** Lightweight health ping so the API keeps outbound DB traffic while the app is active. */
export async function pingApiKeepAlive(
  apiUrl = getApiUrl(),
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const res = await fetch(apiHealthUrl(apiUrl), {
      method: 'GET',
      signal,
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}
