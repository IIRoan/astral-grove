import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  SettingsDeviceProfile,
  UserSettingsPayload,
  UserSettingsUpsertRequest,
} from './settings.js';

describe('settings contracts', () => {
  test('defaults parse as a full payload', () => {
    expect(UserSettingsPayload.parse(DEFAULT_USER_SETTINGS)).toEqual({
      theme: 'dark',
      defaultLayout: 'list',
      gridCardSize: 'large',
    });
  });

  test('device profiles are phone or desktop', () => {
    expect(SettingsDeviceProfile.parse('phone')).toBe('phone');
    expect(SettingsDeviceProfile.parse('desktop')).toBe('desktop');
    expect(() => SettingsDeviceProfile.parse('tablet')).toThrow();
  });

  test('mergeUserSettings overlays patch fields', () => {
    expect(
      mergeUserSettings(DEFAULT_USER_SETTINGS, {
        gridCardSize: 'small',
        defaultLayout: 'grid',
      })
    ).toEqual({
      theme: 'dark',
      defaultLayout: 'grid',
      gridCardSize: 'small',
    });
  });

  test('upsert request allows partial patches', () => {
    expect(UserSettingsUpsertRequest.parse({ theme: 'light' })).toEqual({
      theme: 'light',
    });
  });
});
