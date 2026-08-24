import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CollectionItemResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
  CollectionShareAcceptResponse,
  CollectionShareInviteCreateResponse,
  CollectionShareStatusResponse,
} from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionItems, collectionMembers } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const password = 'test-password-12345';
const stamp = Date.now();
let cookieOwner = '';
let cookiePartner = '';
let ownerId = '';
let partnerId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-share-mut-%');
  cookieOwner = await signUpTestUser({
    email: `test-db-share-mut-owner-${stamp}@test.riftbound.dev`,
    password,
    name: 'Share Mut Owner',
  });
  cookiePartner = await signUpTestUser({
    email: `test-db-share-mut-partner-${stamp}@test.riftbound.dev`,
    password,
    name: 'Share Mut Partner',
  });
  const sessionOwner = await (
    await authFetch('/api/auth/get-session', { cookie: cookieOwner })
  ).json();
  const sessionPartner = await (
    await authFetch('/api/auth/get-session', { cookie: cookiePartner })
  ).json();
  ownerId = sessionOwner.user.id as string;
  partnerId = sessionPartner.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-share-mut-%');
});

async function collectionIdForUser(uid: string): Promise<string> {
  const { db } = getContext();
  const [row] = await db
    .select({ collectionId: collectionMembers.collectionId })
    .from(collectionMembers)
    .where(eq(collectionMembers.userId, uid))
    .limit(1);
  if (!row) throw new Error(`No collection membership for ${uid}`);
  return row.collectionId;
}

async function quantitiesFor(
  cookie: string,
  variantNumbers: string[]
): Promise<Map<string, number>> {
  const res = await authFetch('/api/v1/collection/quantities', {
    method: 'POST',
    cookie,
    body: JSON.stringify({ variantNumbers }),
  });
  const parsed = CollectionQuantitiesResponse.parse(await res.json());
  return new Map(parsed.data.map((row) => [row.variantNumber, row.quantity]));
}

async function pairCollections(): Promise<void> {
  const invite = CollectionShareInviteCreateResponse.parse(
    await (
      await authFetch('/api/v1/collection/share/invite', {
        method: 'POST',
        cookie: cookieOwner,
      })
    ).json()
  );
  const accept = await authFetch(
    `/api/v1/collection/share/invite/${encodeURIComponent(invite.data.token)}/accept`,
    {
      method: 'POST',
      cookie: cookiePartner,
      body: JSON.stringify({ mode: 'merge' }),
    }
  );
  expect(accept.status).toBe(200);
  CollectionShareAcceptResponse.parse(await accept.json());
}

describe('shared collection add/remove mutations', () => {
  test('both members see each other add, remove, put, and delete on the same inventory', async () => {
    await pairCollections();

    const sharedIdOwner = await collectionIdForUser(ownerId);
    const sharedIdPartner = await collectionIdForUser(partnerId);
    expect(sharedIdOwner).toBe(sharedIdPartner);

    const addByPartner = await authFetch('/api/v1/collection/OGN-308/add', {
      method: 'POST',
      cookie: cookiePartner,
      body: JSON.stringify({ delta: 2 }),
    });
    expect(addByPartner.status).toBe(200);
    expect(CollectionItemResponse.parse(await addByPartner.json()).data?.quantity).toBe(
      2
    );

    const ownerSeesAdd = await quantitiesFor(cookieOwner, ['OGN-308']);
    expect(ownerSeesAdd.get('OGN-308')).toBe(2);

    const addByOwner = await authFetch('/api/v1/collection/OGN-308/add', {
      method: 'POST',
      cookie: cookieOwner,
      body: JSON.stringify({ delta: 3 }),
    });
    expect(addByOwner.status).toBe(200);
    expect(CollectionItemResponse.parse(await addByOwner.json()).data?.quantity).toBe(
      5
    );

    const partnerSeesSum = await quantitiesFor(cookiePartner, ['OGN-308']);
    expect(partnerSeesSum.get('OGN-308')).toBe(5);

    const removeByPartner = await authFetch('/api/v1/collection/OGN-308/remove', {
      method: 'POST',
      cookie: cookiePartner,
      body: JSON.stringify({ delta: 2 }),
    });
    expect(removeByPartner.status).toBe(200);
    expect(
      CollectionItemResponse.parse(await removeByPartner.json()).data?.quantity
    ).toBe(3);

    const ownerSeesRemove = await quantitiesFor(cookieOwner, ['OGN-308']);
    expect(ownerSeesRemove.get('OGN-308')).toBe(3);

    const putByOwner = await authFetch('/api/v1/collection/OGN-309', {
      method: 'PUT',
      cookie: cookieOwner,
      body: JSON.stringify({ variantNumber: 'OGN-309', quantity: 7 }),
    });
    expect(putByOwner.status).toBe(200);

    const partnerList = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie: cookiePartner })).json()
    );
    expect(
      partnerList.data.some(
        (item) => item.variantNumber === 'OGN-309' && item.quantity === 7
      )
    ).toBe(true);

    const deleteByPartner = await authFetch('/api/v1/collection/OGN-309', {
      method: 'DELETE',
      cookie: cookiePartner,
    });
    expect(deleteByPartner.status).toBe(200);

    const ownerAfterDelete = await quantitiesFor(cookieOwner, ['OGN-309']);
    expect(ownerAfterDelete.get('OGN-309')).toBe(0);

    const { db } = getContext();
    const rows = await db
      .select({
        variantNumber: collectionItems.variantNumber,
        quantity: collectionItems.quantity,
      })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, sharedIdOwner),
          eq(collectionItems.variantNumber, 'OGN-308')
        )
      );
    expect(rows).toEqual([{ variantNumber: 'OGN-308', quantity: 3 }]);
  });

  test('concurrent adds from both members both apply when the stack is missing', async () => {
    let status = CollectionShareStatusResponse.parse(
      await (
        await authFetch('/api/v1/collection/share', { cookie: cookieOwner })
      ).json()
    );
    if (!status.data.shared) {
      await pairCollections();
    }

    const variantNumber = 'OGN-310';
    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}`, {
      method: 'DELETE',
      cookie: cookieOwner,
    });
    expect((await quantitiesFor(cookieOwner, [variantNumber])).get(variantNumber)).toBe(
      0
    );

    const [ownerRes, partnerRes] = await Promise.all([
      authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
        method: 'POST',
        cookie: cookieOwner,
        body: JSON.stringify({ delta: 1 }),
      }),
      authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
        method: 'POST',
        cookie: cookiePartner,
        body: JSON.stringify({ delta: 1 }),
      }),
    ]);
    expect(ownerRes.status).toBe(200);
    expect(partnerRes.status).toBe(200);

    const finalQty = (await quantitiesFor(cookieOwner, [variantNumber])).get(
      variantNumber
    );
    expect(finalQty).toBe(2);
  });

  test('concurrent adds from both members both apply when the stack already exists', async () => {
    let status = CollectionShareStatusResponse.parse(
      await (
        await authFetch('/api/v1/collection/share', { cookie: cookieOwner })
      ).json()
    );
    if (!status.data.shared) {
      await pairCollections();
    }

    const variantNumber = 'OGN-307';
    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieOwner,
      body: JSON.stringify({ variantNumber, quantity: 5 }),
    });
    expect((await quantitiesFor(cookieOwner, [variantNumber])).get(variantNumber)).toBe(
      5
    );

    const [ownerRes, partnerRes] = await Promise.all([
      authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
        method: 'POST',
        cookie: cookieOwner,
        body: JSON.stringify({ delta: 1 }),
      }),
      authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
        method: 'POST',
        cookie: cookiePartner,
        body: JSON.stringify({ delta: 1 }),
      }),
    ]);
    expect(ownerRes.status).toBe(200);
    expect(partnerRes.status).toBe(200);

    const finalQty = (await quantitiesFor(cookieOwner, [variantNumber])).get(
      variantNumber
    );
    expect(finalQty).toBe(7);
  });

  test('concurrent removes from both members both apply', async () => {
    let status = CollectionShareStatusResponse.parse(
      await (
        await authFetch('/api/v1/collection/share', { cookie: cookieOwner })
      ).json()
    );
    if (!status.data.shared) {
      await pairCollections();
    }

    const variantNumber = 'OGN-306';
    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieOwner,
      body: JSON.stringify({ variantNumber, quantity: 5 }),
    });
    expect((await quantitiesFor(cookieOwner, [variantNumber])).get(variantNumber)).toBe(
      5
    );

    const [ownerRes, partnerRes] = await Promise.all([
      authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`, {
        method: 'POST',
        cookie: cookieOwner,
        body: JSON.stringify({ delta: 1 }),
      }),
      authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`, {
        method: 'POST',
        cookie: cookiePartner,
        body: JSON.stringify({ delta: 1 }),
      }),
    ]);
    expect(ownerRes.status).toBe(200);
    expect(partnerRes.status).toBe(200);

    const finalQty = (await quantitiesFor(cookieOwner, [variantNumber])).get(
      variantNumber
    );
    expect(finalQty).toBe(3);
  });

  test('after leave, partner mutations no longer affect the remaining member', async () => {
    let status = CollectionShareStatusResponse.parse(
      await (
        await authFetch('/api/v1/collection/share', { cookie: cookieOwner })
      ).json()
    );
    if (!status.data.shared) {
      await pairCollections();
      status = CollectionShareStatusResponse.parse(
        await (
          await authFetch('/api/v1/collection/share', { cookie: cookieOwner })
        ).json()
      );
    }
    expect(status.data.shared).toBe(true);

    await authFetch('/api/v1/collection/OGN-295', {
      method: 'PUT',
      cookie: cookieOwner,
      body: JSON.stringify({ variantNumber: 'OGN-295', quantity: 4 }),
    });

    const leaveRes = await authFetch('/api/v1/collection/share/leave', {
      method: 'POST',
      cookie: cookiePartner,
    });
    expect(leaveRes.status).toBe(200);

    const ownerCollectionId = await collectionIdForUser(ownerId);
    const partnerCollectionId = await collectionIdForUser(partnerId);
    expect(ownerCollectionId).not.toBe(partnerCollectionId);

    await authFetch('/api/v1/collection/OGN-295/add', {
      method: 'POST',
      cookie: cookiePartner,
      body: JSON.stringify({ delta: 10 }),
    });

    const partnerQty = await quantitiesFor(cookiePartner, ['OGN-295']);
    expect(partnerQty.get('OGN-295')).toBe(10);

    const ownerQty = await quantitiesFor(cookieOwner, ['OGN-295']);
    expect(ownerQty.get('OGN-295')).toBe(4);

    await authFetch('/api/v1/collection/OGN-295/remove', {
      method: 'POST',
      cookie: cookieOwner,
      body: JSON.stringify({ delta: 4 }),
    });
    expect((await quantitiesFor(cookieOwner, ['OGN-295'])).get('OGN-295')).toBe(0);
    expect((await quantitiesFor(cookiePartner, ['OGN-295'])).get('OGN-295')).toBe(10);
  });
});
