import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { CollectionListResponse } from '@riftbound/contracts';
import { eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionMembers } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const stamp = Date.now();
const password = 'test-password-12345';
let cookie = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-membership-%');
  cookie = await signUpTestUser({
    email: `test-membership-${stamp}@test.riftbound.dev`,
    password,
    name: 'Membership User',
  });

  const session = await (await authFetch('/api/auth/get-session', { cookie })).json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-membership-%');
});

describe('collection membership bootstrap', () => {
  test('first authenticated collection read creates owner membership row', async () => {
    const { db } = getContext();
    const before = await db
      .select({
        collectionId: collectionMembers.collectionId,
        role: collectionMembers.role,
      })
      .from(collectionMembers)
      .where(eq(collectionMembers.userId, userId));
    expect(before).toHaveLength(0);

    const res = await authFetch('/api/v1/collection', { cookie });
    expect(res.status).toBe(200);
    const body = CollectionListResponse.parse(await res.json());
    expect(Array.isArray(body.data)).toBe(true);

    const after = await db
      .select({
        collectionId: collectionMembers.collectionId,
        role: collectionMembers.role,
      })
      .from(collectionMembers)
      .where(eq(collectionMembers.userId, userId));
    expect(after).toHaveLength(1);
    expect(after[0]?.role).toBe('owner');
    expect(after[0]?.collectionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('repeated collection reads reuse the same membership row', async () => {
    const { db } = getContext();
    const [first] = await db
      .select({ collectionId: collectionMembers.collectionId })
      .from(collectionMembers)
      .where(eq(collectionMembers.userId, userId));

    await authFetch('/api/v1/collection/quantities', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ variantNumbers: ['OGN-001'] }),
    });

    const [second] = await db
      .select({ collectionId: collectionMembers.collectionId })
      .from(collectionMembers)
      .where(eq(collectionMembers.userId, userId));

    expect(second?.collectionId).toBe(first?.collectionId);
  });
});
