import postgres from 'postgres';
import { z } from 'zod';
import { expect } from 'bun:test';
import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireLocalTestDatabase } from './test-target';
import { seedOfflineCatalog } from './fixtures/offline';
process.env.NODE_ENV = 'test';
export const testDatabase = requireLocalTestDatabase(process.env.TEST_DB_URL);
export const password = 'test-password-12345';
export const Login = z.object({
  token: z.string().nullable(),
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
  }),
});
let catalogReady = false;
export function createHarness() {
  const sql = postgres(testDatabase, { max: 3, prepare: false });
  const children: Array<{ process: ReturnType<typeof Bun.spawn>; log: number }> = [];
  const emails: string[] = [];
  async function startServer(overrides: Record<string, string> = {}) {
    const listener = Bun.listen({
      hostname: '127.0.0.1',
      port: 0,
      socket: { data() {} },
    });
    const port = listener.port;
    listener.stop(true);
    const origin = `http://localhost:${port}`;
    const log = openSync(`/tmp/astral-test-${port}.log`, 'w');
    const config = {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabase,
      HOST: '127.0.0.1',
      PORT: String(port),
      PA_API_KEY: 'ak_synthetic_test',
      PA_BASE_URL: 'http://127.0.0.1:1',
      ADMIN_SYNC_TOKEN: 'synthetic-admin-token',
      BETTER_AUTH_SECRET: 'synthetic-auth-secret-more-than-32-characters',
      BETTER_AUTH_URL: origin,
      PUBLIC_APP_URL: 'http://localhost:7001',
      CATALOG_PROBE_DISABLED: 'true',
      ...overrides,
    };
    const process = Bun.spawn(
      [
        globalThis.process.env.ASTRAL_BACKEND_BIN ??
          resolve(import.meta.dir, '../../../target/debug/astral-grove-server'),
      ],
      { env: config, stdout: log, stderr: log }
    );
    children.push({ process, log });
    for (let attempt = 0; attempt < 300; attempt++) {
      if (process.exitCode !== null)
        throw new Error(`Server failed; log /tmp/astral-test-${port}.log`);
      const health = await fetch(origin + '/api/v1/health').catch(() => null);
      if (health?.ok) {
        if (!catalogReady) {
          await seedOfflineCatalog(sql);
          catalogReady = true;
        }
        return {
          origin,
          pid: process.pid,
          config,
          logPath: `/tmp/astral-test-${port}.log`,
          fetch: (path: string, options: RequestInit = {}) =>
            fetch(origin + path, {
              ...options,
              headers: { origin, ...options.headers },
            }),
        };
      }
      await Bun.sleep(100);
    }
    throw new Error('Server did not start');
  }
  async function signup(app: Awaited<ReturnType<typeof startServer>>, label: string) {
    const email = `test-${label}-${crypto.randomUUID()}@test.riftbound.dev`;
    emails.push(email);
    const response = await app.fetch(
      '/api/auth/sign-up/email',
      json({ name: label, email, password })
    );
    expect(response.status).toBe(200);
    return { ...Login.parse(await response.json()), email, cookie: cookie(response) };
  }
  async function stopServer() {
    let failure: string | undefined;
    for (const child of children) {
      child.process.kill('SIGTERM');
      await Promise.race([child.process.exited, Bun.sleep(5000)]);
      if (child.process.exitCode === null) {
        failure = 'Server did not drain within five seconds after SIGTERM';
        child.process.kill('SIGKILL');
        await child.process.exited;
      }
      if (child.process.exitCode !== 0)
        failure ??= 'Server did not exit cleanly after SIGTERM';
      closeSync(child.log);
    }
    children.length = 0;
    if (emails.length)
      await sql`DELETE FROM "user" WHERE email=ANY(${emails.splice(0)})`;
    await sql.end();
    if (failure) throw new Error(failure);
  }
  return { sql, startServer, stopServer, signup };
}
export function json(body: unknown, cookie?: string): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  };
}
export function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}

export async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeoutMs = 5000
) {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (await check()) return;
    await Bun.sleep(20);
  }
  throw new Error('Condition did not become true');
}

export async function runCommand(config: Record<string, string>, args: string[]) {
  const binary =
    process.env.ASTRAL_BACKEND_BIN ??
    resolve(import.meta.dir, '../../../target/debug/astral-grove-server');
  const child = Bun.spawn([binary, ...args], {
    env: { ...config, TEST_DB_URL: testDatabase },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, output, errors] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, output, errors };
}
