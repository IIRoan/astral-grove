import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { WishlistListResponse, WishlistItemResponse } from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { wishlistItems } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const testEmail = `test-db-wishlist-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
let cookieHeader = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-wishlist-%');
  cookieHeader = await signUpTestUser({
    email: testEmail,
    password: testPassword,
    name: 'DB Wishlist User',
  });

  const sessionRes = await authFetch('/api/auth/get-session', { cookie: cookieHeader });
  const session = await sessionRes.json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-wishlist-%');
});

describe('wishlist database workflows', () => {
  test('PUT /wishlist creates a row in Postgres with card metadata joins', async () => {
    const variantNumber = 'OGN-001';

    const putRes = await authFetch(
      `/api/v1/wishlist/${encodeURIComponent(variantNumber)}`,
      {
        method: 'PUT',
        cookie: cookieHeader,
        body: JSON.stringify({
          variantNumber,
          priority: 2,
          targetPriceCents: 199,
          notes: 'Need for deck',
        }),
      }
    );
    expect(putRes.status).toBe(200);
    const body = WishlistItemResponse.parse(await putRes.json());
    expect(body.data.variantNumber).toBe(variantNumber);
    expect(body.data.name).toBeTruthy();
    expect(body.data.setCode).toBeTruthy();

    const { db } = getContext();
    const [row] = await db
      .select({
        variantNumber: wishlistItems.variantNumber,
        priority: wishlistItems.priority,
        targetPriceCents: wishlistItems.targetPriceCents,
        notes: wishlistItems.notes,
      })
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.userId, userId),
          eq(wishlistItems.variantNumber, variantNumber)
        )
      );

    expect(row).toEqual({
      variantNumber,
      priority: 2,
      targetPriceCents: 199,
      notes: 'Need for deck',
    });
  });

  test('PUT /wishlist updates the existing row instead of inserting a duplicate', async () => {
    const variantNumber = 'OGN-002';

    await authFetch(`/api/v1/wishlist/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({ variantNumber, priority: 1, notes: 'first' }),
    });

    await authFetch(`/api/v1/wishlist/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        variantNumber,
        priority: 3,
        targetPriceCents: 50,
        notes: 'updated',
      }),
    });

    const { db } = getContext();
    const rows = await db
      .select({
        priority: wishlistItems.priority,
        targetPriceCents: wishlistItems.targetPriceCents,
        notes: wishlistItems.notes,
      })
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.userId, userId),
          eq(wishlistItems.variantNumber, variantNumber)
        )
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      priority: 3,
      targetPriceCents: 50,
      notes: 'updated',
    });
  });

  test('GET /wishlist list matches the number of persisted rows', async () => {
    const variants = ['OGN-003', 'OGN-004', 'OGN-005'];
    for (const [index, variantNumber] of variants.entries()) {
      await authFetch(`/api/v1/wishlist/${encodeURIComponent(variantNumber)}`, {
        method: 'PUT',
        cookie: cookieHeader,
        body: JSON.stringify({ variantNumber, priority: index }),
      });
    }

    const listRes = await authFetch('/api/v1/wishlist', { cookie: cookieHeader });
    const list = WishlistListResponse.parse(await listRes.json());

    const { db } = getContext();
    const rows = await db
      .select({ variantNumber: wishlistItems.variantNumber })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    expect(list.meta.total).toBe(rows.length);
    expect(rows.map((row) => row.variantNumber)).toEqual(
      expect.arrayContaining(variants)
    );
  });

  test('DELETE /wishlist/:variantNumber removes the database row', async () => {
    const variantNumber = 'OGN-006';

    await authFetch(`/api/v1/wishlist/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({ variantNumber, priority: 1 }),
    });

    const deleteRes = await authFetch(
      `/api/v1/wishlist/${encodeURIComponent(variantNumber)}`,
      {
        method: 'DELETE',
        cookie: cookieHeader,
      }
    );
    expect(deleteRes.status).toBe(200);

    const { db } = getContext();
    const rows = await db
      .select({ variantNumber: wishlistItems.variantNumber })
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.userId, userId),
          eq(wishlistItems.variantNumber, variantNumber)
        )
      );
    expect(rows).toHaveLength(0);

    const listRes = await authFetch('/api/v1/wishlist', { cookie: cookieHeader });
    const list = WishlistListResponse.parse(await listRes.json());
    expect(list.data.some((item) => item.variantNumber === variantNumber)).toBe(false);
  });
});
