import type {
  SettingsDeviceProfile,
  UserSettingsPatch,
  UserSettingsPayload,
} from '@riftbound/contracts';
import { UserSettingsResponse } from '@riftbound/contracts';
import { authedFetch, parseOrThrow } from '@/src/api/authedClient';

export async function fetchRemoteSettings(device: SettingsDeviceProfile): Promise<{
  settings: UserSettingsPayload;
  updatedAt: string | null;
}> {
  const res = await authedFetch<unknown>(
    `/api/v1/settings/${encodeURIComponent(device)}`
  );
  const parsed = parseOrThrow('settings.get.parse', UserSettingsResponse, res).data;
  return {
    settings: parsed.settings,
    updatedAt: parsed.updatedAt,
  };
}

export async function putRemoteSettings(
  device: SettingsDeviceProfile,
  patch: UserSettingsPatch
): Promise<UserSettingsPayload> {
  const res = await authedFetch<unknown>(
    `/api/v1/settings/${encodeURIComponent(device)}`,
    {
      method: 'PUT',
      body: patch,
    }
  );
  return parseOrThrow('settings.put.parse', UserSettingsResponse, res).data.settings;
}
