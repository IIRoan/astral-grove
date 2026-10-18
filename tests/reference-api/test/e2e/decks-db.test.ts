import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { DeckDetailResponse, DeckListResponse } from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { userDecks } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const testEmail = `test-db-decks-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
let cookieHeader = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-decks-%');
  cookieHeader = await signUpTestUser({
    email: testEmail,
    password: testPassword,
    name: 'DB Decks User',
  });

  const sessionRes = await authFetch('/api/auth/get-session', { cookie: cookieHeader });
  const session = await sessionRes.json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-db-decks-%');
});

function emptyDeckPayload(deckId: string, name: string, now = Date.now()) {
  return {
    id: deckId,
    name,
    description: 'database test deck',
    createdAt: now,
    updatedAt: now,
    legend: null,
    champion: null,
    mainDeck: [],
    runes: [],
    battlefields: [],
    sideboard: [],
  };
}

describe('owned deck database workflows', () => {
  test('PUT /decks stores a new owned deck row in Postgres', async () => {
    const deckId = `deck_db_${Date.now()}`;

    const putRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify(emptyDeckPayload(deckId, 'DB Stored Deck')),
    });
    expect(putRes.status).toBe(200);
    const body = DeckDetailResponse.parse(await putRes.json());
    expect(body.data.source).toBe('owned');

    const { db } = getContext();
    const row = await db.query.userDecks.findFirst({
      where: and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)),
    });

    expect(row?.name).toBe('DB Stored Deck');
    expect(row?.description).toBe('database test deck');
    expect((row?.payload as { id?: string })?.id).toBe(deckId);
  });

  test('PUT /decks updates the existing Postgres row on conflict', async () => {
    const deckId = `deck_db_update_${Date.now()}`;
    const now = Date.now();

    await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify(emptyDeckPayload(deckId, 'Original Name', now)),
    });

    const updateRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify({
        ...emptyDeckPayload(deckId, 'Renamed Deck', now),
        description: 'updated in db',
      }),
    });
    expect(updateRes.status).toBe(200);

    const { db } = getContext();
    const rows = await db
      .select({
        name: userDecks.name,
        description: userDecks.description,
      })
      .from(userDecks)
      .where(and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      name: 'Renamed Deck',
      description: 'updated in db',
    });
  });

  test('DELETE /decks removes the owned deck row from Postgres', async () => {
    const deckId = `deck_db_delete_${Date.now()}`;

    await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'PUT',
      cookie: cookieHeader,
      body: JSON.stringify(emptyDeckPayload(deckId, 'Delete Me')),
    });

    const deleteRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      method: 'DELETE',
      cookie: cookieHeader,
    });
    expect(deleteRes.status).toBe(200);

    const { db } = getContext();
    const row = await db.query.userDecks.findFirst({
      where: and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)),
    });
    expect(row).toBeUndefined();

    const listRes = await authFetch('/api/v1/decks?source=owned', {
      cookie: cookieHeader,
    });
    const list = DeckListResponse.parse(await listRes.json());
    expect(list.data.some((deck) => deck.id === deckId)).toBe(false);
  });
});
