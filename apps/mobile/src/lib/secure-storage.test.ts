import { describe, expect, mock, test } from 'bun:test';

const persisted = new Map<string, string>();
const setItemAsync = mock(async (key: string, value: string) => {
  persisted.set(key, value);
});
const getItemAsync = mock(async (key: string) => persisted.get(key) ?? null);

mock.module('react-native', () => ({
  Platform: { OS: 'ios' },
  AppState: { currentState: 'active' },
}));
mock.module('expo-constants', () => ({ default: {} }));
mock.module(
  import.meta.resolve('expo-linking', import.meta.resolve('@better-auth/expo/client')),
  () => ({})
);
mock.module('expo-secure-store', () => ({
  setItemAsync,
  getItemAsync,
  deleteItemAsync: mock(async (key: string) => {
    persisted.delete(key);
  }),
}));

const { secureStorage, hydrateSecureStorage } = await import('./secure-storage');
const { storageAdapter } = await import('@better-auth/expo/client');

describe('Better Auth asynchronous secure storage', () => {
  test('persists async writes and exposes them to synchronous reads', async () => {
    await secureStorage.setItemAsync('async-write', 'session-value');
    expect(persisted.get('async-write')).toBe('session-value');
    expect(secureStorage.getItem('async-write')).toBe('session-value');
    expect(await secureStorage.getItemAsync('async-write')).toBe('session-value');
  });

  test('reads persisted chunk keys that were not hydrated into memory', async () => {
    persisted.set('astral-grove_cookie.0.0', 'persisted-cookie-chunk');
    expect(await secureStorage.getItemAsync('astral-grove_cookie.0.0')).toBe(
      'persisted-cookie-chunk'
    );
  });

  test('restores slot-based cookie chunks through the Expo storage adapter', async () => {
    const key = 'astral-grove_session_data';
    persisted.set(key, '\u0001ba-chunks:2:0');
    persisted.set(`${key}.0.0`, '{"user":');
    persisted.set(`${key}.0.1`, '{"id":"persisted-user"}}');
    await hydrateSecureStorage();

    expect(await storageAdapter(secureStorage).getItemAsync(key)).toBe(
      '{"user":{"id":"persisted-user"}}'
    );
  });

  test('prefers cleared memory values to stale persisted sessions', async () => {
    secureStorage.setItem('cleared-session', '');
    persisted.set('cleared-session', 'stale-session');
    expect(await secureStorage.getItemAsync('cleared-session')).toBe('');
  });
});
