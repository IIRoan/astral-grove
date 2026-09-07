import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import {
  resolveAppUpdateAction,
  resolveAppUpdatePhase,
  type AppUpdatePhase,
  type UpdateCheckResult,
} from '@/lib/app-update';

type AppUpdateValue = {
  enabled: boolean;
  phase: AppUpdatePhase;
  /** Undismissed intent for Settings — install/restart even after Later. */
  action: AppUpdatePhase;
  channel: string | null;
  downloadProgress: number | undefined;
  errorMessage: string | null;
  check: () => Promise<UpdateCheckResult>;
  install: () => Promise<void>;
  restart: () => Promise<void>;
  dismiss: () => void;
};

const AppUpdateContext = createContext<AppUpdateValue | null>(null);

export function useAppUpdate(): AppUpdateValue {
  const ctx = useContext(AppUpdateContext);
  if (!ctx) {
    throw new Error('useAppUpdate must be used within AppUpdateProvider');
  }
  return ctx;
}

export function AppUpdateProvider({ children }: { children: React.ReactNode }) {
  const updates = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const enabled = Updates.isEnabled && Platform.OS !== 'web';

  const snapshot = {
    enabled,
    isRestarting: updates.isRestarting,
    isDownloading: updates.isDownloading,
    isUpdatePending: updates.isUpdatePending,
    isUpdateAvailable: updates.isUpdateAvailable,
    downloadError: Boolean(updates.downloadError),
    dismissed,
  };
  const phase = resolveAppUpdatePhase(snapshot);
  const action = resolveAppUpdateAction(snapshot);

  const check = useCallback(async (): Promise<UpdateCheckResult> => {
    if (!enabled) return { status: 'disabled' };
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setDismissed(false);
        return { status: 'available' };
      }
      return { status: 'up-to-date' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not check for updates';
      return { status: 'error', message };
    }
  }, [enabled]);

  const install = useCallback(async () => {
    if (!enabled) return;
    setDismissed(false);
    try {
      await Updates.fetchUpdateAsync();
    } catch {
      // downloadError is exposed via useUpdates.
    }
  }, [enabled]);

  const restart = useCallback(async () => {
    if (!enabled) return;
    try {
      await Updates.reloadAsync();
    } catch {
      // reloadAsync rejects in Expo Go / dev; the screen already hides when disabled.
    }
  }, [enabled]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const value = useMemo<AppUpdateValue>(
    () => ({
      enabled,
      phase,
      action,
      channel: Updates.channel,
      downloadProgress: updates.downloadProgress,
      errorMessage: updates.downloadError?.message ?? null,
      check,
      install,
      restart,
      dismiss: () => setDismissed(true),
    }),
    [
      enabled,
      phase,
      action,
      updates.downloadProgress,
      updates.downloadError?.message,
      check,
      install,
      restart,
    ]
  );

  return (
    <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>
  );
}
