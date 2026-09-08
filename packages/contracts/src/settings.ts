import { z } from 'zod';
import { dataResponse, IsoDateTimeString } from './common.js';

export const SettingsDeviceProfile = z.enum(['phone', 'desktop']);
export type SettingsDeviceProfile = z.infer<typeof SettingsDeviceProfile>;

export const ThemePreference = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof ThemePreference>;

export const CatalogLayout = z.enum(['grid', 'list']);
export type CatalogLayout = z.infer<typeof CatalogLayout>;

export const GridCardSize = z.enum(['large', 'medium', 'small']);
export type GridCardSize = z.infer<typeof GridCardSize>;

export const UserSettingsPayload = z.object({
  theme: ThemePreference,
  accentColor: z.string().min(1).max(32).optional(),
  defaultLayout: CatalogLayout,
  gridCardSize: GridCardSize,
});
export type UserSettingsPayload = z.infer<typeof UserSettingsPayload>;

export const DEFAULT_USER_SETTINGS: UserSettingsPayload = {
  theme: 'dark',
  defaultLayout: 'list',
  gridCardSize: 'large',
};

export const UserSettingsPatch = UserSettingsPayload.partial();
export type UserSettingsPatch = z.infer<typeof UserSettingsPatch>;

export function mergeUserSettings(
  base: UserSettingsPayload,
  patch: UserSettingsPatch
): UserSettingsPayload {
  return UserSettingsPayload.parse({ ...base, ...patch });
}

export const UserSettings = z.object({
  device: SettingsDeviceProfile,
  settings: UserSettingsPayload,
  updatedAt: IsoDateTimeString.nullable(),
});
export type UserSettings = z.infer<typeof UserSettings>;

export const UserSettingsResponse = dataResponse(UserSettings);
export type UserSettingsResponse = z.infer<typeof UserSettingsResponse>;

export const UserSettingsUpsertRequest = UserSettingsPatch;
export type UserSettingsUpsertRequest = z.infer<typeof UserSettingsUpsertRequest>;
