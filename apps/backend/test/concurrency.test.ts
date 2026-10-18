import { afterAll, beforeAll, expect, test, setDefaultTimeout } from 'bun:test';
import { createHarness, json, cookie } from './support';
const { startRust, stopRust, sql } = createHarness();
import { CollectionShareInviteCreateResponse } from '@riftbound/contracts';
setDefaultTimeout(60000);
let app: Awaited<ReturnType<typeof startRust>>;
const users: Array<{ id: string; cookie: string }> = [];
const stamp = crypto.randomUUID();
beforeAll(async () => {
  app = await startRust();
  for (let index = 0; index < 3; index++) {
    const response = await app.fetch(
      '/api/auth/sign-up/email',
      json({
        name: 'Concurrent test',
        email: `native-race-${index}-${stamp}@test.riftbound.dev`,
        password: 'concurrent-test-password-123',
      })
    );
    expect(response.status).toBe(200);
    users.push({ id: (await response.json()).user.id, cookie: cookie(response) });
  }
});
afterAll(async () => {
  await sql`DELETE FROM "user" WHERE id=ANY(${users.map((u) => u.id)})`;
  await stopRust();
});
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
