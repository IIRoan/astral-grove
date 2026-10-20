import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import { z } from 'zod';
import { createHmac, scryptSync } from 'node:crypto';
import { startJmapFixture } from './fixtures/jmap';
import { createHarness, json, cookie, Login, password, waitFor } from './support';
const harness = createHarness();
const { startServer, stopServer, sql } = harness;
setDefaultTimeout(60000);
const stamp = crypto.randomUUID();
const addresses: string[] = [];
const betterAuthHash =
  '66cc3e330c9d14d6765e69edfdc48b8e:a5b6c4dfb0ddd98b26910785d3fd548c97bd8b85a3273e6e7df884cf612935155533e9aa79ce65c4cc200b4181108e8320d6822306e0a07a6568958163ac2d19';
let app: Awaited<ReturnType<typeof startServer>>;
const signup = (label: string, server = app) =>
  harness.signup(server, `${label}-${stamp}`);
beforeAll(async () => {
  app = await startServer();
});
afterAll(async () => {
  await sql`DELETE FROM "user" WHERE email=ANY(${addresses})`;
  await sql`DELETE FROM verification WHERE identifier LIKE ${`%${stamp}%`}`;
  await stopServer();
});
describe('authentication', () => {
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
  test('existing Better Auth hashes and signed cookies keep working', async () => {
    const sign = (token: string) =>
      `${token}.${createHmac('sha256', app.config.BETTER_AUTH_SECRET).update(token).digest('base64')}`;
    const email = `test-legacy-${stamp}@test.riftbound.dev`;
    addresses.push(email);
    const userId = crypto.randomUUID();
    await sql`INSERT INTO "user"(id,name,email) VALUES(${userId},'Legacy account',${email})`;
    await sql`INSERT INTO account(id,account_id,provider_id,user_id,password) VALUES(${crypto.randomUUID()},${userId},'credential',${userId},${betterAuthHash})`;
    const login = await app.fetch('/api/auth/sign-in/email', json({ email, password }));
    expect(login.status).toBe(200);
    expect(Login.parse(await login.json()).user.id).toBe(userId);
    const token = crypto.randomUUID().replaceAll('-', '');
    await sql`INSERT INTO session(id,token,user_id,expires_at) VALUES(${crypto.randomUUID()},${token},${userId},now()+interval '7 days')`;
    const session = await app.fetch('/api/auth/get-session', {
      headers: {
        cookie: `better-auth.session_token=${encodeURIComponent(sign(token))}`,
      },
    });
    expect(session.status).toBe(200);
    expect((await session.json()).user.email).toBe(email);
    const created = await signup('reverse');
    const [stored] = await sql<
      { password: string }[]
    >`SELECT password FROM account WHERE user_id=${created.user.id} AND provider_id='credential'`;
    const [salt, key] = stored!.password.split(':');
    expect(
      scryptSync(password.normalize('NFKC'), salt!, 64, {
        N: 16384,
        r: 16,
        p: 1,
        maxmem: 128 * 16384 * 16 * 2,
      }).toString('hex')
    ).toBe(key!);
    const [name, value] = created.cookie.split('; ')[0]!.split('=');
    expect(name).toBe('better-auth.session_token');
    expect(decodeURIComponent(value!)).toBe(sign(created.token!));
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
    const locked = Promise.withResolvers<void>();
    const unblock = Promise.withResolvers<void>();
    let blockerPid = 0;
    const revoke = sql.begin(async (transaction) => {
      const rows =
        await transaction`SELECT id,pg_backend_pid() AS pid FROM session WHERE token=${user.token} FOR UPDATE`;
      blockerPid = rows[0]!.pid;
      locked.resolve();
      await unblock.promise;
      await transaction`DELETE FROM session WHERE token=${user.token}`;
    });
    await locked.promise;
    const request = app.fetch('/api/v1/collection', {
      headers: { cookie: user.cookie },
    });
    try {
      await waitFor(
        async () =>
          (
            await sql`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${blockerPid}=ANY(pg_blocking_pids(pid))) AS waiting`
          )[0]!.waiting
      );
      unblock.resolve();
      await revoke;
      expect((await request).status).toBe(401);
      expect(await sql`SELECT id FROM session WHERE token=${user.token}`).toHaveLength(
        0
      );
    } finally {
      unblock.resolve();
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
          newPassword: 'new-test-password-67890',
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
          json({ email: user.email, password: 'new-test-password-67890' })
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
    expect(exhausted.status).toBe(400);
    expect((await exhausted.json()).code).toBe('INVALID_OTP');
    await sql`DELETE FROM verification WHERE identifier=${`otp-attempts:${identifier}`}`;
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
    await sql`DELETE FROM verification WHERE identifier=${`otp-attempts:${identifier}`}`;
    await sql`INSERT INTO verification(id,identifier,value,expires_at) VALUES(${crypto.randomUUID()},${identifier},'654321:0',now()-interval '1 minute')`;
    const expired = await app.fetch(
      '/api/auth/email-otp/verify-email',
      json({ email: user.email, otp: '654321' })
    );
    expect((await expired.json()).code).toBe('INVALID_OTP');
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
  test('JMAP signup, verify, password reset and email change work through HTTP', async () => {
    const mail = startJmapFixture();
    mail.failDiscovery();
    try {
      const server = await startServer({
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
      expect(text()).toContain('http://localhost:7001/verify-email?');
      expect(text()).not.toContain('astral-grove://');
      const verified = await server.fetch(
        '/api/auth/email-otp/verify-email',
        json({ email: user.email, otp })
      );
      expect(verified.status).toBe(200);
      expect(cookie(verified)).toBe('');
      const verifiedBody = Login.parse(await verified.json());
      expect(verifiedBody.user.emailVerified).toBe(true);
      expect(verifiedBody.token).toBeNull();
      const signedIn = await server.fetch(
        '/api/auth/sign-in/email',
        json({ email: user.email, password })
      );
      expect(signedIn.status).toBe(200);
      const signed = cookie(signedIn);
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
      const newEmail = `test-new-mail-${stamp}@test.riftbound.dev`;
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
    } finally {
      mail.stop();
    }
  });
});
