import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { eq, like } from 'drizzle-orm';
import { getBaseUrl, apiFetch, getContext } from './support.js';
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
} from '../../src/db/auth-schema.js';

setDefaultTimeout(60_000);

let cookieHeader = '';
let testEmail: string;
const testPassword = 'test-password-12345';
const testName = 'Test User';

function extractCookies(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    return setCookies.map((c) => c.split(';')[0]).join('; ');
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,\s*(?=[^;]+?=)/)
    .map((c) => c.split(';')[0])
    .join('; ');
}

async function authFetch(
  path: string,
  init?: RequestInit & { cookie?: string }
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.cookie) {
    headers.set('cookie', init.cookie);
  }
  if (!headers.has('origin')) {
    headers.set('origin', getBaseUrl());
  }
  if (init?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return fetch(`${getBaseUrl()}${path}`, { ...init, headers });
}

async function cleanupTestUsers(): Promise<void> {
  try {
    const { db } = getContext();
    const testUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(like(userTable.email, 'test-auth-%'));
    for (const u of testUsers) {
      await db.delete(sessionTable).where(eq(sessionTable.userId, u.id));
      await db.delete(accountTable).where(eq(accountTable.userId, u.id));
      await db.delete(userTable).where(eq(userTable.id, u.id));
    }
  } catch {}
}

beforeAll(async () => {
  testEmail = `test-auth-${Date.now()}@test.riftbound.dev`;
  await cleanupTestUsers();
});

afterAll(async () => {
  await cleanupTestUsers();
});

describe('auth: sign-up', () => {
  test('POST /api/auth/sign-up/email creates a user and sets session cookie', async () => {
    const res = await authFetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });

    expect(res.status).toBeLessThan(400);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body.user).toHaveProperty('email', testEmail);
    expect(body.user).toHaveProperty('name', testName);

    cookieHeader = extractCookies(res);
    expect(cookieHeader).toBeTruthy();
    expect(cookieHeader).toContain('better-auth');
  });

  test('POST /api/auth/sign-up/email rejects duplicate email', async () => {
    const res = await authFetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: 'Duplicate',
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/auth/sign-up/email rejects short password', async () => {
    const res = await authFetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({
        email: `test-short-${Date.now()}@test.riftbound.dev`,
        password: 'short',
        name: 'Short Pw',
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('auth: session', () => {
  test('GET /api/auth/get-session returns the session when cookie is present', async () => {
    const res = await authFetch('/api/auth/get-session', {
      cookie: cookieHeader,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(testEmail);
    expect(body).toHaveProperty('session');
    expect(body.session).toHaveProperty('userId');
  });

  test('GET /api/auth/get-session returns null without cookie', async () => {
    const res = await authFetch('/api/auth/get-session');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });
});

describe('auth: sign-in', () => {
  test('POST /api/auth/sign-in/email authenticates and sets session cookie', async () => {
    const res = await authFetch('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    expect(res.status).toBeLessThan(400);
    const body = await res.json();
    expect(body).toHaveProperty('user');
    expect(body.user.email).toBe(testEmail);

    const newCookie = extractCookies(res);
    expect(newCookie).toBeTruthy();
    cookieHeader = newCookie || cookieHeader;
  });

  test('POST /api/auth/sign-in/email rejects wrong password', async () => {
    const res = await authFetch('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        password: 'wrong-password-xyz',
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/auth/sign-in/email rejects non-existent email', async () => {
    const res = await authFetch('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@test.riftbound.dev',
        password: testPassword,
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('auth: protected routes require session', () => {
  test('GET /api/v1/collection returns 401 without auth', async () => {
    const res = await apiFetch('/api/v1/collection');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/collection succeeds with session cookie', async () => {
    const res = await authFetch('/api/v1/collection', {
      cookie: cookieHeader,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/v1/wishlist returns 401 without auth', async () => {
    const res = await apiFetch('/api/v1/wishlist');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/wishlist succeeds with session cookie', async () => {
    const res = await authFetch('/api/v1/wishlist', {
      cookie: cookieHeader,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('auth: sign-out', () => {
  test('POST /api/auth/sign-out clears the session', async () => {
    const res = await authFetch('/api/auth/sign-out', {
      method: 'POST',
      cookie: cookieHeader,
    });

    expect(res.status).toBeLessThan(400);

    const sessionRes = await authFetch('/api/auth/get-session', {
      cookie: cookieHeader,
    });

    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody).toBeNull();
  });
});
