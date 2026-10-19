import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { createAuth } from '../../../tests/reference-api/src/auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../../tests/reference-api/src/db/schema';
import * as authSchema from '../../../tests/reference-api/src/db/auth-schema';
import { startJmapFixture } from '../../../tests/reference-api/test/fixtures/migration/jmap';
import { createHarness, json, cookie } from './support';
const { startRust, stopRust, sql } = createHarness();
setDefaultTimeout(60000);
const stamp = crypto.randomUUID();
const addresses: string[] = [];
const password = 'native-password-12345';
let app: Awaited<ReturnType<typeof startRust>>;
const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
});
const Login = z.object({ token: z.string().nullable(), user: User });
async function signup(label: string, server = app) {
  const email = `native-${label}-${stamp}@test.riftbound.dev`;
  addresses.push(email);
  const response = await server.fetch(
    '/api/auth/sign-up/email',
    json({ name: label, email, password })
  );
  expect(response.status).toBe(200);
  return { ...Login.parse(await response.json()), email, cookie: cookie(response) };
}
beforeAll(async () => {
  app = await startRust();
});
afterAll(async () => {
  await sql`DELETE FROM "user" WHERE email=ANY(${addresses})`;
  await sql`DELETE FROM verification WHERE identifier LIKE ${`%${stamp}%`}`;
  await stopRust();
});
describe('native authentication', () => {
  test('revoking a session closes its collection live stream before another event is delivered', async () => {
    const user = await signup('live-revocation');
    const login = await app.fetch(
      '/api/auth/sign-in/email',
      json({ email: user.email, password })
    );
    expect(login.status).toBe(200);
    const current = cookie(login),
      controller = new AbortController();
    const events = await app.fetch('/api/v1/collection/events', {
      headers: { cookie: user.cookie },
      signal: controller.signal,
    });
    const reader = events.body!.getReader();
    try {
      expect(new TextDecoder().decode((await reader.read()).value)).toContain(
        'event: ready'
      );
      expect(
        (await app.fetch('/api/auth/sign-out', json({}, user.cookie))).status
      ).toBe(200);
      const ended = reader.read();
      expect(
        (await app.fetch('/api/v1/collection/OGN-001/add', json({}, current))).status
      ).toBe(200);
      const next = await Promise.race([
        ended,
        Bun.sleep(2000).then(() => {
          throw new Error('Revoked session stream remained open');
        }),
      ]);
      expect(next.done).toBe(true);
    } finally {
      controller.abort();
      await reader.cancel().catch(() => {});
    }
  });
  test('existing Better Auth hashes and signed cookies work in both runtimes', async () => {
    const old = createAuth(drizzle(sql, { schema: { ...schema, ...authSchema } }), {
      ...app.config,
      NODE_ENV: 'test',
      PORT: Number(app.config.PORT),
      DB_POOL_MAX: 2,
      TRUSTED_ORIGINS: [],
      CATALOG_WARMUP_ON_START: false,
      CATALOG_PROBE_DISABLED: true,
      CARDMARKET_GAME_ID: 22,
      PRICE_HISTORY_RETAIN_DAYS: 90,
      PRICE_HISTORY_RETAIN_SNAPSHOTS: 30,
    });
    const email = `native-legacy-${stamp}@test.riftbound.dev`;
    addresses.push(email);
    const response = await old.handler(
      new Request(
        app.origin + '/api/auth/sign-up/email',
        json({ email, name: 'Legacy account', password })
      )
    );
    expect(response.status).toBe(200);
    const oldCookie = cookie(response);
    const session = await app.fetch('/api/auth/get-session', {
      headers: { cookie: oldCookie },
    });
    expect(session.status).toBe(200);
    expect((await session.json()).user.email).toBe(email);
    const login = await app.fetch('/api/auth/sign-in/email', json({ email, password }));
    expect(login.status).toBe(200);
    const native = await signup('reverse');
    const legacy = await old.handler(
      new Request(
        app.origin + '/api/auth/sign-in/email',
        json({ email: native.email, password })
      )
    );
    expect(legacy.status).toBe(200);
    const nativeCookie = await old.handler(
      new Request(app.origin + '/api/auth/get-session', {
        headers: { cookie: native.cookie },
      })
    );
    expect((await nativeCookie.json()).user.id).toBe(native.user.id);
  });
  test('session refresh, disableRefresh and dont-remember retain the configured lifetimes', async () => {
    const user = await signup('renewal');
    await sql`UPDATE session SET expires_at=now()+interval '5 days' WHERE token=${user.token}`;
    const noRefresh = await app.fetch('/api/auth/get-session?disableRefresh=true', {
      headers: { cookie: user.cookie },
    });
    const first = await noRefresh.json();
    expect(Date.parse(first.session.expiresAt) - Date.now()).toBeLessThan(6 * 86400000);
    const refreshed = await app.fetch('/api/auth/get-session', {
      headers: { cookie: user.cookie },
    });
    const next = await refreshed.json();
    expect(Date.parse(next.session.expiresAt) - Date.now()).toBeGreaterThan(
      6 * 86400000
    );
    expect(
      refreshed.headers.getSetCookie().some((v) => v.includes('Max-Age=604800'))
    ).toBe(true);
    const short = await app.fetch(
      '/api/auth/sign-in/email',
      json({ email: user.email, password, rememberMe: false })
    );
    const shortCookie = cookie(short);
    expect(shortCookie).toContain('dont_remember');
    const login = Login.parse(await short.json());
    await sql`UPDATE session SET expires_at=now()+interval '12 hours' WHERE token=${login.token}`;
    const shortSession = await app.fetch('/api/auth/get-session', {
      headers: { cookie: shortCookie },
    });
    expect(
      Date.parse((await shortSession.json()).session.expiresAt) - Date.now()
    ).toBeLessThan(86400000);
  });
  test('protected routes renew aging cookie and bearer sessions while honoring dont-remember', async () => {
    const user = await signup('protected-renewal');
    const credentials: Record<string, string>[] = [
      { cookie: user.cookie },
      { authorization: `Bearer ${user.token}` },
    ];
    for (const headers of credentials) {
      await sql`UPDATE session SET expires_at=now()+interval '1 day',updated_at=now()-interval '6 days' WHERE token=${user.token}`;
      expect((await app.fetch('/api/v1/collection', { headers })).status).toBe(200);
      const rows =
        await sql`SELECT extract(epoch FROM expires_at-now())::integer AS remaining FROM session WHERE token=${user.token}`;
      expect(rows[0]!.remaining).toBeGreaterThan(6 * 86400);
    }
    const short = await app.fetch(
      '/api/auth/sign-in/email',
      json({ email: user.email, password, rememberMe: false })
    );
    const headers = { cookie: cookie(short) };
    const login = Login.parse(await short.json());
    await sql`UPDATE session SET expires_at=now()+interval '12 hours' WHERE token=${login.token}`;
    expect((await app.fetch('/api/v1/collection', { headers })).status).toBe(200);
    const rows =
      await sql`SELECT extract(epoch FROM expires_at-now())::integer AS remaining FROM session WHERE token=${login.token}`;
    expect(rows[0]!.remaining).toBeLessThan(86400);
  });
  test('concurrent protected requests renew once and expired sessions stay expired', async () => {
    const user = await signup('concurrent-renewal');
    await sql`UPDATE session SET expires_at=now()+interval '1 day' WHERE token=${user.token}`;
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } })
      )
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    const refreshed = (
      await sql`SELECT expires_at,updated_at FROM session WHERE token=${user.token}`
    )[0]!;
    expect(new Date(refreshed.expires_at).getTime() - Date.now()).toBeGreaterThan(
      6 * 86400000
    );
    expect(
      (await app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } }))
        .status
    ).toBe(200);
    const unchanged = (
      await sql`SELECT expires_at,updated_at FROM session WHERE token=${user.token}`
    )[0]!;
    expect(unchanged).toEqual(refreshed);
    await sql`UPDATE session SET expires_at=now()-interval '1 second' WHERE token=${user.token}`;
    expect(
      (await app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } }))
        .status
    ).toBe(401);
    expect(
      (
        await sql`SELECT expires_at<now() AS expired FROM session WHERE token=${user.token}`
      )[0]!.expired
    ).toBe(true);
  });
  test('revocation during renewal cannot resurrect or authorize the deleted session', async () => {
    const user = await signup('revoked-renewal');
    await sql`UPDATE session SET expires_at=now()+interval '1 day' WHERE token=${user.token}`;
    let release = () => {};
    let locked = () => {};
    const ready = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const unblock = new Promise<void>((resolve) => {
      release = resolve;
    });
    let blockerPid = 0;
    const revoke = sql.begin(async (transaction) => {
      const rows =
        await transaction`SELECT id,pg_backend_pid() AS pid FROM session WHERE token=${user.token} FOR UPDATE`;
      blockerPid = rows[0]!.pid;
      locked();
      await unblock;
      await transaction`DELETE FROM session WHERE token=${user.token}`;
    });
    await ready;
    const request = app.fetch('/api/v1/collection', {
      headers: { cookie: user.cookie },
    });
    try {
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows =
          await sql`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${blockerPid}=ANY(pg_blocking_pids(pid))) AS waiting`;
        if (rows[0]!.waiting) {
          waiting = true;
          break;
        }
        await Bun.sleep(20);
      }
      expect(waiting).toBe(true);
      release();
      await revoke;
      expect((await request).status).toBe(401);
      expect(await sql`SELECT id FROM session WHERE token=${user.token}`).toHaveLength(
        0
      );
    } finally {
      release();
      await revoke;
      await request;
    }
  });
  test('session revocation and account access always use the authenticated owner', async () => {
    const a = await signup('owner-a'),
      b = await signup('owner-b');
    const account = (await sql`SELECT id FROM account WHERE user_id=${a.user.id}`)[0];
    if (!account) throw new Error('Missing credential fixture');
    const foreign = await app.fetch(
      '/api/auth/get-access-token',
      json({ accountId: account.id, userId: a.user.id }, b.cookie)
    );
    expect(foreign.status).toBe(400);
    expect((await foreign.json()).code).toBe('ACCOUNT_NOT_FOUND');
    await app.fetch('/api/auth/revoke-session', json({ token: a.token }, b.cookie));
    expect(
      (
        await (
          await app.fetch('/api/auth/get-session', { headers: { cookie: a.cookie } })
        ).json()
      ).user.id
    ).toBe(a.user.id);
    await app.fetch('/api/auth/revoke-sessions', json({}, a.cookie));
    expect(
      await (
        await app.fetch('/api/auth/get-session', { headers: { cookie: a.cookie } })
      ).json()
    ).toBeNull();
  });
  test('password changes revoke other sessions and never permit profile privilege injection', async () => {
    const user = await signup('password');
    const changed = await app.fetch(
      '/api/auth/change-password',
      json(
        {
          currentPassword: password,
          newPassword: 'new-native-password-67890',
          revokeOtherSessions: true,
        },
        user.cookie
      )
    );
    expect(changed.status).toBe(200);
    const currentCookie = cookie(changed);
    expect(
      await (
        await app.fetch('/api/auth/get-session', { headers: { cookie: user.cookie } })
      ).json()
    ).toBeNull();
    const update = await app.fetch(
      '/api/auth/update-user',
      json(
        { name: 'Updated', emailVerified: true, id: 'foreign', image: null },
        currentCookie
      )
    );
    expect(update.status).toBe(200);
    const session = await (
      await app.fetch('/api/auth/get-session', { headers: { cookie: currentCookie } })
    ).json();
    expect(session.user.id).toBe(user.user.id);
    expect(session.user.emailVerified).toBe(false);
    expect(session.user.name).toBe('Updated');
    expect(
      (
        await app.fetch(
          '/api/auth/sign-in/email',
          json({ email: user.email, password })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await app.fetch(
          '/api/auth/sign-in/email',
          json({ email: user.email, password: 'new-native-password-67890' })
        )
      ).status
    ).toBe(200);
  });
  test('OTP attempts, expiry and concurrent one-time consumption are enforced', async () => {
    const user = await signup('otp');
    const identifier = `email-verification-otp-${user.email}`;
    await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${identifier},'123456:0',now()+interval '5 minutes')`;
    for (let attempt = 0; attempt < 3; attempt++)
      expect(
        (
          await app.fetch(
            '/api/auth/email-otp/verify-email',
            json({ email: user.email, otp: 'wrong' })
          )
        ).status
      ).toBe(400);
    const exhausted = await app.fetch(
      '/api/auth/email-otp/verify-email',
      json({ email: user.email, otp: '123456' })
    );
    expect(exhausted.status).toBe(403);
    await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${identifier},'654321:0',now()+interval '5 minutes')`;
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.fetch(
          '/api/auth/email-otp/verify-email',
          json({ email: user.email, otp: '654321' })
        )
      )
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 400)).toHaveLength(7);
    await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${identifier},'654321:0',now()-interval '1 minute')`;
    const expired = await app.fetch(
      '/api/auth/email-otp/verify-email',
      json({ email: user.email, otp: '654321' })
    );
    expect((await expired.json()).code).toBe('OTP_EXPIRED');
  });
  test('fresh-session guards reject old sessions and reset tokens remain server-only', async () => {
    const user = await signup('fresh');
    await sql`UPDATE session SET created_at=now()-interval '2 days' WHERE token=${user.token}`;
    expect(
      (await app.fetch('/api/auth/list-sessions', { headers: { cookie: user.cookie } }))
        .status
    ).toBe(403);
    for (const path of [
      '/set-password',
      '/email-otp/create-verification-otp',
      '/email-otp/get-verification-otp',
    ])
      expect(
        (
          await app.fetch(
            '/api/auth' + path,
            json({ email: user.email, type: 'sign-in' })
          )
        ).status
      ).toBe(404);
  });
  test('JMAP signup, verify, password reset and email change work through Rust HTTP', async () => {
    const mail = startJmapFixture();
    mail.failDiscovery();
    try {
      const server = await startRust({
        STALWART_JMAP_URL: mail.url,
        STALWART_JMAP_USERNAME: 'fixture',
        STALWART_JMAP_PASSWORD: 'fixture',
        EMAIL_FROM: 'noreply@test.riftbound.dev',
      });
      const user = await signup('mail', server);
      expect(user.token).toBeNull();
      expect(user.cookie).toBe('');
      expect(mail.messages).toHaveLength(1);
      const text = () =>
        z
          .object({ bodyValues: z.object({ text: z.object({ value: z.string() }) }) })
          .parse(mail.messages.at(-1)).bodyValues.text.value;
      const otp = text().match(/Verification code: (\d{6})/)?.[1];
      expect(otp).toBeDefined();
      expect(text()).toContain('astral-grove://verify-email?');
      const verified = await server.fetch(
        '/api/auth/email-otp/verify-email',
        json({ email: user.email, otp })
      );
      expect(verified.status).toBe(200);
      const signed = cookie(verified);
      expect(Login.parse(await verified.json()).user.emailVerified).toBe(true);
      const mails = mail.messages.length;
      const duplicate = await server.fetch(
        '/api/auth/sign-up/email',
        json({
          name: 'Synthetic name',
          email: user.email,
          password: 'different-password-99999',
        })
      );
      const synthetic = Login.parse(await duplicate.json());
      expect(duplicate.status).toBe(200);
      expect(synthetic.token).toBeNull();
      expect(synthetic.user.emailVerified).toBe(false);
      expect(synthetic.user.name).toBe('Synthetic name');
      expect(synthetic.user.id).not.toBe(user.user.id);
      expect(mail.messages.length).toBe(mails);

      const requested = await server.fetch(
        '/api/auth/request-password-reset',
        json({ email: user.email, redirectTo: 'http://localhost:7001/reset-password' })
      );
      expect(requested.status).toBe(200);
      const resetToken = text().match(/[?&]token=([^&\s]+)/)?.[1];
      expect(resetToken).toBeDefined();
      const reset = await server.fetch(
        '/api/auth/reset-password',
        json({ token: resetToken, newPassword: 'reset-password-12345' })
      );
      expect(reset.status).toBe(200);
      expect(
        await (
          await server.fetch('/api/auth/get-session', { headers: { cookie: signed } })
        ).json()
      ).toBeNull();
      expect(
        (
          await server.fetch(
            '/api/auth/reset-password',
            json({ token: resetToken, newPassword: 'reset-password-12345' })
          )
        ).status
      ).toBe(400);
      const login = await server.fetch(
        '/api/auth/sign-in/email',
        json({ email: user.email, password: 'reset-password-12345' })
      );
      expect(login.status).toBe(200);
      const current = cookie(login);
      const newEmail = `native-new-mail-${stamp}@test.riftbound.dev`;
      addresses.push(newEmail);
      expect(
        (
          await server.fetch(
            '/api/auth/email-otp/request-email-change',
            json({ newEmail }, current)
          )
        ).status
      ).toBe(200);
      const change = text().match(/Verification code: (\d{6})/)?.[1];
      expect(
        (
          await server.fetch(
            '/api/auth/email-otp/change-email',
            json({ newEmail, otp: change }, current)
          )
        ).status
      ).toBe(200);
      expect(
        (
          await (
            await server.fetch('/api/auth/get-session', {
              headers: { cookie: current },
            })
          ).json()
        ).user.email
      ).toBe(newEmail);

      const pending = await signup('jwt', server);
      const sign = (payload: unknown) => {
        const header = Buffer.from(
            JSON.stringify({ alg: 'HS256', typ: 'JWT' })
          ).toString('base64url'),
          body = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signed = header + '.' + body;
        return (
          signed +
          '.' +
          createHmac('sha256', server.config.BETTER_AUTH_SECRET)
            .update(signed)
            .digest('base64url')
        );
      };
      const token = sign({
        email: pending.email,
        exp: Math.floor(Date.now() / 1000) + 300,
      });
      const proof = await server.fetch('/api/auth/verify-email?token=' + token, {
        headers: { cookie: current },
      });
      expect(proof.status).toBe(200);
      expect(await proof.json()).toEqual({ status: true, user: null });
      const switched = await (
        await server.fetch('/api/auth/get-session', {
          headers: { cookie: cookie(proof) },
        })
      ).json();
      expect(switched.user.id).toBe(pending.user.id);
      const expired = await server.fetch(
        '/api/auth/verify-email?token=' + sign({ email: pending.email, exp: 1 })
      );
      expect(expired.status).toBe(401);
      expect((await expired.json()).code).toBe('TOKEN_EXPIRED');
      const future = await server.fetch(
        '/api/auth/verify-email?token=' +
          sign({ email: pending.email, nbf: Math.floor(Date.now() / 1000) + 3600 })
      );
      expect(future.status).toBe(401);
    } finally {
      mail.stop();
    }
  });
});
