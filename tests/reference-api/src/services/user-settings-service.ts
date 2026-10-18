import {
  DEFAULT_USER_SETTINGS,
  mergeUserSettings,
  SettingsDeviceProfile,
  UserSettingsPayload,
  type SettingsDeviceProfile as DeviceProfile,
  type UserSettings,
  type UserSettingsPatch,
} from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { userSettings } from '../db/schema.js';

function parseStoredSettings(raw: unknown): UserSettingsPayload {
  const parsed = UserSettingsPayload.safeParse(raw);
  if (parsed.success) return parsed.data;
  const partial = UserSettingsPayload.partial().safeParse(raw);
  if (!partial.success) return DEFAULT_USER_SETTINGS;
  return mergeUserSettings(DEFAULT_USER_SETTINGS, partial.data);
}

export class UserSettingsService {
  constructor(private readonly db: Database) {}

  async getForUser(userId: string, device: DeviceProfile): Promise<UserSettings> {
    SettingsDeviceProfile.parse(device);
    const [row] = await this.db
      .select({
        settings: userSettings.settings,
        updatedAt: userSettings.updatedAt,
      })
      .from(userSettings)
      .where(and(eq(userSettings.userId, userId), eq(userSettings.device, device)))
      .limit(1);

    if (!row) {
      return {
        device,
        settings: DEFAULT_USER_SETTINGS,
        updatedAt: null,
      };
    }

    return {
      device,
      settings: parseStoredSettings(row.settings),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async upsert(
    userId: string,
    device: DeviceProfile,
    patch: UserSettingsPatch
  ): Promise<UserSettings> {
    SettingsDeviceProfile.parse(device);
    const existing = await this.getForUser(userId, device);
    const settings = mergeUserSettings(existing.settings, patch);
    const updatedAt = new Date();

    await this.db
      .insert(userSettings)
      .values({
        userId,
        device,
        settings,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [userSettings.userId, userSettings.device],
        set: {
          settings,
          updatedAt,
        },
      });

    return {
      device,
      settings,
      updatedAt: updatedAt.toISOString(),
    };
  }
}
