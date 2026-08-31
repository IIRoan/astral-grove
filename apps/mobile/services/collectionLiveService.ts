import {
  CollectionLiveEvent,
  type CollectionLiveEvent as LiveEvent,
} from '@riftbound/contracts';
import { fetch } from 'expo/fetch';
import { getApiUrl } from '@/lib/api-url';
import { getAuthCookieHeader } from '@/lib/auth-cookie';
import { logActionFailure } from '@/lib/logger';
import { Platform } from 'react-native';

const isBrowserRuntime = typeof document !== 'undefined';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'text/event-stream',
  };
  if (!isBrowserRuntime) {
    const cookie = getAuthCookieHeader();
    if (cookie) headers.cookie = cookie;
  }
  return headers;
}

function parseSseBlock(block: string): LiveEvent | null {
  const lines = block.split('\n');
  let dataLine: string | null = null;
  for (const line of lines) {
    if (line.startsWith('data:')) {
      dataLine = line.slice(5).trimStart();
    }
  }
  if (!dataLine) return null;
  try {
    const parsed: unknown = JSON.parse(dataLine);
    const result = CollectionLiveEvent.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Long-lived SSE for shared-collection updates; resolves when stream ends — caller reconnects with backoff. */
export async function subscribeCollectionLiveEvents(options: {
  signal: AbortSignal;
  onEvent: (event: LiveEvent) => void;
}): Promise<void> {
  const url = `${getApiUrl()}/api/v1/collection/events`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: authHeaders(),
      signal: options.signal,
    });
  } catch (error) {
    if (options.signal.aborted) return;
    logActionFailure('collection.live.fetch', error, { platform: Platform.OS });
    throw error;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const error = new Error(`collection.live ${String(res.status)}: ${body}`);
    logActionFailure('collection.live.request', error, { status: res.status });
    throw error;
  }

  if (!res.body) {
    const error = new Error('collection.live: response body missing');
    logActionFailure('collection.live.body', error, { platform: Platform.OS });
    throw error;
  }

  const Decoder = globalThis.TextDecoder;
  if (typeof Decoder !== 'function') {
    const error = new Error('TextDecoder is not available');
    logActionFailure('collection.live.decode', error, { platform: Platform.OS });
    throw error;
  }

  const reader = res.body.getReader();
  const decoder = new Decoder();
  let buffer = '';

  try {
    while (!options.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const event = parseSseBlock(part.trim());
        if (event) options.onEvent(event);
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors on abort
    }
  }
}
