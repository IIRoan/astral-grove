import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  parseStoredProfiles,
  reconcileRemoteSettings,
  serializeProfiles,
  settingsStorageKey,
  withDeviceSettings,
} from '@/lib/settings-storage';

describe('settingsStorageKey', () => {
  test('scopes signed-in users away from the anon key', () => {
    expect(settingsStorageKey(null)).toBe('riftbound_settings:v1:anon');
    expect(settingsStorageKey('user-a')).toBe('riftbound_settings:v1:user:user-a');
    expect(settingsStorageKey('user-a')).not.toBe(settingsStorageKey('user-b'));
  });
});

describe('parseStoredProfiles', () => {
  test('migrates legacy flat settings into both device profiles', () => {
    const profiles = parseStoredProfiles(
      JSON.stringify({ theme: 'light', defaultLayout: 'grid', gridCardSize: 'small' })
    );
    expect(profiles.phone?.settings.theme).toBe('light');
    expect(profiles.desktop?.settings.gridCardSize).toBe('small');
    expect(profiles.phone?.localUpdatedAt).toBe(new Date(0).toISOString());
  });

  test('round-trips v1 envelopes with dirty timestamps', () => {
    const original = withDeviceSettings(
      {},
      'phone',
      parseSettings({ theme: 'system', defaultLayout: 'list', gridCardSize: 'medium' }),
      '2026-09-08T10:00:00.000Z'
    );
    const parsed = parseStoredProfiles(serializeProfiles(original));
    expect(parsed).toEqual(original);
  });
});

describe('reconcileRemoteSettings', () => {
  test('keeps local when it is newer than the remote row', () => {
    const decision = reconcileRemoteSettings(
      {
        settings: { ...DEFAULT_SETTINGS, theme: 'light' },
        localUpdatedAt: '2026-09-08T12:00:00.000Z',
      },
      {
        settings: { ...DEFAULT_SETTINGS, theme: 'dark' },
        updatedAt: '2026-09-08T11:00:00.000Z',
      }
    );
    expect(decision).toEqual({
      action: 'keep-local',
      settings: { ...DEFAULT_SETTINGS, theme: 'light' },
    });
  });

  test('applies remote when local is missing or older', () => {
    const remote = {
      settings: { ...DEFAULT_SETTINGS, defaultLayout: 'grid' as const },
      updatedAt: '2026-09-08T12:00:00.000Z',
    };
    expect(reconcileRemoteSettings(undefined, remote)).toEqual({
      action: 'apply-remote',
      settings: remote.settings,
      localUpdatedAt: remote.updatedAt,
    });
    expect(
      reconcileRemoteSettings(
        {
          settings: DEFAULT_SETTINGS,
          localUpdatedAt: '2026-09-08T11:00:00.000Z',
        },
        remote
      )
    ).toEqual({
      action: 'apply-remote',
      settings: remote.settings,
      localUpdatedAt: remote.updatedAt,
    });
  });
});
