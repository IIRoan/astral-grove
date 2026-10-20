import { afterAll, beforeAll, expect, test, setDefaultTimeout } from 'bun:test';
import { createHarness, json, waitFor } from './support';
const { startServer, stopServer, signup, sql } = createHarness();
import { CollectionShareInviteCreateResponse } from '@riftbound/contracts';
setDefaultTimeout(60000);
let app: Awaited<ReturnType<typeof startServer>>;
const users: Array<{ id: string; cookie: string }> = [];
beforeAll(async () => {
  app = await startServer();
  for (let index = 0; index < 3; index++) {
    const user = await signup(app, `race-${index}`);
    users.push({ id: user.user.id, cookie: user.cookie });
  }
});
afterAll(stopServer);
test('simultaneous first collection requests create one membership and never abort a transaction', async () => {
  const user = users[0]!;
  const responses = await Promise.all(
    Array.from({ length: 16 }, () =>
      app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } })
    )
  );
  expect(responses.map((r) => r.status)).toEqual(Array(16).fill(200));
  expect(
    await sql`SELECT user_id FROM collection_members WHERE user_id=${user.id}`
  ).toHaveLength(1);
});
test('an invitation can be accepted by exactly one competing user', async () => {
  const owner = users[0]!,
    a = users[1]!,
    b = users[2]!;
  const invitation = CollectionShareInviteCreateResponse.parse(
    await (
      await app.fetch('/api/v1/collection/share/invite', json({}, owner.cookie))
    ).json()
  );
  const responses = await Promise.all(
    [a, b].map((user) =>
      app.fetch(
        `/api/v1/collection/share/invite/${invitation.data.token}/accept`,
        json({ mode: 'use_theirs' }, user.cookie)
      )
    )
  );
  expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
  expect(responses.filter((r) => r.status !== 200)).toHaveLength(1);
  const collection = (
    await sql`SELECT collection_id FROM collection_members WHERE user_id=${owner.id}`
  )[0]!;
  expect(
    await sql`SELECT user_id FROM collection_members WHERE collection_id=${collection.collection_id}`
  ).toHaveLength(2);
});

test('a departed member stops receiving the former collection live events', async () => {
  const owner = users[0]!;
  const memberships =
    await sql`SELECT user_id FROM collection_members WHERE collection_id=(SELECT collection_id FROM collection_members WHERE user_id=${owner.id}) AND user_id<>${owner.id}`;
  const member = users.find((user) => user.id === memberships[0]!.user_id)!;
  const controller = new AbortController();
  const events = await app.fetch('/api/v1/collection/events', {
    headers: { cookie: member.cookie },
    signal: controller.signal,
  });
  const reader = events.body!.getReader();
  try {
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      'event: ready'
    );
    expect(
      (await app.fetch('/api/v1/collection/share/leave', json({}, member.cookie)))
        .status
    ).toBe(200);
    const ended = reader.read();
    expect(
      (await app.fetch('/api/v1/collection/OGN-001/add', json({}, owner.cookie))).status
    ).toBe(200);
    const next = await Promise.race([
      ended,
      Bun.sleep(2000).then(() => {
        throw new Error('Departed member stream remained open');
      }),
    ]);
    expect(next.done).toBe(true);
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
  }
});

test('an invite created while its owner leaves targets the collection they now belong to', async () => {
  const a = await signup(app, 'invite-race-a'),
    b = await signup(app, 'invite-race-b');
  const shared = CollectionShareInviteCreateResponse.parse(
    await (
      await app.fetch('/api/v1/collection/share/invite', json({}, a.cookie))
    ).json()
  );
  expect(
    (
      await app.fetch(
        `/api/v1/collection/share/invite/${shared.data.token}/accept`,
        json({ mode: 'use_theirs' }, b.cookie)
      )
    ).status
  ).toBe(200);
  const own = crypto.randomUUID();
  const lock = await sql.reserve();
  try {
    await lock`SELECT pg_advisory_lock(1280472986)`;
    const pending = app.fetch('/api/v1/collection/share/invite', json({}, a.cookie));
    await waitFor(
      async () =>
        (
          await sql`SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid::text::bigint=1280472986 AND NOT granted`
        ).length > 0
    );
    // A leave commits while the invite waits on the share lock.
    await sql`INSERT INTO collections(id) VALUES(${own}::uuid)`;
    await sql`UPDATE collection_members SET collection_id=${own}::uuid,role='owner' WHERE user_id=${a.user.id}`;
    await lock`SELECT pg_advisory_unlock(1280472986)`;
    expect((await pending).status).toBe(200);
  } finally {
    lock.release();
  }
  const invites =
    await sql`SELECT collection_id::text AS id FROM collection_invites WHERE inviter_user_id=${a.user.id} AND status='pending'`;
  expect(invites.map((invite) => invite.id)).toEqual([own]);
});
