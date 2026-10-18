import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CollectionLiveEvent,
  CollectionQuantitiesResponse,
  CollectionShareAcceptResponse,
  CollectionShareInviteCreateResponse,
  type CollectionLiveChangedEvent,
  type CollectionLiveEvent as LiveEvent,
} from '@riftbound/contracts';
import { eq } from 'drizzle-orm';
import { authFetch, cleanupTestUsers, signUpTestUser } from './helpers/auth.js';
import { getContext } from './support.js';
import { collectionMembers } from '../../src/db/schema.js';

setDefaultTimeout(120_000);

const password = 'test-password-12345';
const stamp = Date.now();
let cookieOwner = '';
let cookiePartner = '';
let cookieStranger = '';
let ownerId = '';
let partnerId = '';

beforeAll(async () => {
  await cleanupTestUsers('test-db-live-%');
  cookieOwner = await signUpTestUser({
    email: `test-db-live-owner-${stamp}@test.riftbound.dev`,
    password,
    name: 'Live Owner',
  });
  cookiePartner = await signUpTestUser({
    email: `test-db-live-partner-${stamp}@test.riftbound.dev`,
    password,
    name: 'Live Partner',
  });
  cookieStranger = await signUpTestUser({
    email: `test-db-live-stranger-${stamp}@test.riftbound.dev`,
    password,
    name: 'Live Stranger',
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
  await cleanupTestUsers('test-db-live-%');
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

class LiveEventSession {
  readonly events: LiveEvent[] = [];
  private readonly controller = new AbortController();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private buffer = '';
  private readonly decoder = new TextDecoder();
  private pump: Promise<void> | null = null;

  async open(cookie: string): Promise<void> {
    const res = await authFetch('/api/v1/collection/events', {
      cookie,
      signal: this.controller.signal,
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('text/event-stream');
    expect(res.headers.get('content-encoding')).toBeNull();
    expect(res.body).toBeTruthy();
    this.reader = res.body!.getReader();
    this.pump = this.readLoop();
    await this.waitFor((e) => e.type === 'ready', 5_000);
  }

  private async readLoop(): Promise<void> {
    if (!this.reader) return;
    try {
      while (!this.controller.signal.aborted) {
        const { done, value } = await this.reader.read();
        if (done) break;
        this.buffer += this.decoder.decode(value, { stream: true });
        const parts = this.buffer.split('\n\n');
        this.buffer = parts.pop() ?? '';
        for (const part of parts) {
          const dataLine = part.split('\n').find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          try {
            const parsed = CollectionLiveEvent.safeParse(
              JSON.parse(dataLine.slice(5).trimStart())
            );
            if (parsed.success) this.events.push(parsed.data);
          } catch {}
        }
      }
    } catch {}
  }

  async waitFor(
    predicate: (event: LiveEvent) => boolean,
    timeoutMs: number
  ): Promise<LiveEvent> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = this.events.find(predicate);
      if (hit) return hit;
      await Bun.sleep(25);
    }
    throw new Error(
      `Timed out waiting for SSE event. Saw: ${JSON.stringify(this.events)}`
    );
  }

  changedEvents(): CollectionLiveChangedEvent[] {
    return this.events.filter(
      (e): e is CollectionLiveChangedEvent => e.type === 'collection.changed'
    );
  }

  async close(): Promise<void> {
    this.controller.abort();
    try {
      await this.reader?.cancel();
    } catch {}
    await this.pump?.catch(() => undefined);
  }
}

describe('collection live SSE e2e', () => {
  test('rejects unauthenticated SSE connections', async () => {
    const res = await authFetch('/api/v1/collection/events', {
      headers: { Accept: 'text/event-stream' },
    });
    expect(res.status).toBe(401);
  });

  test('streams ready then collection.changed for the listener after their own add', async () => {
    const session = new LiveEventSession();
    await session.open(cookieStranger);

    const ready = session.events.find((e) => e.type === 'ready');
    expect(ready?.type).toBe('ready');
    if (ready?.type === 'ready') {
      expect(ready.collectionId).toBe(
        await collectionIdForUser(
          (
            await (
              await authFetch('/api/auth/get-session', { cookie: cookieStranger })
            ).json()
          ).user.id as string
        )
      );
    }

    const addRes = await authFetch('/api/v1/collection/OGN-301/add', {
      method: 'POST',
      cookie: cookieStranger,
      body: JSON.stringify({ delta: 1 }),
    });
    expect(addRes.status).toBe(200);

    const changed = await session.waitFor(
      (e) => e.type === 'collection.changed' && e.reason === 'add',
      5_000
    );
    expect(changed.type).toBe('collection.changed');
    if (changed.type === 'collection.changed') {
      expect(changed.reason).toBe('add');
      expect(changed.actorUserId).toBeTruthy();
      expect(changed.collectionId).toBeTruthy();
    }

    await session.close();
  });

  test('shared partner receives owner add/remove/delete over SSE and inventory matches', async () => {
    await pairCollections();

    const sharedId = await collectionIdForUser(ownerId);
    expect(await collectionIdForUser(partnerId)).toBe(sharedId);

    const partnerLive = new LiveEventSession();
    const strangerLive = new LiveEventSession();
    await partnerLive.open(cookiePartner);
    await strangerLive.open(cookieStranger);

    const partnerReady = partnerLive.events.find((e) => e.type === 'ready');
    expect(partnerReady?.type).toBe('ready');
    if (partnerReady?.type === 'ready') {
      expect(partnerReady.collectionId).toBe(sharedId);
    }

    const addRes = await authFetch('/api/v1/collection/OGN-302/add', {
      method: 'POST',
      cookie: cookieOwner,
      body: JSON.stringify({ delta: 2 }),
    });
    expect(addRes.status).toBe(200);

    const addEvent = await partnerLive.waitFor(
      (e) =>
        e.type === 'collection.changed' &&
        e.reason === 'add' &&
        e.actorUserId === ownerId,
      5_000
    );
    expect(addEvent.type).toBe('collection.changed');
    if (addEvent.type === 'collection.changed') {
      expect(addEvent.collectionId).toBe(sharedId);
      expect(addEvent.actorUserId).toBe(ownerId);
    }

    expect((await quantitiesFor(cookiePartner, ['OGN-302'])).get('OGN-302')).toBe(2);

    const removeRes = await authFetch('/api/v1/collection/OGN-302/remove', {
      method: 'POST',
      cookie: cookieOwner,
      body: JSON.stringify({ delta: 1 }),
    });
    expect(removeRes.status).toBe(200);

    const removeEvent = await partnerLive.waitFor(
      (e) =>
        e.type === 'collection.changed' &&
        e.reason === 'remove' &&
        e.actorUserId === ownerId,
      5_000
    );
    expect(removeEvent.type).toBe('collection.changed');
    expect((await quantitiesFor(cookiePartner, ['OGN-302'])).get('OGN-302')).toBe(1);

    const deleteRes = await authFetch('/api/v1/collection/OGN-302', {
      method: 'DELETE',
      cookie: cookieOwner,
    });
    expect(deleteRes.status).toBe(200);

    await partnerLive.waitFor(
      (e) =>
        e.type === 'collection.changed' &&
        e.reason === 'delete' &&
        e.actorUserId === ownerId,
      5_000
    );
    expect((await quantitiesFor(cookiePartner, ['OGN-302'])).get('OGN-302')).toBe(0);

    expect(strangerLive.changedEvents()).toEqual([]);

    await partnerLive.close();
    await strangerLive.close();
  });

  test('partner mutation is visible to owner over SSE', async () => {
    const ownerCollectionId = await collectionIdForUser(ownerId);
    const partnerCollectionId = await collectionIdForUser(partnerId);
    if (ownerCollectionId !== partnerCollectionId) {
      await pairCollections();
    }

    const sharedId = await collectionIdForUser(ownerId);
    const ownerLive = new LiveEventSession();
    await ownerLive.open(cookieOwner);

    const addRes = await authFetch('/api/v1/collection/OGN-303/add', {
      method: 'POST',
      cookie: cookiePartner,
      body: JSON.stringify({ delta: 3 }),
    });
    expect(addRes.status).toBe(200);

    const event = await ownerLive.waitFor(
      (e) =>
        e.type === 'collection.changed' &&
        e.reason === 'add' &&
        e.actorUserId === partnerId,
      5_000
    );
    expect(event.type).toBe('collection.changed');
    if (event.type === 'collection.changed') {
      expect(event.collectionId).toBe(sharedId);
    }
    expect((await quantitiesFor(cookieOwner, ['OGN-303'])).get('OGN-303')).toBe(3);

    await ownerLive.close();
  });
});
