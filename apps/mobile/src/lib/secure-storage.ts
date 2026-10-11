import { Platform } from 'react-native';
import type ExpoSecureStore from 'expo-secure-store';

/** Better Auth storage: web=localStorage; native=SecureStore + memory cache (hydrate on start). */

const CHUNK_MARKER = 'ba-chunks:';
const KNOWN_KEYS = ['astral-grove_cookie', 'astral-grove_session_data'];
const MAX_CHUNKS = 30;

const isWeb = Platform.OS === 'web';

// In-memory cache for native (web uses localStorage directly)
const cache = new Map<string, string>();

// Lazy-load expo-secure-store on native (older dev clients may lack the module until EAS rebuild).
let SecureStore: typeof ExpoSecureStore | null = null;
if (!isWeb) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SecureStore = require('expo-secure-store');
  } catch {
    SecureStore = null;
  }
}

function webGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function webSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota errors
  }
}

function webRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const secureStorage = {
  getItem(key: string): string | null {
    if (isWeb) return webGetItem(key);
    return cache.get(key) ?? null;
  },

  async getItemAsync(key: string): Promise<string | null> {
    if (isWeb) return webGetItem(key);
    if (cache.has(key)) return cache.get(key) ?? null;
    const value = (await SecureStore?.getItemAsync(key)) ?? null;
    if (cache.has(key)) return cache.get(key) ?? null;
    if (value !== null) cache.set(key, value);
    return value;
  },

  setItem(key: string, value: string): void {
    if (isWeb) {
      webSetItem(key, value);
      return;
    }
    cache.set(key, value);
    if (SecureStore) {
      void SecureStore.setItemAsync(key, value);
    }
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    if (isWeb) {
      webSetItem(key, value);
      return;
    }
    cache.set(key, value);
    await SecureStore?.setItemAsync(key, value);
  },

  removeItem(key: string): void {
    if (isWeb) {
      webRemoveItem(key);
      return;
    }
    cache.delete(key);
    if (SecureStore) {
      void SecureStore.deleteItemAsync(key);
    }
  },
};

/** Prefill native SecureStore→memory cache for sync reads after restart; no-op on web. */
export async function hydrateSecureStorage(): Promise<void> {
  if (isWeb || !SecureStore) return;

  await Promise.all(
    KNOWN_KEYS.map(async (baseKey) => {
      const value = await SecureStore.getItemAsync(baseKey);
      if (value === null) return;

      cache.set(baseKey, value);

      if (value.startsWith(CHUNK_MARKER)) {
        const count = parseInt(value.slice(CHUNK_MARKER.length), 10);
        await Promise.all(
          Array.from({ length: Math.min(count, MAX_CHUNKS) }, async (_, i) => {
            const chunkKey = `${baseKey}.${i}`;
            const chunk = await SecureStore.getItemAsync(chunkKey);
            if (chunk !== null) {
              cache.set(chunkKey, chunk);
            }
          })
        );
      }
    })
  );
}
