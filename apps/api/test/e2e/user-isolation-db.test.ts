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
  WishlistListResponse,
} from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import {
  collectionItems,
  collectionMembers,
  userDecks,
  wishlistItems,
} from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const password = 'test-password-12345';
let cookieA = '';
let cookieB = '';
let userIdA = '';
let userIdB = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-isolation-%');

  const stamp = Date.now();
  cookieA = await signUpTestUser({
    email: `test-db-isolation-a-${stamp}@test.riftbound.dev`,
    password,
    name: 'Isolation User A',
  });
  cookieB = await signUpTestUser({
    email: `test-db-isolation-b-${stamp}@test.riftbound.dev`,
    password,
    name: 'Isolation User B',
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
  await cleanupTestUsers('test-db-isolation-%');
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

describe('per-user database isolation', () => {
  test('collection rows are scoped to the authenticated user', async () => {
    const variantNumber = 'OGN-100';

    await authFetch(`/api/v1/collection/${encodeURIComponent(variantNumber)}/add`, {
      method: 'POST',
      cookie: cookieA,
      body: JSON.stringify({ delta: 4 }),
    });

    const quantitiesB = CollectionQuantitiesResponse.parse(
      await (
        await authFetch('/api/v1/collection/quantities', {
          method: 'POST',
          cookie: cookieB,
          body: JSON.stringify({ variantNumbers: [variantNumber] }),
        })
      ).json()
    );
    expect(quantitiesB.data).toEqual([{ variantNumber, isFoil: false, quantity: 0 }]);

    const listB = CollectionListResponse.parse(
      await (await authFetch('/api/v1/collection', { cookie: cookieB })).json()
    );
    expect(listB.data.some((item) => item.variantNumber === variantNumber)).toBe(false);

    const { db } = getContext();
    const collectionIdA = await collectionIdForUser(userIdA);
    expect(collectionIdA).toBeTruthy();
    const rowsA = await db
      .select({ quantity: collectionItems.quantity })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionIdA!),
          eq(collectionItems.variantNumber, variantNumber)
        )
      );
    const collectionIdB = await collectionIdForUser(userIdB);
    const rowsB = collectionIdB
      ? await db
          .select({ quantity: collectionItems.quantity })
          .from(collectionItems)
          .where(
            and(
              eq(collectionItems.collectionId, collectionIdB),
              eq(collectionItems.variantNumber, variantNumber)
            )
          )
      : [];

    expect(rowsA[0]?.quantity).toBe(4);
    expect(rowsB).toHaveLength(0);
  });

  test('wishlist rows are scoped to the authenticated user', async () => {
    const variantNumber = 'OGN-101';

    await authFetch(`/api/v1/wishlist/${encodeURIComponent(variantNumber)}`, {
      method: 'PUT',
      cookie: cookieA,
      body: JSON.stringify({ variantNumber, priority: 2, notes: 'user A only' }),
    });

    const listB = WishlistListResponse.parse(
      await (await authFetch('/api/v1/wishlist', { cookie: cookieB })).json()
    );
    expect(listB.data.some((item) => item.variantNumber === variantNumber)).toBe(false);

    const { db } = getContext();
    const rowsA = await db
      .select({ notes: wishlistItems.notes })
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.userId, userIdA),
          eq(wishlistItems.variantNumber, variantNumber)
        )
      );
    const rowsB = await db
      .select({ variantNumber: wishlistItems.variantNumber })
      .from(wishlistItems)
      .where(
        and(
          eq(wishlistItems.userId, userIdB),
          eq(wishlistItems.variantNumber, variantNumber)
        )
      );

    expect(rowsA[0]?.notes).toBe('user A only');
    expect(rowsB).toHaveLength(0);
  });

  test('owned deck rows are scoped to the authenticated user', async () => {
    const deckId = `deck_isolation_${Date.now()}`;
    const now = Date.now();

    await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie: cookieA,
      body: JSON.stringify({
        id: deckId,
        name: 'User A Deck',
        description: '',
        createdAt: now,
        updatedAt: now,
        legend: null,
        champion: null,
        mainDeck: [],
        runes: [],
        battlefields: [],
        sideboard: [],
      }),
    });

    const listB = await authFetch('/api/v1/decks?source=owned', { cookie: cookieB });
    expect(listB.status).toBe(200);
    const ownedB = (await listB.json()) as { data: Array<{ id: string }> };
    expect(ownedB.data.some((deck) => deck.id === deckId)).toBe(false);

    const detailB = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      cookie: cookieB,
    });
    expect(detailB.status).toBe(404);

    const { db } = getContext();
    const rowsA = await db
      .select({ name: userDecks.name })
      .from(userDecks)
      .where(and(eq(userDecks.userId, userIdA), eq(userDecks.id, deckId)));
    const rowsB = await db
      .select({ id: userDecks.id })
      .from(userDecks)
      .where(and(eq(userDecks.userId, userIdB), eq(userDecks.id, deckId)));

    expect(rowsA[0]?.name).toBe('User A Deck');
    expect(rowsB).toHaveLength(0);
  });
});
