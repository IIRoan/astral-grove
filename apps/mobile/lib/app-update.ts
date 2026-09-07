export type AppUpdatePhase =
  | 'idle'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'restarting'
  | 'error';

export type AppUpdateSnapshot = {
  enabled: boolean;
  isRestarting: boolean;
  isDownloading: boolean;
  isUpdatePending: boolean;
  isUpdateAvailable: boolean;
  downloadError: boolean;
  dismissed: boolean;
};

export type UpdateCheckResult =
  | { status: 'disabled' }
  | { status: 'available' }
  | { status: 'up-to-date' }
  | { status: 'error'; message: string };

export function resolveAppUpdatePhase(snapshot: AppUpdateSnapshot): AppUpdatePhase {
  if (!snapshot.enabled) return 'idle';
  if (snapshot.isRestarting) return 'restarting';
  if (snapshot.isDownloading) return 'downloading';
  if (snapshot.downloadError && !snapshot.dismissed) return 'error';
  if (snapshot.isUpdatePending && !snapshot.dismissed) return 'ready';
  if (snapshot.isUpdateAvailable && !snapshot.dismissed) return 'available';
  return 'idle';
}

/** Settings CTA: Later hides full-screen dispatch; waiting/failed bundles can still install this session. */
export function resolveAppUpdateAction(snapshot: AppUpdateSnapshot): AppUpdatePhase {
  return resolveAppUpdatePhase({ ...snapshot, dismissed: false });
}

export function formatChannelLabel(channel: string | null | undefined): string {
  const value = channel?.trim();
  if (!value) return 'MAIN';
  return value.toUpperCase();
}

export function formatUpdateId(id: string | null | undefined): string {
  if (!id) return 'embedded';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function formatDownloadPercent(progress: number | undefined): number {
  if (progress === undefined || Number.isNaN(progress)) return 0;
  return Math.max(0, Math.min(100, Math.round(progress * 100)));
}

export function toastCopyForUpdateCheck(result: UpdateCheckResult): {
  type: 'success' | 'error' | 'message';
  text: string;
} {
  switch (result.status) {
    case 'disabled':
      return { type: 'message', text: 'Updates are off in this build' };
    case 'available':
      return { type: 'success', text: 'Update available' };
    case 'up-to-date':
      return { type: 'message', text: 'No update available' };
    case 'error':
      return {
        type: 'error',
        text: result.message.trim() || 'Could not check for updates',
      };
  }
}
