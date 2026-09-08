import { Elysia } from 'elysia';
import {
  SettingsDeviceProfile,
  UserSettingsResponse,
  UserSettingsUpsertRequest,
} from '@riftbound/contracts';
import type { Auth } from '../auth.js';
import { setApiError, validationErrorResponse } from '../lib/api-error.js';
import { logActionFailure } from '../lib/logger.js';
import { parseRequest } from '../lib/request-validation.js';
import { getSessionUser, unauthorized } from '../lib/session.js';
import type { UserSettingsService } from '../services/user-settings-service.js';

function settingsResponse(
  action: string,
  payload: { device: string; settings: unknown; updatedAt: string | null }
) {
  const parsed = UserSettingsResponse.safeParse({ data: payload });
  if (!parsed.success) {
    logActionFailure(action, parsed.error, { device: payload.device });
    throw new Error('Settings response validation failed');
  }
  return parsed.data;
}

function parseDeviceParam(device: string, set: { status?: unknown }) {
  const parsed = SettingsDeviceProfile.safeParse(device);
  if (!parsed.success) {
    return {
      ok: false as const,
      body: setApiError(
        set,
        validationErrorResponse('device must be phone or desktop')
      ),
    };
  }
  return { ok: true as const, device: parsed.data };
}

export function createSettingsRoutes(settings: UserSettingsService, auth: Auth) {
  return new Elysia({ prefix: '/api/v1/settings' })
    .get(
      '/:device',
      { detail: { tags: ['settings'] } },
      async ({ request, set, params }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const deviceParam = parseDeviceParam(params.device, set);
        if (!deviceParam.ok) return deviceParam.body;
        const result = await settings.getForUser(user.id, deviceParam.device);
        return settingsResponse('settings.get', result);
      }
    )
    .put(
      '/:device',
      { detail: { tags: ['settings'] } },
      async ({ request, set, params, body }) => {
        const user = await getSessionUser(auth, request.headers);
        if (!user) {
          set.status = 401;
          return unauthorized();
        }
        const deviceParam = parseDeviceParam(params.device, set);
        if (!deviceParam.ok) return deviceParam.body;
        const patch = parseRequest(UserSettingsUpsertRequest, body ?? {});
        const result = await settings.upsert(user.id, deviceParam.device, patch);
        return settingsResponse('settings.upsert', result);
      }
    );
}
