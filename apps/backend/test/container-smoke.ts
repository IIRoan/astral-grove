import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import { z } from 'zod';
import { requireLocalTestDatabase } from './test-target';

const database = new URL(requireLocalTestDatabase(process.env.TEST_DB_URL));
database.searchParams.set('sslmode', 'disable');
const cli = process.env.CONTAINER_CLI ?? 'docker';
assert.ok(['docker', 'podman'].includes(cli));
const image = process.argv[2];
assert.ok(image, 'Provide the locally built backend image');
const listener = Bun.listen({
  hostname: '127.0.0.1',
  port: 0,
  socket: { data() {} },
});
const port = listener.port;
listener.stop(true);
const origin = `https://localhost:${port}`;
const address = `http://127.0.0.1:${port}`;
const stamp = crypto.randomUUID();
const name = `astral-grove-ci-${stamp}`;
const email = `container-${stamp}@test.riftbound.dev`;
const sql = postgres(database.toString(), { max: 1 });
const env = {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: String(port),
  DATABASE_URL: database.toString(),
  PA_API_KEY: 'ak_synthetic_container_smoke',
  PA_BASE_URL: 'http://127.0.0.1:1',
  ADMIN_SYNC_TOKEN: 'synthetic-container-admin-token',
  BETTER_AUTH_SECRET: 'synthetic-container-auth-secret-more-than-32-characters',
  BETTER_AUTH_URL: origin,
  PUBLIC_APP_URL: origin,
  CATALOG_PROBE_DISABLED: 'true',
};
function container(...args: string[]) {
  const result = spawnSync(cli, args, { encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    result.stderr || result.error?.message || `${cli} ${args[0]} failed`
  );
  return result.stdout.trim();
}
const stream = new AbortController();
let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
let created = false;
try {
  container(
    'run',
    '--detach',
    '--network',
    'host',
    '--name',
    name,
    ...Object.entries(env).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
    image
  );
  created = true;
  let healthy = false;
  for (let attempt = 0; attempt < 300; attempt++) {
    const response = await fetch(address + '/api/v1/health', {
      signal: AbortSignal.timeout(1000),
    }).catch(() => null);
    if (response?.ok) {
      healthy = true;
      break;
    }
    await Bun.sleep(100);
  }
  assert.ok(healthy, 'Production container never became healthy');
  const signup = await fetch(address + '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Container CI',
      email,
      password: 'container-password-12345',
    }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(signup.status, 200, 'Production signup failed');
  const cookies = signup.headers.getSetCookie();
  assert.ok(
    cookies.some(
      (cookie) =>
        /__Secure-better-auth\.session_token=/.test(cookie) && /; Secure/i.test(cookie)
    ),
    'Production session cookie must use the secure prefix and attribute'
  );
  const cookie = cookies.map((value) => value.split(';')[0]).join('; ');
  const session = await fetch(address + '/api/auth/get-session', {
    headers: { origin, cookie },
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(session.status, 200);
  const payload = z
    .object({ user: z.object({ email: z.string() }) })
    .parse(await session.json());
  assert.equal(payload.user.email, email);
  const events = await fetch(address + '/api/v1/collection/events', {
    headers: { origin, cookie },
    signal: stream.signal,
  });
  assert.equal(events.status, 200);
  assert.ok(events.headers.get('content-type')?.startsWith('text/event-stream'));
  assert.ok(events.body);
  reader = events.body.getReader();
  const ready = await Promise.race([
    reader.read(),
    Bun.sleep(5000).then(() => {
      throw new Error('SSE ready event timed out');
    }),
  ]);
  assert.ok(new TextDecoder().decode(ready.value).includes('event: ready'));
  const started = performance.now();
  container('stop', '--time', '5', name);
  const elapsed = performance.now() - started;
  assert.equal(container('inspect', '--format', '{{.State.ExitCode}}', name), '0');
  assert.ok(elapsed < 5500, 'Production shutdown exceeded the drain bound');
  console.log(
    `Production container passed: health, secure auth/session, SSE, SIGTERM exit 0 (${Math.round(elapsed)} ms)`
  );
} finally {
  stream.abort();
  await reader?.cancel().catch(() => {});
  if (created) {
    const logs = spawnSync(cli, ['logs', name], { encoding: 'utf8' });
    console.log(logs.stdout);
    if (logs.stderr) console.error(logs.stderr);
    container('rm', '--force', name);
  }
  await sql`DELETE FROM "user" WHERE email=${email}`.finally(() => sql.end());
}
