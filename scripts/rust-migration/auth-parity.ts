import { createApp } from '../../tests/reference-api/src/app';
import { requireLocalTestDatabase } from './test-target';
import { writeFileSync, openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
process.chdir(resolve(import.meta.dir, '../..'));
import definitions from '../../apps/backend/src/auth/request-schemas.json';
const database = requireLocalTestDatabase(process.env.TEST_DB_URL);
const port = 3188;
const origin = `http://localhost:${port}`;
const env = {
  NODE_ENV: 'test' as const,
  PORT: port,
  HOST: '127.0.0.1',
  DATABASE_URL: database,
  DB_POOL_MAX: 2,
  PA_API_KEY: 'ak_synthetic',
  PA_BASE_URL: 'http://127.0.0.1:1',
  ADMIN_SYNC_TOKEN: 'synthetic-baseline-admin',
  BETTER_AUTH_SECRET: 'synthetic-baseline-secret-more-than-32-characters',
  BETTER_AUTH_URL: origin,
  PUBLIC_APP_URL: 'http://localhost:7001',
  TRUSTED_ORIGINS: [],
  CATALOG_WARMUP_ON_START: false,
  CATALOG_PROBE_DISABLED: true,
  CARDMARKET_GAME_ID: 22,
  PRICE_HISTORY_RETAIN_DAYS: 90,
  PRICE_HISTORY_RETAIN_SNAPSHOTS: 30,
};
const ctx = createApp(env);
// Better Auth bypasses origin/CSRF checks under NODE_ENV=test; compare the real policy.
const referenceContext = await ctx.auth.$context;
referenceContext.skipOriginCheck = false;
referenceContext.skipCSRFCheck = false;
const output = openSync('/tmp/astral-auth-parity-server.log', 'w');
const rust = Bun.spawn(['target/debug/astral-grove-server'], {
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: database,
    HOST: '127.0.0.1',
    PORT: String(port),
    PA_API_KEY: env.PA_API_KEY,
    PA_BASE_URL: env.PA_BASE_URL,
    ADMIN_SYNC_TOKEN: env.ADMIN_SYNC_TOKEN,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: origin,
    PUBLIC_APP_URL: env.PUBLIC_APP_URL,
    CATALOG_PROBE_DISABLED: 'true',
  },
  stdout: output,
  stderr: output,
});
const mismatches: unknown[] = [];
let checked = 0;
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .filter(
          ([key]) =>
            !['id', 'token', 'createdAt', 'updatedAt', 'expiresAt', 'url'].includes(key)
        )
        .map(([key, value]) => [key, normalize(value)])
    );
  return value;
}
async function compare(
  label: string,
  path: string,
  method: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  const init = {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual' as const,
  };
  const old = await ctx.auth.handler(new Request(origin + '/api/auth' + path, init));
  const native = await fetch(origin + '/api/auth' + path, init);
  const read = async (response: Response) => {
    const text = await response.text();
    let body: unknown;
    try {
      body = normalize(JSON.parse(text));
    } catch {
      body = response.headers.get('content-type')?.includes('text/html')
        ? 'html'
        : text;
    }
    return {
      status: response.status,
      body,
      location: response.headers.get('location')?.replace(origin, '<origin>'),
    };
  };
  const legacy = await read(old),
    rust = await read(native);
  checked++;
  if (JSON.stringify(legacy) !== JSON.stringify(rust))
    mismatches.push({ label, path, method, legacy, rust });
}
try {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (rust.exitCode !== null) throw new Error('Rust failed to start');
    try {
      if ((await fetch(origin + '/api/v1/health')).ok) break;
    } catch {}
    await Bun.sleep(100);
  }
  for (const [name, definition] of Object.entries(definitions)) {
    if (!('path' in definition)) continue;
    const methods = Array.isArray(definition.method)
      ? definition.method
      : [definition.method];
    for (const method of methods) {
      const path = definition.path
        .replace(':id', 'google')
        .replace(':token', 'invalid');
      await compare(name + ' empty', path, method);
      if (method === 'POST') await compare(name + ' object', path, method, {});
    }
  }
  const cases: Array<[string, string, unknown]> = [
    [
      'invalid email sign-up',
      '/sign-up/email',
      { name: 'x', email: 'invalid', password: 'password-12345' },
    ],
    [
      'short password',
      '/sign-up/email',
      { name: 'x', email: 'auth-probe-missing@test.riftbound.dev', password: 'x' },
    ],
    ['bad login email', '/sign-in/email', { email: 'x', password: 'x' }],
    [
      'unknown login',
      '/sign-in/email',
      { email: 'auth-probe-missing@test.riftbound.dev', password: 'password-12345' },
    ],
    ['social disabled', '/sign-in/social', { provider: 'google' }],
    ['unknown provider', '/sign-in/social', { provider: 'xyz' }],
    [
      'OTP wrong email',
      '/email-otp/check-verification-otp',
      { email: 'invalid', type: 'sign-in', otp: '000000' },
    ],
    [
      'OTP absent',
      '/email-otp/verify-email',
      { email: 'auth-probe-missing@test.riftbound.dev', otp: '000000' },
    ],
    [
      'OTP change disabled type',
      '/email-otp/send-verification-otp',
      { email: 'auth-probe-missing@test.riftbound.dev', type: 'change-email' },
    ],
    [
      'mail disabled reset',
      '/request-password-reset',
      { email: 'auth-probe-missing@test.riftbound.dev' },
    ],
    [
      'mail disabled verify',
      '/send-verification-email',
      { email: 'auth-probe-missing@test.riftbound.dev' },
    ],
    [
      'reset absent',
      '/reset-password',
      { newPassword: 'password-12345', token: 'missing' },
    ],
    ['reset short password', '/reset-password', { newPassword: 'x', token: 'missing' }],
    ['no session token', '/get-access-token', { accountId: 'foreign' }],
    [
      'invalid callback',
      '/sign-in/email',
      {
        email: 'a@b.test',
        password: 'password-12345',
        callbackURL: 'https://evil.example/path',
      },
    ],
  ];
  for (const [label, path, body] of cases) await compare(label, path, 'POST', body);
  for (const path of [
    '/get-session?disableRefresh=false',
    '/get-session?disableCookieCache=true',
    '/verify-email?token=invalid',
    '/verify-email?token=invalid&callbackURL=%2Flogin',
    '/reset-password/invalid?callbackURL=%2Freset-password',
    '/expo-authorization-proxy?authorizationURL=https%3A%2F%2Fgoogle.com%2Fauth%3Fstate%3Dx',
    '/expo-authorization-proxy?authorizationURL=http%3A%2F%2Fgoogle.com%2Fauth',
    '/account-info?accountId=foreign',
  ])
    await compare(path, path, 'GET');
  await compare('cookie CSRF', '/sign-out', 'POST', {}, { cookie: 'x=y' });
  await compare(
    'cookie bad origin',
    '/sign-out',
    'POST',
    {},
    { cookie: 'x=y', origin: 'https://evil.example' }
  );
  await compare('same origin', '/sign-out', 'POST', {}, { cookie: 'x=y', origin });
  await compare(
    'browser login crosssite',
    '/sign-in/email',
    'POST',
    { email: 'a@b.test', password: 'password-12345' },
    { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' }
  );
  writeFileSync(
    '/tmp/astral-auth-parity-mismatches.json',
    JSON.stringify(mismatches, null, 2) + '\n'
  );
  console.log(JSON.stringify({ checked, mismatches: mismatches.length }));
  if (mismatches.length) process.exitCode = 1;
} finally {
  rust.kill('SIGTERM');
  await rust.exited;
  closeSync(output);
  await ctx.client.end();
}
