import { describe, expect, mock, test } from 'bun:test';

const getAuthCookieHeader = mock(async () => 'better-auth.session_token=live-session');
const streamFetch = mock(async (_url: string, _init: RequestInit) => {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.close();
      },
    })
  );
});

mock.module('react-native', () => ({ Platform: { OS: 'ios' } }));
mock.module('expo/fetch', () => ({ fetch: streamFetch }));
mock.module('@/lib/auth-cookie', () => ({ getAuthCookieHeader }));
mock.module('@/lib/api-url', () => ({ getApiUrl: () => 'http://api.test' }));

const { subscribeCollectionLiveEvents } = await import('./collectionLiveService');

describe('collection live authentication', () => {
  test('awaits the native session cookie before opening the event stream', async () => {
    const signal = new AbortController().signal;
    await subscribeCollectionLiveEvents({ signal, onEvent: mock() });

    expect(streamFetch).toHaveBeenCalledWith(
      'http://api.test/api/v1/collection/events',
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'text/event-stream',
          cookie: 'better-auth.session_token=live-session',
        },
        signal,
      }
    );
  });
});
