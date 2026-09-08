import type {
  SettingsDeviceProfile,
  UserSettingsPayload,
} from '@riftbound/contracts';
import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  UserSettingsPayload as UserSettingsPayloadSchema,
} from '@riftbound/contracts';
import { DEFAULT_GRID_CARD_SIZE, isGridCardSize } from '@/lib/grid-columns';

export type Settings = UserSettingsPayload;

export type DeviceSettingsEntry = {
  settings: Settings;
  localUpdatedAt: string;
};

export type StoredProfiles = Partial<
  Record<SettingsDeviceProfile, DeviceSettingsEntry>
>;

export const LEGACY_SETTINGS_KEY = 'riftbound_settings';
const ENVELOPE_VERSION = 1 as const;

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_USER_SETTINGS,
  gridCardSize: DEFAULT_GRID_CARD_SIZE,
};

export function settingsStorageKey(userId: string | null): string {
  return userId
    ? `riftbound_settings:v1:user:${userId}`
    : 'riftbound_settings:v1:anon';
}

export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const parsed = UserSettingsPayloadSchema.partial().safeParse(raw);
  if (!parsed.success) return DEFAULT_SETTINGS;
  const merged = mergeUserSettings(DEFAULT_SETTINGS, parsed.data);
  return {
    ...merged,
    gridCardSize: isGridCardSize(merged.gridCardSize)
      ? merged.gridCardSize
      : DEFAULT_GRID_CARD_SIZE,
  };
}

function parseDeviceEntry(raw: unknown, fallbackUpdatedAt: string): DeviceSettingsEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  if ('settings' in record) {
    const localUpdatedAt =
      typeof record.localUpdatedAt === 'string' && record.localUpdatedAt.length > 0
        ? record.localUpdatedAt
        : fallbackUpdatedAt;
    return {
      settings: parseSettings(record.settings),
      localUpdatedAt,
    };
  }

  return {
    settings: parseSettings(raw),
    localUpdatedAt: fallbackUpdatedAt,
  };
}

/** Accepts v1 envelopes, per-profile maps, and pre-sync flat settings objects. */
export function parseStoredProfiles(raw: string): StoredProfiles {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') return {};

  const record = parsed as Record<string, unknown>;
  const fallbackUpdatedAt = new Date(0).toISOString();

  const source =
    record.version === ENVELOPE_VERSION &&
    record.profiles &&
    typeof record.profiles === 'object'
      ? (record.profiles as Record<string, unknown>)
      : record;

  if ('phone' in source || 'desktop' in source) {
    const phone = parseDeviceEntry(source.phone, fallbackUpdatedAt);
    const desktop = parseDeviceEntry(source.desktop, fallbackUpdatedAt);
    return {
      ...(phone ? { phone } : {}),
      ...(desktop ? { desktop } : {}),
    };
  }

  const legacy = parseSettings(source);
  const entry: DeviceSettingsEntry = {
    settings: legacy,
    localUpdatedAt: fallbackUpdatedAt,
  };
  return { phone: entry, desktop: entry };
}

export function serializeProfiles(profiles: StoredProfiles): string {
  return JSON.stringify({ version: ENVELOPE_VERSION, profiles });
}

export type RemoteSettingsSnapshot = {
  settings: Settings;
  updatedAt: string;
};

export type SettingsReconcileDecision =
  | { action: 'apply-remote'; settings: Settings; localUpdatedAt: string }
  | { action: 'keep-local'; settings: Settings };

/** Prefer local when it was edited after the server row's updatedAt. */
export function reconcileRemoteSettings(
  local: DeviceSettingsEntry | undefined,
  remote: RemoteSettingsSnapshot
): SettingsReconcileDecision {
  if (local && local.localUpdatedAt > remote.updatedAt) {
    return { action: 'keep-local', settings: local.settings };
  }
  return {
    action: 'apply-remote',
    settings: parseSettings(remote.settings),
    localUpdatedAt: remote.updatedAt,
  };
}

export function withDeviceSettings(
  profiles: StoredProfiles,
  device: SettingsDeviceProfile,
  settings: Settings,
  localUpdatedAt: string
): StoredProfiles {
  return {
    ...profiles,
    [device]: { settings, localUpdatedAt },
  };
}
