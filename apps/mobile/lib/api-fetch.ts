import { ApiErrorResponse } from '@riftbound/contracts';

/** Delay before retrying after a likely Railway cold-start / gateway failure. */
export const API_WAKE_RETRY_DELAY_MS = 4_000;

const WAKE_STATUS_CODES = new Set([408, 425, 429, 502, 503, 504]);
// The API rejects these before doing any work, so retrying cannot duplicate a write.
const UNPROCESSED_STATUS_CODES = new Set([425, 429]);

/** Human-readable message from an API error body, falling back to the raw text. */
export function apiErrorMessage(status: number, body: string): string {
  try {
    // Auth routes answer `{message}` without `error`, so both fields are optional here.
    const parsed = ApiErrorResponse.partial().safeParse(JSON.parse(body));
    const text = parsed.success
      ? (parsed.data.message ?? parsed.data.error)
      : undefined;
    if (text) return text;
  } catch {
    // Plain-text bodies fall through to the raw text.
  }
  return body || `Request failed (${String(status)})`;
}

export function isApiWakeStatus(status: number): boolean {
  return WAKE_STATUS_CODES.has(status);
}

export function isApiWakeNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name === 'typeerror' ||
    name === 'aborterror' ||
    name === 'networkerror' ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Wait the API asked for before retrying, in ms (0 when unstated). */
function retryAfterMs(res: Response): number {
  const seconds = Number(
    res.headers.get('retry-after') ?? res.headers.get('x-retry-after') ?? 0
  );
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

/**
 * On cold-start failure (network/gateway), wait for wake and retry once.
 * Pass `readOnly` for POSTs that only read (batch lookups) so they retry like GETs.
 */
export async function fetchWithApiWake(
  input: RequestInfo | URL,
  init?: RequestInit,
  { readOnly = false }: { readOnly?: boolean } = {}
): Promise<Response> {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();
  const idempotent =
    readOnly || method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  try {
    const res = await fetch(input, init);
    if (
      !(idempotent
        ? isApiWakeStatus(res.status)
        : UNPROCESSED_STATUS_CODES.has(res.status)) ||
      retryAfterMs(res) > API_WAKE_RETRY_DELAY_MS
    ) {
      return res;
    }

    await delay(API_WAKE_RETRY_DELAY_MS);
    return fetch(input, init);
  } catch (error) {
    if (!idempotent || !isApiWakeNetworkError(error)) {
      throw error;
    }

    await delay(API_WAKE_RETRY_DELAY_MS);
    return fetch(input, init);
  }
}
