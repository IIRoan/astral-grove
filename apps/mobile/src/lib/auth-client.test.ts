import { afterAll, expect, mock, setSystemTime, test } from 'bun:test';

const DAY = 86_400_000;
const start = new Date('2026-10-26T12:00:00.000Z').getTime();
const keychain = new Map<string, string>();
const sent: string[] = [];

mock.module('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
}));
mock.module('expo-constants', () => ({
  default: { expoConfig: { scheme: 'astral-grove' } },
}));
mock.module(
  import.meta.resolve('expo-linking', import.meta.resolve('@better-auth/expo/client')),
  () => ({ createURL: () => 'astral-grove://' })
);
mock.module('expo-secure-store', () => ({
  getItemAsync: async (key: string) => keychain.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    keychain.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    keychain.delete(key);
  },
}));
mock.module('@/lib/api-url', () => ({ getApiUrl: () => 'http://localhost:7000' }));
// Behaves like the backend: every valid get-session re-issues a 90-day cookie.
mock.module('@/lib/api-fetch', () => ({
  fetchWithApiWake: async (_input: RequestInfo | URL, init?: RequestInit) => {
    const cookie = new Headers(init?.headers).get('cookie') ?? '';
    sent.push(cookie);
    if (cookie !== 'better-auth.session_token=signed-token') return Response.json(null);
    const expiresAt = new Date(Date.now() + 90 * DAY).toISOString();
    return Response.json(
      {
        user: {
          id: 'user-1',
          email: 'a@test.riftbound.dev',
          name: 'A',
          emailVerified: true,
        },
        session: { id: 'session-1', userId: 'user-1', token: 'token', expiresAt },
      },
      {
        headers: {
          'set-cookie': `better-auth.session_token=signed-token; Path=/; HttpOnly; SameSite=Lax; Max-Age=${90 * 86400}`,
        },
      }
    );
  },
}));

// A cookie saved before the relaunch exists only in the keychain, not in the memory cache.
keychain.set(
  'astral-grove_cookie',
  JSON.stringify({
    'better-auth.session_token': {
      value: 'signed-token',
      expires: new Date(start + 90 * DAY).toISOString(),
    },
  })
);
const { authClient } = await import('./auth-client');

afterAll(() => {
  setSystemTime();
});

test('the iOS client stays signed in across months of relaunches and drops the cookie after 90 idle days', async () => {
  const launch = async (day: number) => {
    setSystemTime(new Date(start + day * DAY));
    return (await authClient.getSession()).data?.user.id;
  };
  for (const day of [1, 2, 30, 89, 120, 209]) {
    expect(await launch(day)).toBe('user-1');
  }
  expect(keychain.get('astral-grove_cookie')).toContain(
    new Date(start + 299 * DAY).toISOString()
  );
  expect(await launch(300)).toBeUndefined();
  expect(sent.at(-1)).toBe('');
});
