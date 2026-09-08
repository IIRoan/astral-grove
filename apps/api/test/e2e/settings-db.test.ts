import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { UserSettingsResponse } from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { userSettings } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const testEmail = `test-db-settings-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
let cookieHeader = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-settings-%');
  cookieHeader = await signUpTestUser({
    email: testEmail,
    password: testPassword,
    name: 'DB Settings User',
  });

  const sessionRes = await authFetch('/api/auth/get-session', { cookie: cookieHeader });
  const session = await sessionRes.json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-settings-%');
});

describe('user settings database workflows', () => {
  test('GET returns defaults when no row exists', async () => {
    const res = await authFetch('/api/v1/settings/phone', { cookie: cookieHeader });
    expect(res.status).toBe(200);
    const body = UserSettingsResponse.parse(await res.json());
    expect(body.data).toEqual({
      device: 'phone',
      settings: {
        theme: 'dark',
        defaultLayout: 'list',
        gridCardSize: 'large',
      },
      updatedAt: null,
    });
  });

  test('PUT stores phone settings independently from desktop', async () => {
    const phonePut = await authFetch('/api/v1/settings/phone', {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        theme: 'light',
        defaultLayout: 'grid',
        gridCardSize: 'small',
      }),
    });
    expect(phonePut.status).toBe(200);
    const phoneBody = UserSettingsResponse.parse(await phonePut.json());
    expect(phoneBody.data.settings).toEqual({
      theme: 'light',
      defaultLayout: 'grid',
      gridCardSize: 'small',
    });
    expect(phoneBody.data.updatedAt).toBeTruthy();

    const desktopPut = await authFetch('/api/v1/settings/desktop', {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        theme: 'dark',
        defaultLayout: 'list',
        gridCardSize: 'large',
      }),
    });
    expect(desktopPut.status).toBe(200);

    const phoneGet = await authFetch('/api/v1/settings/phone', {
      cookie: cookieHeader,
    });
    const phoneAgain = UserSettingsResponse.parse(await phoneGet.json());
    expect(phoneAgain.data.settings.gridCardSize).toBe('small');
    expect(phoneAgain.data.settings.defaultLayout).toBe('grid');

    const desktopGet = await authFetch('/api/v1/settings/desktop', {
      cookie: cookieHeader,
    });
    const desktopAgain = UserSettingsResponse.parse(await desktopGet.json());
    expect(desktopAgain.data.settings.gridCardSize).toBe('large');
    expect(desktopAgain.data.settings.defaultLayout).toBe('list');

    const { db } = getContext();
    const rows = await db
      .select({
        device: userSettings.device,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    expect(rows.map((row) => row.device).sort()).toEqual(['desktop', 'phone']);
  });

  test('PUT merges partial patches onto existing settings', async () => {
    const res = await authFetch('/api/v1/settings/phone', {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({ gridCardSize: 'medium' }),
    });
    expect(res.status).toBe(200);
    const body = UserSettingsResponse.parse(await res.json());
    expect(body.data.settings).toEqual({
      theme: 'light',
      defaultLayout: 'grid',
      gridCardSize: 'medium',
    });

    const { db } = getContext();
    const [row] = await db
      .select({ settings: userSettings.settings })
      .from(userSettings)
      .where(and(eq(userSettings.userId, userId), eq(userSettings.device, 'phone')));
    expect(row?.settings).toEqual({
      theme: 'light',
      defaultLayout: 'grid',
      gridCardSize: 'medium',
    });
  });

  test('rejects unknown device profiles', async () => {
    const res = await authFetch('/api/v1/settings/tablet', { cookie: cookieHeader });
    expect(res.status).toBe(422);
  });

  test('requires authentication', async () => {
    const res = await authFetch('/api/v1/settings/phone');
    expect(res.status).toBe(401);
  });
});
