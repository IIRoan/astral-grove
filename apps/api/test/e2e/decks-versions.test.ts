import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  DECK_VERSION_LIMIT,
  DeckDetailResponse,
  DEFAULT_DECK_VERSION_NAME,
} from '@riftbound/contracts';
import { and, eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { userDecks, userDeckVersions } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const testEmail = `test-deck-versions-${Date.now()}@test.riftbound.dev`;
const testPassword = 'test-password-12345';
let cookieHeader = '';
let userId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-deck-versions-%');
  cookieHeader = await signUpTestUser({
    email: testEmail,
    password: testPassword,
    name: 'Deck Versions User',
  });

  const sessionRes = await authFetch('/api/auth/get-session', { cookie: cookieHeader });
  const session = await sessionRes.json();
  userId = session.user.id as string;
});

afterAll(async () => {
  await cleanupTestUsers('test-deck-versions-%');
});

function emptyDeckPayload(deckId: string, name: string, now = Date.now()) {
  return {
    id: deckId,
    name,
    description: 'version test deck',
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

async function putDeck(deckId: string, name: string) {
  const res = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
    method: 'PUT',
    cookie: cookieHeader,
    body: JSON.stringify(emptyDeckPayload(deckId, name)),
  });
  expect(res.status).toBe(200);
  return DeckDetailResponse.parse(await res.json()).data;
}

describe('owned deck versions', () => {
  test('PUT /decks creates a Current version and returns it on detail', async () => {
    const deckId = `deck_ver_create_${Date.now()}`;
    const data = await putDeck(deckId, 'Versioned Deck');

    expect(data.versionName).toBe(DEFAULT_DECK_VERSION_NAME);
    expect(data.versionId).toBeTruthy();
    expect(data.versions).toEqual([
      expect.objectContaining({
        id: data.versionId,
        name: DEFAULT_DECK_VERSION_NAME,
        isActive: true,
      }),
    ]);

    const { db } = getContext();
    const row = await db.query.userDecks.findFirst({
      where: and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)),
    });
    expect(row?.activeVersionId).toBe(data.versionId);

    const versions = await db
      .select()
      .from(userDeckVersions)
      .where(
        and(eq(userDeckVersions.userId, userId), eq(userDeckVersions.deckId, deckId))
      );
    expect(versions).toHaveLength(1);
    expect(versions[0]?.name).toBe(DEFAULT_DECK_VERSION_NAME);
  });

  test('POST /versions copies the active list, names it, and switches', async () => {
    const deckId = `deck_ver_branch_${Date.now()}`;
    const created = await putDeck(deckId, 'Branch Source');
    const originalVersionId = created.versionId;

    const createRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions`,
      {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ name: 'Post-ban' }),
      }
    );
    expect(createRes.status).toBe(200);
    const branched = DeckDetailResponse.parse(await createRes.json()).data;
    expect(branched.versionName).toBe('Post-ban');
    expect(branched.versionId).not.toBe(originalVersionId);
    expect(branched.name).toBe('Branch Source');
    expect(branched.versions).toHaveLength(2);
    expect(branched.versions?.find((version) => version.isActive)?.name).toBe(
      'Post-ban'
    );
  });

  test('activate switches the family payload and keeps the deck name', async () => {
    const deckId = `deck_ver_switch_${Date.now()}`;
    const created = await putDeck(deckId, 'Family Name');
    const originalVersionId = created.versionId!;

    const withCard = {
      ...emptyDeckPayload(deckId, 'Family Name'),
      mainDeck: [
        {
          card: {
            cardId: 'c1',
            variantNumber: 'OGN-001',
            name: 'Sparklefly',
            type: 'Unit',
            super: null,
            tags: [],
            colors: ['orange'],
            energy: 1,
            setCode: 'OGN',
            rarity: 'common',
            variantType: 'standard',
            isSignature: false,
          },
          count: 3,
        },
      ],
    };
    const saveRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions/${encodeURIComponent(originalVersionId)}`,
      {
        method: 'PUT',
        cookie: cookieHeader,
        body: JSON.stringify(withCard),
      }
    );
    expect(saveRes.status).toBe(200);

    const branchRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions`,
      {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ name: 'Empty copy' }),
      }
    );
    const branched = DeckDetailResponse.parse(await branchRes.json()).data;

    const activateRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions/${encodeURIComponent(originalVersionId)}/activate`,
      {
        method: 'POST',
        cookie: cookieHeader,
      }
    );
    expect(activateRes.status).toBe(200);
    const restored = DeckDetailResponse.parse(await activateRes.json()).data;
    expect(restored.versionId).toBe(originalVersionId);
    expect(restored.name).toBe('Family Name');
    expect(restored.mainDeck).toHaveLength(1);
    expect(branched.versionId).not.toBe(originalVersionId);
  });

  test('PUT of an inactive version does not move the active pointer', async () => {
    const deckId = `deck_ver_inactive_${Date.now()}`;
    const created = await putDeck(deckId, 'Active Deck');
    const originalVersionId = created.versionId!;

    const branchRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions`,
      {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ name: 'Side line' }),
      }
    );
    const branched = DeckDetailResponse.parse(await branchRes.json()).data;
    expect(branched.versionId).not.toBe(originalVersionId);

    const inactiveSave = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions/${encodeURIComponent(originalVersionId)}`,
      {
        method: 'PUT',
        cookie: cookieHeader,
        body: JSON.stringify({
          ...emptyDeckPayload(deckId, 'Active Deck'),
          description: 'saved while inactive',
        }),
      }
    );
    expect(inactiveSave.status).toBe(200);
    const after = DeckDetailResponse.parse(await inactiveSave.json()).data;
    expect(after.versionId).toBe(branched.versionId);
    expect(after.description).toBe('version test deck');

    const { db } = getContext();
    const row = await db.query.userDecks.findFirst({
      where: and(eq(userDecks.userId, userId), eq(userDecks.id, deckId)),
    });
    expect(row?.activeVersionId).toBe(branched.versionId);
  });

  test('rename, delete last version, and version cap', async () => {
    const deckId = `deck_ver_manage_${Date.now()}`;
    const created = await putDeck(deckId, 'Manage Me');
    const originalVersionId = created.versionId!;

    const renameRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions/${encodeURIComponent(originalVersionId)}`,
      {
        method: 'PATCH',
        cookie: cookieHeader,
        body: JSON.stringify({ name: 'Mainline' }),
      }
    );
    expect(renameRes.status).toBe(200);
    const renamed = DeckDetailResponse.parse(await renameRes.json()).data;
    expect(renamed.versionName).toBe('Mainline');

    const lastDelete = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions/${encodeURIComponent(originalVersionId)}`,
      {
        method: 'DELETE',
        cookie: cookieHeader,
      }
    );
    expect(lastDelete.status).toBe(409);
    const lastBody = (await lastDelete.json()) as { error: string };
    expect(lastBody.error).toBe('DECK_LAST_VERSION');

    const missing = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions/dver_missing/activate`,
      {
        method: 'POST',
        cookie: cookieHeader,
      }
    );
    expect(missing.status).toBe(404);

    for (let i = 0; i < DECK_VERSION_LIMIT - 1; i += 1) {
      const res = await authFetch(
        `/api/v1/decks/${encodeURIComponent(deckId)}/versions`,
        {
          method: 'POST',
          cookie: cookieHeader,
          body: JSON.stringify({ name: `V${i + 2}` }),
        }
      );
      expect(res.status).toBe(200);
    }

    const capped = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions`,
      {
        method: 'POST',
        cookie: cookieHeader,
        body: JSON.stringify({ name: 'Overflow' }),
      }
    );
    expect(capped.status).toBe(409);
    const capBody = (await capped.json()) as { error: string };
    expect(capBody.error).toBe('DECK_VERSION_LIMIT');

    const detailRes = await authFetch(`/api/v1/decks/${encodeURIComponent(deckId)}`, {
      cookie: cookieHeader,
    });
    const detail = DeckDetailResponse.parse(await detailRes.json()).data;
    const extra = detail.versions?.find((version) => !version.isActive);
    expect(extra).toBeTruthy();

    const deleteRes = await authFetch(
      `/api/v1/decks/${encodeURIComponent(deckId)}/versions/${encodeURIComponent(extra!.id)}`,
      {
        method: 'DELETE',
        cookie: cookieHeader,
      }
    );
    expect(deleteRes.status).toBe(200);
    const afterDelete = DeckDetailResponse.parse(await deleteRes.json()).data;
    expect(afterDelete.versions).toHaveLength(DECK_VERSION_LIMIT - 1);
  });
});
