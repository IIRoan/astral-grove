import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CollectionImportResponse,
  CollectionListResponse,
  CollectionQuantitiesResponse,
} from '@riftbound/contracts';
import { and, eq, sql } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionItems, collectionMembers } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const testEmail = `test-db-collection-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
let cookieHeader = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-collection-%');
  cookieHeader = await signUpTestUser({
    email: testEmail,
    password: testPassword,
    name: 'DB Collection User',
  });

  const sessionRes = await authFetch('/api/auth/get-session', { cookie: cookieHeader });
  const session = await sessionRes.json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-collection-%');
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

async function countCollectionRows() {
  const { db } = getContext();
  const collectionId = await collectionIdForUser(userId);
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));
  return row?.value ?? 0;
}

describe('collection database workflows', () => {
  test('quantities endpoint reflects rows persisted in Postgres', async () => {
    const variants = ['OGN-001', 'OGN-002', 'OGN-003'];

    for (const [index, variantNumber] of variants.entries()) {
      const addRes = await authFetch(
        `/api/v1/collection/${encodeURIComponent(variantNumber)}/add`,
        {
          method: 'POST',
          cookie: cookieHeader,
          body: JSON.stringify({ delta: index + 1 }),
        }
      );
      expect(addRes.status).toBe(200);
    }

    const quantitiesRes = await authFetch('/api/v1/collection/quantities', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ variantNumbers: [...variants, 'OGN-999'] }),
    });
    const quantities = CollectionQuantitiesResponse.parse(await quantitiesRes.json());

    expect(quantities.data).toEqual(
      expect.arrayContaining([
        { variantNumber: 'OGN-001', isFoil: false, quantity: 1 },
        { variantNumber: 'OGN-002', isFoil: false, quantity: 2 },
        { variantNumber: 'OGN-003', isFoil: false, quantity: 3 },
        { variantNumber: 'OGN-999', isFoil: false, quantity: 0 },
      ])
    );

    const { db } = getContext();
    const rows = await db
      .select({
        variantNumber: collectionItems.variantNumber,
        quantity: collectionItems.quantity,
      })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, await collectionIdForUser(userId)));

    expect(rows).toEqual(
      expect.arrayContaining([
        { variantNumber: 'OGN-001', quantity: 1 },
        { variantNumber: 'OGN-002', quantity: 2 },
        { variantNumber: 'OGN-003', quantity: 3 },
      ])
    );
  });

  test('set quantity to zero removes the database row', async () => {
    const variantNumber = 'OGN-004';

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ delta: 1 }),
    });

    const putRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}`,
      {
        method: 'PUT',
        cookie: cookieHeader,
        body: JSON.stringify({ variantNumber, quantity: 0 }),
      }
    );
    expect(putRes.status).toBe(200);

    const quantitiesRes = await authFetch('/api/v1/collection/quantities', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ variantNumbers: [variantNumber] }),
    });
    const quantities = CollectionQuantitiesResponse.parse(await quantitiesRes.json());
    expect(quantities.data).toEqual([{ variantNumber, isFoil: false, quantity: 0 }]);

    const { db } = getContext();
    const rows = await db
      .select({ variantNumber: collectionItems.variantNumber })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, await collectionIdForUser(userId)));

    expect(rows.some((row) => row.variantNumber === variantNumber)).toBe(false);
  });

  test('remove endpoint decrements quantity and deletes the row at zero', async () => {
    const variantNumber = 'OGN-005';

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ delta: 2 }),
    });

    const removeRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`,
      {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ delta: 1 }),
      }
    );
    expect(removeRes.status).toBe(200);

    const { db } = getContext();
    const [row] = await db
      .select({ quantity: collectionItems.quantity })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, await collectionIdForUser(userId)),
          eq(collectionItems.variantNumber, variantNumber)
        )
      );
    expect(row?.quantity).toBe(1);

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/remove`, {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ delta: 1 }),
    });

    const remaining = await db
      .select({ variantNumber: collectionItems.variantNumber })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, await collectionIdForUser(userId)),
          eq(collectionItems.variantNumber, variantNumber)
        )
      );
    expect(remaining).toHaveLength(0);
  });

  test('different condition and language combinations create separate database rows', async () => {
    const variantNumber = 'OGN-006';

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        variantNumber,
        quantity: 1,
        condition: 'near_mint',
        language: 'en',
      }),
    });

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        variantNumber,
        quantity: 2,
        condition: 'lightly_played',
        language: 'en',
      }),
    });

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        variantNumber,
        quantity: 3,
        condition: 'near_mint',
        language: 'jp',
      }),
    });

    const { db } = getContext();
    const rows = await db
      .select({
        condition: collectionItems.condition,
        language: collectionItems.language,
        quantity: collectionItems.quantity,
      })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, await collectionIdForUser(userId)),
          eq(collectionItems.variantNumber, variantNumber)
        )
      );

    expect(rows).toEqual(
      expect.arrayContaining([
        { condition: 'near_mint', language: 'en', quantity: 1 },
        { condition: 'lightly_played', language: 'en', quantity: 2 },
        { condition: 'near_mint', language: 'jp', quantity: 3 },
      ])
    );
    expect(rows).toHaveLength(3);
  });

  test('batch sync writes all items to Postgres', async () => {
    const beforeCount = await countCollectionRows();

    const batchRes = await authFetch('/api/v1/collection/batch', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({
        items: [
          {
            variantNumber: 'OGN-010',
            quantity: 4,
            condition: 'near_mint',
            language: 'en',
          },
          {
            variantNumber: 'OGN-011',
            quantity: 2,
            condition: 'near_mint',
            language: 'en',
          },
          {
            variantNumber: 'OGN-012',
            quantity: 1,
            condition: 'near_mint',
            language: 'en',
          },
        ],
      }),
    });
    expect(batchRes.status).toBe(200);

    const { db } = getContext();
    const rows = await db
      .select({
        variantNumber: collectionItems.variantNumber,
        quantity: collectionItems.quantity,
      })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, await collectionIdForUser(userId)));

    expect(rows).toEqual(
      expect.arrayContaining([
        { variantNumber: 'OGN-010', quantity: 4 },
        { variantNumber: 'OGN-011', quantity: 2 },
        { variantNumber: 'OGN-012', quantity: 1 },
      ])
    );
    expect(await countCollectionRows()).toBeGreaterThanOrEqual(beforeCount + 3);
  });

  test('import items persists aggregated rows in Postgres', async () => {
    const importRes = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({
        items: [
          {
            variantNumber: 'OGN-020',
            quantity: 2,
            condition: 'near_mint',
            language: 'en',
          },
          {
            variantNumber: 'OGN-021',
            quantity: 1,
            condition: 'lightly_played',
            language: 'en',
          },
        ],
      }),
    });
    expect(importRes.status).toBe(200);
    const imported = CollectionImportResponse.parse(await importRes.json());
    expect(imported.data.imported).toBe(2);

    const { db } = getContext();
    const rows = await db
      .select({
        variantNumber: collectionItems.variantNumber,
        quantity: collectionItems.quantity,
        condition: collectionItems.condition,
      })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, await collectionIdForUser(userId)));

    expect(rows).toEqual(
      expect.arrayContaining([
        { variantNumber: 'OGN-020', quantity: 2, condition: 'near_mint' },
        { variantNumber: 'OGN-021', quantity: 1, condition: 'lightly_played' },
      ])
    );
  });

  test('CSV import round-trips through Postgres and export', async () => {
    const csv = [
      'Variant Number,Card Name,Set,Set Prefix,Rarity,Variant Type,Variant Label,Foil,Quantity,Language,Condition,Grading Company,Grading Value,Grading Label,Notes',
      'OGN-004,Cleave,Origins,OGN,Common,Standard,Standard,false,3,English,Near Mint,,,,From DB test',
    ].join('\n');

    const importRes = await authFetch('/api/v1/collection/import', {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ csv }),
    });
    expect(importRes.status).toBe(200);

    const { db } = getContext();
    const [row] = await db
      .select({
        quantity: collectionItems.quantity,
        notes: collectionItems.notes,
        condition: collectionItems.condition,
        language: collectionItems.language,
      })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, await collectionIdForUser(userId)),
          eq(collectionItems.variantNumber, 'OGN-004')
        )
      );
    expect(row?.quantity).toBe(3);
    expect(row?.notes).toBe('From DB test');
    expect(row?.condition).toBe('near_mint');
    expect(row?.language).toBe('en');

    const listRes = await authFetch('/api/v1/collection', { cookie: cookieHeader });
    const list = CollectionListResponse.parse(await listRes.json());
    const item = list.data.find((entry) => entry.variantNumber === 'OGN-004');
    expect(item?.quantity).toBe(3);
    expect(item?.name).toBe('Cleave');
  });

  test('DELETE /collection/:variantNumber removes matching rows from Postgres', async () => {
    const variantNumber = 'OGN-040';

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ delta: 1 }),
    });

    const deleteRes = await authFetch(
      `/api/v1/collection/${encodeURIComponent(variantNumber)}?condition=near_mint&language=en`,
      {
        method: 'DELETE',
        cookie: cookieHeader,
      }
    );
    expect(deleteRes.status).toBe(200);

    const { db } = getContext();
    const rows = await db
      .select({ variantNumber: collectionItems.variantNumber })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, await collectionIdForUser(userId)),
          eq(collectionItems.variantNumber, variantNumber)
        )
      );
    expect(rows).toHaveLength(0);
  });

  test('DELETE /collection/all clears only the current user rows in Postgres', async () => {
    await authFetch(`/api/v1/collection/${encodeURIComponent('OGN-050')}/add`, {
      method: 'POST',
      cookie: cookieHeader,
      body: JSON.stringify({ delta: 1 }),
    });

    const before = await countCollectionRows();
    expect(before).toBeGreaterThan(0);

    const clearRes = await authFetch('/api/v1/collection/all', {
      method: 'DELETE',
      cookie: cookieHeader,
    });
    expect(clearRes.status).toBe(200);

    expect(await countCollectionRows()).toBe(0);
  });
});
