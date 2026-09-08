import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CatalogLayout,
  SettingsDeviceProfile,
  ThemePreference,
} from '@riftbound/contracts';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import type { GridCardSize } from '@/lib/grid-columns';
import { logActionFailure } from '@/lib/logger';
import { resolveSettingsDeviceProfile } from '@/lib/settings-device';
import {
  DEFAULT_SETTINGS,
  LEGACY_SETTINGS_KEY,
  parseSettings,
  parseStoredProfiles,
  reconcileRemoteSettings,
  serializeProfiles,
  settingsStorageKey,
  withDeviceSettings,
  type Settings,
  type StoredProfiles,
} from '@/lib/settings-storage';
import { fetchRemoteSettings, putRemoteSettings } from '@/services/settingsService';
import { authClient } from '@/src/lib/auth-client';

export type ThemeType = ThemePreference;
export type ColorScheme = 'light' | 'dark';
export type { GridCardSize };

const REMOTE_SYNC_DEBOUNCE_MS = 400;
const REMOTE_SYNC_RETRY_MS = 2_000;

type ThemeContextValue = {
  theme: ThemeType;
  actualTheme: ColorScheme;
  accentColor?: string;
  defaultLayout: CatalogLayout;
  gridCardSize: GridCardSize;
  deviceProfile: SettingsDeviceProfile;
  setTheme: (theme: ThemeType) => void;
  setAccentColor: (color: string) => void;
  setDefaultLayout: (layout: CatalogLayout) => void;
  setGridCardSize: (size: GridCardSize) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function migrateLegacySettingsIfNeeded(): Promise<void> {
  const anonKey = settingsStorageKey(null);
  const [legacy, anon] = await Promise.all([
    AsyncStorage.getItem(LEGACY_SETTINGS_KEY),
    AsyncStorage.getItem(anonKey),
  ]);
  if (!legacy || anon) return;
  await AsyncStorage.setItem(anonKey, serializeProfiles(parseStoredProfiles(legacy)));
  await AsyncStorage.removeItem(LEGACY_SETTINGS_KEY);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = (useColorScheme() as ColorScheme) || 'dark';
  const showSideRail = useShowSideRail();
  const deviceProfile = resolveSettingsDeviceProfile(showSideRail);
  const sessionQuery = authClient.useSession();
  const userId = sessionQuery.data?.user?.id ?? null;

  const [profiles, setProfiles] = useState<StoredProfiles>({});
  const [storageUserId, setStorageUserId] = useState<string | null | undefined>(
    undefined
  );
  const [loaded, setLoaded] = useState(false);
  const [syncNonce, setSyncNonce] = useState(0);
  const [syncRetryAt, setSyncRetryAt] = useState<number | null>(null);

  const profilesRef = useRef(profiles);
  const userIdRef = useRef(userId);
  const previousUserIdRef = useRef(userId);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncedUserRef = useRef<string | null>(null);
  const lastSyncedDeviceRef = useRef<SettingsDeviceProfile | null>(null);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const storageAligned = loaded && storageUserId === userId;
  const settings = profiles[deviceProfile]?.settings ?? DEFAULT_SETTINGS;

  useEffect(() => {
    let cancelled = false;
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;
    lastSyncedUserRef.current = null;
    lastSyncedDeviceRef.current = null;
    setSyncRetryAt(null);
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    void (async () => {
      try {
        await migrateLegacySettingsIfNeeded();
        // Keep device appearance after sign-out without attaching it to the next account.
        if (
          previousUserId &&
          !userId &&
          Object.keys(profilesRef.current).length > 0
        ) {
          await AsyncStorage.setItem(
            settingsStorageKey(null),
            serializeProfiles(profilesRef.current)
          );
        }
        const raw = await AsyncStorage.getItem(settingsStorageKey(userId));
        if (cancelled) return;
        setProfiles(raw ? parseStoredProfiles(raw) : {});
        setStorageUserId(userId);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persistProfiles = useCallback(async (nextProfiles: StoredProfiles) => {
    const ownerId = userIdRef.current;
    profilesRef.current = nextProfiles;
    setProfiles(nextProfiles);
    await AsyncStorage.setItem(
      settingsStorageKey(ownerId),
      serializeProfiles(nextProfiles)
    );
  }, []);

  const scheduleRemoteSync = useCallback(
    (device: SettingsDeviceProfile, next: Settings) => {
      if (!userIdRef.current) return;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        if (!userIdRef.current) return;
        void putRemoteSettings(device, next).catch((error) => {
          logActionFailure('settings.remote.put', error, { device });
        });
      }, REMOTE_SYNC_DEBOUNCE_MS);
    },
    []
  );

  const persistDevice = useCallback(
    async (patch: Partial<Settings>) => {
      const now = new Date().toISOString();
      const prev = profilesRef.current;
      const current = prev[deviceProfile]?.settings ?? DEFAULT_SETTINGS;
      const nextSettings = parseSettings({ ...current, ...patch });
      const nextProfiles = withDeviceSettings(prev, deviceProfile, nextSettings, now);
      profilesRef.current = nextProfiles;
      setProfiles(nextProfiles);
      await AsyncStorage.setItem(
        settingsStorageKey(userIdRef.current),
        serializeProfiles(nextProfiles)
      );
      scheduleRemoteSync(deviceProfile, nextSettings);
    },
    [deviceProfile, scheduleRemoteSync]
  );

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (syncRetryAt == null) return;
    const delay = Math.max(0, syncRetryAt - Date.now());
    const retryTimer = setTimeout(() => {
      setSyncRetryAt(null);
      setSyncNonce((value) => value + 1);
    }, delay);
    return () => clearTimeout(retryTimer);
  }, [syncRetryAt]);

  useEffect(() => {
    let cancelled = false;

    if (!storageAligned) {
      return () => {
        cancelled = true;
      };
    }

    if (!userId) {
      lastSyncedUserRef.current = null;
      lastSyncedDeviceRef.current = null;
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      return () => {
        cancelled = true;
      };
    }

    const alreadySynced =
      lastSyncedUserRef.current === userId &&
      lastSyncedDeviceRef.current === deviceProfile;

    if (!alreadySynced) {
      void (async () => {
        try {
          const remote = await fetchRemoteSettings(deviceProfile);
          if (cancelled || userIdRef.current !== userId) return;

          const localEntry = profilesRef.current[deviceProfile];

          if (remote.updatedAt) {
            const decision = reconcileRemoteSettings(localEntry, {
              settings: remote.settings,
              updatedAt: remote.updatedAt,
            });

            if (decision.action === 'keep-local') {
              await putRemoteSettings(deviceProfile, decision.settings);
            } else {
              await persistProfiles(
                withDeviceSettings(
                  profilesRef.current,
                  deviceProfile,
                  decision.settings,
                  decision.localUpdatedAt
                )
              );
            }
          } else {
            // User-keyed local store only — never seed another account's prefs.
            const seed = localEntry?.settings ?? DEFAULT_SETTINGS;
            await putRemoteSettings(deviceProfile, seed);
            if (!localEntry) {
              await persistProfiles(
                withDeviceSettings(
                  profilesRef.current,
                  deviceProfile,
                  seed,
                  new Date().toISOString()
                )
              );
            }
          }

          if (cancelled || userIdRef.current !== userId) return;
          lastSyncedUserRef.current = userId;
          lastSyncedDeviceRef.current = deviceProfile;
        } catch (error) {
          logActionFailure('settings.remote.sync', error, {
            device: deviceProfile,
          });
          if (cancelled) return;
          setSyncRetryAt(Date.now() + REMOTE_SYNC_RETRY_MS);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [storageAligned, userId, deviceProfile, syncNonce, persistProfiles]);

  const actualTheme: ColorScheme =
    settings.theme === 'system' ? systemScheme : settings.theme;

  useEffect(() => {
    Uniwind.setTheme(settings.theme === 'system' ? 'system' : settings.theme);
  }, [settings.theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: settings.theme,
      actualTheme,
      accentColor: settings.accentColor,
      defaultLayout: settings.defaultLayout,
      gridCardSize: settings.gridCardSize,
      deviceProfile,
      setTheme: (theme) => {
        void persistDevice({ theme });
      },
      setAccentColor: (accentColor) => {
        void persistDevice({ accentColor });
      },
      setDefaultLayout: (defaultLayout) => {
        void persistDevice({ defaultLayout });
      },
      setGridCardSize: (gridCardSize) => {
        void persistDevice({ gridCardSize });
      },
    }),
    [settings, actualTheme, deviceProfile, persistDevice]
  );

  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
