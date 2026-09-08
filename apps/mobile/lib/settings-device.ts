import type { SettingsDeviceProfile } from '@riftbound/contracts';

/** Phone = native or narrow web; desktop = wide web shell with side rail. */
export function resolveSettingsDeviceProfile(
  showSideRail: boolean
): SettingsDeviceProfile {
  return showSideRail ? 'desktop' : 'phone';
}
