import { describe, expect, test } from 'bun:test';
import { resolveSettingsDeviceProfile } from '@/lib/settings-device';

describe('resolveSettingsDeviceProfile', () => {
  test('maps side rail to desktop and mobile layout to phone', () => {
    expect(resolveSettingsDeviceProfile(true)).toBe('desktop');
    expect(resolveSettingsDeviceProfile(false)).toBe('phone');
  });
});
