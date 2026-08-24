import { expect } from 'bun:test';
import { eq, like, type SQL } from 'drizzle-orm';
import { getBaseUrl, getContext } from '../support.js';
import {
  user as userTable,
  session as sessionTable,
  account as accountTable,
} from '../../../src/db/auth-schema.js';

export function extractCookies(res: Response): string {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
  }
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  return raw
    .split(/,\s*(?=[^;]+?=)/)
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

export async function authFetch(
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

export async function signUpTestUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<string> {
  const res = await authFetch('/api/auth/sign-up/email', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  expect(res.status).toBeLessThan(400);
  const cookie = extractCookies(res);
  expect(cookie).toBeTruthy();
  return cookie;
}

export async function cleanupTestUsers(emailLike: string): Promise<void> {
  try {
    const { db } = getContext();
    const predicate: SQL = like(userTable.email, emailLike);
    const testUsers = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(predicate);
    for (const user of testUsers) {
      await db.delete(sessionTable).where(eq(sessionTable.userId, user.id));
      await db.delete(accountTable).where(eq(accountTable.userId, user.id));
      await db.delete(userTable).where(eq(userTable.id, user.id));
    }
  } catch {}
}
