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
} from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionItems, collectionMembers } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const stamp = Date.now();
const password = 'test-password-12345';
let cookie = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-coll-mut-%');
  cookie = await signUpTestUser({
    email: `test-db-coll-mut-${stamp}@test.riftbound.dev`,
    password,
    name: 'Collection Mutations User',
  });
  const session = await (await authFetch('/api/auth/get-session', { cookie })).json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-coll-mut-%');
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

async function qty(variantNumber: string): Promise<number> {
  const res = await authFetch('/api/v1/collection/quantities', {
    method: 'POST',
    cookie,
    body: JSON.stringify({ variantNumbers: [variantNumber] }),
  });
  const parsed = CollectionQuantitiesResponse.parse(await res.json());
  return parsed.data[0]?.quantity ?? -1;
}

async function dbStack(
  variantNumber: string,
  condition = 'near_mint',
  language = 'en'
): Promise<{ quantity: number } | undefined> {
  const { db } = getContext();
  const collectionId = await collectionIdForUser(userId);
  const [row] = await db
    .select({ quantity: collectionItems.quantity })
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.variantNumber, variantNumber),
        eq(collectionItems.condition, condition),
        eq(collectionItems.language, language)
      )
    )
    .limit(1);
  return row;
}

describe('collection add/remove mutations', () => {
  test('rejects unauthenticated add and remove', async () => {
    const addRes = await authFetch('/api/v1/collection/OGN-301/add', {
      method: 'POST',
      body: JSON.stringify({ delta: 1 }),
    });
    expect(addRes.status).toBe(401);

    const removeRes = await authFetch('/api/v1/collection/OGN-301/remove', {
      method: 'POST',
      body: JSON.stringify({ delta: 1 }),
    });
    expect(removeRes.status).toBe(401);
  });

  test('add defaults to delta 1 and returns the updated item', async () => {
    const variantNumber = 'OGN-301';
    const addRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({}),
      }
    );
    expect(addRes.status).toBe(200);
    const body = CollectionItemResponse.parse(await addRes.json());
    expect(body.data?.variantNumber).toBe(variantNumber);
    expect(body.data?.quantity).toBe(1);
    expect(await qty(variantNumber)).toBe(1);
    expect((await dbStack(variantNumber))?.quantity).toBe(1);
  });

  test('repeated adds accumulate quantity', async () => {
    const variantNumber = 'OGN-302';
    for (const delta of [1, 2, 3]) {
      const res = await authFetch(
        `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
        {
          method: 'POST',
          cookie,
          body: JSON.stringify({ delta }),
        }
      );
      expect(res.status).toBe(200);
    }
    expect(await qty(variantNumber)).toBe(6);
    expect((await dbStack(variantNumber))?.quantity).toBe(6);
  });

  test('remove decrements and over-remove deletes the stack', async () => {
    const variantNumber = 'OGN-303';
    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ delta: 2 }),
    });

    const removeOne = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(removeOne.status).toBe(200);
    const afterOne = CollectionItemResponse.parse(await removeOne.json());
    expect(afterOne.data?.quantity).toBe(1);

    const overRemove = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 5 }),
      }
    );
    expect(overRemove.status).toBe(200);
    const afterOver = await overRemove.json();
    expect(afterOver).toEqual({ data: null });
    expect(await qty(variantNumber)).toBe(0);
    expect(await dbStack(variantNumber)).toBeUndefined();
  });

  test('remove on missing stack is a no-op that returns null', async () => {
    const variantNumber = 'OGN-304';
    const res = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: null });
    expect(await qty(variantNumber)).toBe(0);
  });

  test('PUT sets absolute quantity and list reflects it', async () => {
    const variantNumber = 'OGN-305';
    const putRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}`,
      {
        method: 'PUT',
        cookie,
        body: JSON.stringify({ variantNumber, quantity: 4 }),
      }
    );
    expect(putRes.status).toBe(200);
    const putBody = CollectionItemResponse.parse(await putRes.json());
    expect(putBody.data?.quantity).toBe(4);

    const list = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie })).json()
    );
    expect(
      list.data.some(
        (item) => item.variantNumber === variantNumber && item.quantity === 4
      )
    ).toBe(true);
    expect(list.meta.totalQuantity).toBeGreaterThanOrEqual(4);

    const zeroRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}`,
      {
        method: 'PUT',
        cookie,
        body: JSON.stringify({ variantNumber, quantity: 0 }),
      }
    );
    expect(zeroRes.status).toBe(200);
    expect(await zeroRes.json()).toEqual({ data: null });
    expect(await qty(variantNumber)).toBe(0);
  });

  test('add/remove with condition and language only touch that stack', async () => {
    const variantNumber = 'OGN-306';

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ delta: 2, condition: 'near_mint', language: 'en' }),
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ delta: 3, condition: 'lightly_played', language: 'en' }),
    });

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ delta: 1, condition: 'near_mint', language: 'en' }),
    });

    expect((await dbStack(variantNumber, 'near_mint', 'en'))?.quantity).toBe(1);
    expect((await dbStack(variantNumber, 'lightly_played', 'en'))?.quantity).toBe(3);

    const delRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}?condition=lightly_played&language=en`,
      { method: 'DELETE', cookie }
    );
    expect(delRes.status).toBe(200);
    expect(await dbStack(variantNumber, 'lightly_played', 'en')).toBeUndefined();
    expect((await dbStack(variantNumber, 'near_mint', 'en'))?.quantity).toBe(1);
  });

  test('unknown variant add fails without creating a row', async () => {
    const variantNumber = 'NOT-A-REAL-VARIANT-999';
    const res = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(res.status).toBeGreaterThanOrEqual(400);

    const { db } = getContext();
    const collectionId = await collectionIdForUser(userId);
    const rows = await db
      .select({ variantNumber: collectionItems.variantNumber })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.variantNumber, variantNumber)
        )
      );
    expect(rows).toHaveLength(0);
  });
});
