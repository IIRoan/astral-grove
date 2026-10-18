import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CollectionListResponse,
  CollectionQuantitiesResponse,
  CollectionShareAcceptResponse,
  CollectionShareInviteCreateResponse,
  CollectionShareInvitePreviewResponse,
  CollectionShareLeaveResponse,
  CollectionShareStatusResponse,
  WishlistListResponse,
} from '@riftbound/contracts';
import { eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionMembers } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const password = 'test-password-12345';
const stamp = Date.now();
let cookieA = '';
let cookieB = '';
let userIdA = '';
let userIdB = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-share-%');

  cookieA = await signUpTestUser({
    email: `test-db-share-a-${stamp}@test.riftbound.dev`,
    password,
    name: 'Share User A',
  });
  cookieB = await signUpTestUser({
    email: `test-db-share-b-${stamp}@test.riftbound.dev`,
    password,
    name: 'Share User B',
  });

  const sessionA = await (
    await authFetch('/api/auth/get-session', { cookie: cookieA })
  ).json();
  const sessionB = await (
    await authFetch('/api/auth/get-session', { cookie: cookieB })
  ).json();
  userIdA = sessionA.user.id as string;
  userIdB = sessionB.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-share-%');
});

async function collectionIdForUser(uid: string): Promise<string | null> {
  const { db } = getContext();
  const [row] = await db
    .select({ collectionId: collectionMembers.collectionId })
    .from(collectionMembers)
    .where(eq(collectionMembers.userId, uid))
    .limit(1);
  return row?.collectionId ?? null;
}

describe('shared collection invite flows', () => {
  test('create invite returns a visible deep-link URL and status exposes it', async () => {
    const stampInvite = Date.now();
    const cookie = await signUpTestUser({
      email: `test-db-share-invite-ui-${stampInvite}@test.riftbound.dev`,
      password,
      name: 'Share Invite UI',
    });

    const statusBefore = CollectionShareStatusResponse.parse(
      await (await authFetch('/api/v1/collection/share', { cookie })).json()
    );
    expect(statusBefore.data.shared).toBe(false);
    expect(statusBefore.data.pendingInvite).toBeNull();

    const createRes = await authFetch('/api/v1/collection/share/invite', {
      method: 'POST',
      cookie,
    });
    expect(createRes.status).toBe(200);
    const created = CollectionShareInviteCreateResponse.parse(await createRes.json());

    expect(created.data.token.length).toBeGreaterThan(16);
    expect(created.data.url).toBe(`http://localhost:7001/invite/${created.data.token}`);
    expect(created.data.url).toContain(`/invite/${created.data.token}`);
    expect(Date.parse(created.data.expiresAt)).toBeGreaterThan(Date.now());

    const statusAfter = CollectionShareStatusResponse.parse(
      await (await authFetch('/api/v1/collection/share', { cookie })).json()
    );
    expect(statusAfter.data.pendingInvite).not.toBeNull();
    expect(statusAfter.data.pendingInvite?.expiresAt).toBe(created.data.expiresAt);
    expect(statusAfter.data.pendingInvite?.token).toBeUndefined();
    expect(statusAfter.data.pendingInvite?.url).toBeUndefined();

    const recreate = CollectionShareInviteCreateResponse.parse(
      await (
        await authFetch('/api/v1/collection/share/invite', {
          method: 'POST',
          cookie,
        })
      ).json()
    );
    expect(recreate.data.token).not.toBe(created.data.token);
    expect(recreate.data.url).toContain(recreate.data.token);

    const oldPreview = await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(created.data.token)}`,
      { cookie }
    );
    expect(oldPreview.status).toBe(400);

    const revokeRes = await authFetch('/api/v1/collection/share/invite/revoke', {
      method: 'POST',
      cookie,
    });
    expect(revokeRes.status).toBe(200);

    const statusRevoked = CollectionShareStatusResponse.parse(
      await (await authFetch('/api/v1/collection/share', { cookie })).json()
    );
    expect(statusRevoked.data.pendingInvite).toBeNull();
  });

  test('invite → use_theirs keeps inviter inventory and discards joiner cards', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-201')}/add`, {
      method: 'POST',
      cookie: cookieA,
      body: JSON.stringify({ delta: 2 }),
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-202')}/add`, {
      method: 'POST',
      cookie: cookieB,
      body: JSON.stringify({ delta: 5 }),
    });

    const inviteRes = await authFetch('/api/v1/collection/share/invite', {
      method: 'POST',
      cookie: cookieA,
    });
    expect(inviteRes.status).toBe(200);
    const invite = CollectionShareInviteCreateResponse.parse(await inviteRes.json());
    expect(invite.data.url).toContain(invite.data.token);

    const previewRes = await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}`,
      { cookie: cookieB }
    );
    expect(previewRes.status).toBe(200);
    const preview = CollectionShareInvitePreviewResponse.parse(await previewRes.json());
    expect(preview.data.canAccept).toBe(true);
    expect(preview.data.theirTotalQuantity).toBeGreaterThanOrEqual(2);
    expect(preview.data.yourTotalQuantity).toBeGreaterThanOrEqual(5);

    const acceptRes = await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}/accept`,
      {
        method: 'POST',
        cookie: cookieB,
        body: JSON.stringify({ mode: 'use_theirs' }),
      }
    );
    expect(acceptRes.status).toBe(200);
    const accepted = CollectionShareAcceptResponse.parse(await acceptRes.json());
    expect(accepted.data.shared).toBe(true);
    expect(accepted.data.partner?.userId).toBe(userIdA);

    const listB = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie: cookieB })).json()
    );
    expect(listB.data.some((i) => i.variantNumber === 'OGN-201')).toBe(true);
    expect(listB.data.some((i) => i.variantNumber === 'OGN-202')).toBe(false);

    const collectionIdA = await collectionIdForUser(userIdA);
    const collectionIdB = await collectionIdForUser(userIdB);
    expect(collectionIdA).toBe(collectionIdB);

    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-203')}/add`, {
      method: 'POST',
      cookie: cookieB,
      body: JSON.stringify({ delta: 1 }),
    });
    const listA = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie: cookieA })).json()
    );
    expect(listA.data.some((i) => i.variantNumber === 'OGN-203')).toBe(true);
  });

  test('merge sums overlapping stacks; decks and wishlist stay personal', async () => {
    // Leave prior shared state; create a third pair for merge to avoid interference.
    const stamp2 = Date.now();
    const cookieC = await signUpTestUser({
      email: `test-db-share-c-${stamp2}@test.riftbound.dev`,
      password,
      name: 'Share User C',
    });
    const cookieD = await signUpTestUser({
      email: `test-db-share-d-${stamp2}@test.riftbound.dev`,
      password,
      name: 'Share User D',
    });

    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-210')}/add`, {
      method: 'POST',
      cookie: cookieC,
      body: JSON.stringify({ delta: 2 }),
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-210')}/add`, {
      method: 'POST',
      cookie: cookieD,
      body: JSON.stringify({ delta: 3 }),
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-211')}/add`, {
      method: 'POST',
      cookie: cookieD,
      body: JSON.stringify({ delta: 1 }),
    });

    await authFetch(`/api/v1/wishlist/${encodeURIComponent('OGN-210')}`, {
      method: 'PUT',
      cookie: cookieD,
      body: JSON.stringify({ priority: 1 }),
    });

    const invite = CollectionShareInviteCreateResponse.parse(
      await (
        await authFetch('/api/v1/collection/share/invite', {
          method: 'POST',
          cookie: cookieC,
        })
      ).json()
    );

    const acceptRes = await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}/accept`,
      {
        method: 'POST',
        cookie: cookieD,
        body: JSON.stringify({ mode: 'merge' }),
      }
    );
    expect(acceptRes.status).toBe(200);

    const quantities = CollectionQuantitiesResponse.parse(
      await (
        await authFetch('/api/v1/collection/quantities', {
          method: 'POST',
          cookie: cookieC,
          body: JSON.stringify({ variantNumbers: ['OGN-210', 'OGN-211'] }),
        })
      ).json()
    );
    expect(quantities.data).toEqual(
      expect.arrayContaining([
        { variantNumber: 'OGN-210', isFoil: false, quantity: 5 },
        { variantNumber: 'OGN-211', isFoil: false, quantity: 1 },
      ])
    );

    const wishlist = WishlistListResponse.parse(
      await (await authFetch('/api/v1/wishlist', { cookie: cookieD })).json()
    );
    expect(wishlist.data.some((i) => i.variantNumber === 'OGN-210')).toBe(true);

    const wishlistC = WishlistListResponse.parse(
      await (await authFetch('/api/v1/wishlist', { cookie: cookieC })).json()
    );
    expect(wishlistC.data.some((i) => i.variantNumber === 'OGN-210')).toBe(false);
  });

  test('leave starts an empty personal collection and leaves shared inventory behind', async () => {
    const stamp3 = Date.now();
    const cookieE = await signUpTestUser({
      email: `test-db-share-e-${stamp3}@test.riftbound.dev`,
      password,
      name: 'Share User E',
    });
    const cookieF = await signUpTestUser({
      email: `test-db-share-f-${stamp3}@test.riftbound.dev`,
      password,
      name: 'Share User F',
    });

    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-220')}/add`, {
      method: 'POST',
      cookie: cookieE,
      body: JSON.stringify({ delta: 4 }),
    });

    const invite = CollectionShareInviteCreateResponse.parse(
      await (
        await authFetch('/api/v1/collection/share/invite', {
          method: 'POST',
          cookie: cookieE,
        })
      ).json()
    );

    await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}/accept`,
      {
        method: 'POST',
        cookie: cookieF,
        body: JSON.stringify({ mode: 'use_theirs' }),
      }
    );

    const leaveRes = await authFetch('/api/v1/collection/share/leave', {
      method: 'POST',
      cookie: cookieF,
    });
    expect(leaveRes.status).toBe(200);
    const left = CollectionShareLeaveResponse.parse(await leaveRes.json());
    expect(left.data.shared).toBe(false);
    expect(left.data.partner).toBeNull();

    const listF = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie: cookieF })).json()
    );
    expect(listF.data.some((i) => i.variantNumber === 'OGN-220')).toBe(false);

    const sessionF = await (
      await authFetch('/api/auth/get-session', { cookie: cookieF })
    ).json();
    const sessionE = await (
      await authFetch('/api/auth/get-session', { cookie: cookieE })
    ).json();
    const idE = await collectionIdForUser(sessionE.user.id as string);
    const idF = await collectionIdForUser(sessionF.user.id as string);
    expect(idE).not.toBe(idF);

    const listE = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie: cookieE })).json()
    );
    expect(
      listE.data.some((i) => i.variantNumber === 'OGN-220' && i.quantity === 4)
    ).toBe(true);

    const statusE = CollectionShareStatusResponse.parse(
      await (await authFetch('/api/v1/collection/share', { cookie: cookieE })).json()
    );
    expect(statusE.data.shared).toBe(false);
  });

  test('rejects self-accept and third member', async () => {
    const stamp4 = Date.now();
    const cookieG = await signUpTestUser({
      email: `test-db-share-g-${stamp4}@test.riftbound.dev`,
      password,
      name: 'Share User G',
    });
    const cookieH = await signUpTestUser({
      email: `test-db-share-h-${stamp4}@test.riftbound.dev`,
      password,
      name: 'Share User H',
    });
    const cookieI = await signUpTestUser({
      email: `test-db-share-i-${stamp4}@test.riftbound.dev`,
      password,
      name: 'Share User I',
    });

    const invite = CollectionShareInviteCreateResponse.parse(
      await (
        await authFetch('/api/v1/collection/share/invite', {
          method: 'POST',
          cookie: cookieG,
        })
      ).json()
    );

    const selfPreviewRes = await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}`,
      { cookie: cookieG }
    );
    expect(selfPreviewRes.status).toBe(200);
    const selfPreview = CollectionShareInvitePreviewResponse.parse(
      await selfPreviewRes.json()
    );
    expect(selfPreview.data.canAccept).toBe(false);
    expect(selfPreview.data.reason).toMatch(/own invite/i);

    const selfAccept = await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}/accept`,
      {
        method: 'POST',
        cookie: cookieG,
        body: JSON.stringify({ mode: 'merge' }),
      }
    );
    expect(selfAccept.status).toBe(400);
    const selfAcceptBody = (await selfAccept.json()) as { message?: string };
    expect(selfAcceptBody.message ?? '').toMatch(/own invite/i);

    await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}/accept`,
      {
        method: 'POST',
        cookie: cookieH,
        body: JSON.stringify({ mode: 'merge' }),
      }
    );

    const inviteWhileShared = await authFetch('/api/v1/collection/share/invite', {
      method: 'POST',
      cookie: cookieG,
    });
    expect(inviteWhileShared.status).toBe(409);

    const third = await authFetch(
      `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}/accept`,
      {
        method: 'POST',
        cookie: cookieI,
        body: JSON.stringify({ mode: 'merge' }),
      }
    );
    expect([400, 404, 409]).toContain(third.status);
  });
});
