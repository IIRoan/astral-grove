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
  CollectionImportResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
} from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionItems, collectionMembers, variants } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const stamp = Date.now();
const password = 'test-password-12345';
let cookie = '';
let userId = '';

const STD = 'OGN-015';
const FOIL = 'OGN-015-Foil';

beforeAll(async () => {
  await cleanupTestUsers('test-db-coll-foil-%');
  cookie = await signUpTestUser({
    email: `test-db-coll-foil-${stamp}@test.riftbound.dev`,
    password,
    name: 'Collection Foil User',
  });
  const session = await (await authFetch('/api/auth/get-session', { cookie })).json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-coll-foil-%');
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

async function quantities(
  variantNumbers: string[]
): Promise<Map<string, { quantity: number; isFoil: boolean }[]>> {
  const res = await authFetch('/api/v1/collection/quantities', {
    method: 'POST',
    cookie,
    body: JSON.stringify({ variantNumbers }),
  });
  const parsed = CollectionQuantitiesResponse.parse(await res.json());
  const map = new Map<string, { quantity: number; isFoil: boolean }[]>();
  for (const row of parsed.data) {
    const list = map.get(row.variantNumber) ?? [];
    list.push({ quantity: row.quantity, isFoil: row.isFoil });
    map.set(row.variantNumber, list);
  }
  return map;
}

function qtyFor(
  map: Map<string, { quantity: number; isFoil: boolean }[]>,
  variantNumber: string,
  isFoil = false
): number {
  const rows = map.get(variantNumber) ?? [];
  return rows.find((row) => row.isFoil === isFoil)?.quantity ?? 0;
}

async function dbQty(variantNumber: string, isFoil?: boolean): Promise<number> {
  const { db } = getContext();
  const collectionId = await collectionIdForUser(userId);
  const filters = [
    eq(collectionItems.collectionId, collectionId),
    eq(collectionItems.variantNumber, variantNumber),
    eq(collectionItems.condition, 'near_mint'),
    eq(collectionItems.language, 'en'),
  ];
  if (isFoil !== undefined) {
    filters.push(eq(collectionItems.isFoil, isFoil));
  }
  const [row] = await db
    .select({ quantity: collectionItems.quantity })
    .from(collectionItems)
    .where(and(...filters))
    .limit(1);
  return row?.quantity ?? 0;
}

describe('collection foil vs standard stack mutations', () => {
  test('adding foil does not create or increment the standard stack', async () => {
    const addFoil = await authFetch(
      `/api/v1/collection/${encodeURIComponent(FOIL)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(addFoil.status).toBe(200);
    const foilItem = CollectionItemResponse.parse(await addFoil.json());
    expect(foilItem.data?.variantNumber).toBe(FOIL);
    expect(foilItem.data?.quantity).toBe(1);
    expect(foilItem.data?.isFoil).toBe(true);

    const qty = await quantities([STD, FOIL]);
    expect(qtyFor(qty, FOIL, true)).toBe(1);
    expect(qtyFor(qty, STD, false)).toBe(0);
    expect(await dbQty(FOIL, true)).toBe(1);
    expect(await dbQty(STD, false)).toBe(0);
  });

  test('adding standard alongside foil keeps independent quantities', async () => {
    const addStd = await authFetch(
      `/api/v1/collection/${encodeURIComponent(STD)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 2 }),
      }
    );
    expect(addStd.status).toBe(200);
    expect(CollectionItemResponse.parse(await addStd.json()).data?.isFoil).toBe(false);

    const qty = await quantities([STD, FOIL]);
    expect(qtyFor(qty, STD, false)).toBe(2);
    expect(qtyFor(qty, FOIL, true)).toBe(1);
  });

  test('removing from foil-only decrements foil and leaves standard intact', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent(STD)}`, {
      method: 'PUT',
      cookie,
      body: JSON.stringify({ variantNumber: STD, quantity: 0 }),
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent(FOIL)}`, {
      method: 'PUT',
      cookie,
      body: JSON.stringify({ variantNumber: FOIL, quantity: 1 }),
    });

    const removeFoil = await authFetch(
      `/api/v1/collection/${encodeURIComponent(FOIL)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(removeFoil.status).toBe(200);
    expect(await removeFoil.json()).toEqual({ data: null });

    const qty = await quantities([STD, FOIL]);
    expect(qtyFor(qty, FOIL, true)).toBe(0);
    expect(qtyFor(qty, STD, false)).toBe(0);
  });

  test('removing standard does not touch foil when both are owned', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent(STD)}/add`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ delta: 3 }),
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent(FOIL)}/add`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({ delta: 2 }),
    });

    const removeStd = await authFetch(
      `/api/v1/collection/${encodeURIComponent(STD)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(removeStd.status).toBe(200);
    expect(CollectionItemResponse.parse(await removeStd.json()).data?.quantity).toBe(2);

    const qty = await quantities([STD, FOIL]);
    expect(qtyFor(qty, STD, false)).toBe(2);
    expect(qtyFor(qty, FOIL, true)).toBe(2);

    const list = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie })).json()
    );
    const stdRow = list.data.find((item) => item.variantNumber === STD);
    const foilRow = list.data.find((item) => item.variantNumber === FOIL);
    expect(stdRow?.quantity).toBe(2);
    expect(stdRow?.isFoil).toBe(false);
    expect(foilRow?.quantity).toBe(2);
    expect(foilRow?.isFoil).toBe(true);
  });

  test('DELETE foil printing leaves standard stack', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent(FOIL)}`, {
      method: 'DELETE',
      cookie,
    });

    const qty = await quantities([STD, FOIL]);
    expect(qtyFor(qty, FOIL, true)).toBe(0);
    expect(qtyFor(qty, STD, false)).toBe(2);
  });

  test('PUT absolute quantity on foil does not alter standard', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent(FOIL)}`, {
      method: 'PUT',
      cookie,
      body: JSON.stringify({ variantNumber: FOIL, quantity: 5 }),
    });

    const qty = await quantities([STD, FOIL]);
    expect(qtyFor(qty, FOIL, true)).toBe(5);
    expect(qtyFor(qty, STD, false)).toBe(2);
  });
});

describe('same-VN foilMode=both finish stacks', () => {
  let bothVn = '';

  beforeAll(async () => {
    const { db } = getContext();
    // Prefer a collectible SKU that has no distinct -Foil sibling in catalog.
    const candidates = await db
      .select({ variantNumber: variants.variantNumber })
      .from(variants)
      .where(eq(variants.variantNumber, 'OGN-036'))
      .limit(1);
    bothVn = candidates[0]?.variantNumber ?? STD;
    await db
      .update(variants)
      .set({ foilMode: 'both' })
      .where(eq(variants.variantNumber, bothVn));
  });

  test('isFoil true/false create independent stacks under one variant number', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent(bothVn)}`, {
      method: 'DELETE',
      cookie,
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent(bothVn)}?isFoil=true`, {
      method: 'DELETE',
      cookie,
    });

    const addStd = await authFetch(
      `/api/v1/collection/${encodeURIComponent(bothVn)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 2, isFoil: false }),
      }
    );
    expect(addStd.status).toBe(200);
    expect(CollectionItemResponse.parse(await addStd.json()).data?.isFoil).toBe(false);

    const addFoil = await authFetch(
      `/api/v1/collection/${encodeURIComponent(bothVn)}/add`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 3, isFoil: true }),
      }
    );
    expect(addFoil.status).toBe(200);
    expect(CollectionItemResponse.parse(await addFoil.json()).data?.isFoil).toBe(true);

    const qty = await quantities([bothVn]);
    expect(qtyFor(qty, bothVn, false)).toBe(2);
    expect(qtyFor(qty, bothVn, true)).toBe(3);
    expect(await dbQty(bothVn, false)).toBe(2);
    expect(await dbQty(bothVn, true)).toBe(3);

    const removeFoil = await authFetch(
      `/api/v1/collection/${encodeURIComponent(bothVn)}/remove`,
      {
        method: 'POST',
        cookie,
        body: JSON.stringify({ delta: 1, isFoil: true }),
      }
    );
    expect(removeFoil.status).toBe(200);
    expect(qtyFor(await quantities([bothVn]), bothVn, true)).toBe(2);
    expect(qtyFor(await quantities([bothVn]), bothVn, false)).toBe(2);
  });

  test('item import preserves standard and foil stacks under one variant number', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent(bothVn)}`, {
      method: 'DELETE',
      cookie,
    });
    await authFetch(`/api/v1/collection/${encodeURIComponent(bothVn)}?isFoil=true`, {
      method: 'DELETE',
      cookie,
    });

    const response = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        items: [
          {
            variantNumber: bothVn,
            quantity: 4,
            condition: 'near_mint',
            language: 'en',
            isFoil: false,
          },
          {
            variantNumber: bothVn,
            quantity: 5,
            condition: 'near_mint',
            language: 'en',
            isFoil: true,
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(CollectionImportResponse.parse(await response.json()).data.imported).toBe(2);
    const qty = await quantities([bothVn]);
    expect(qtyFor(qty, bothVn, false)).toBe(4);
    expect(qtyFor(qty, bothVn, true)).toBe(5);
  });
});
