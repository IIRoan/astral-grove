import postgres from 'postgres';
import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireLocalTestDatabase } from '../../../scripts/rust-migration/test-target';
import { seedOfflineCatalog } from '../../../tests/reference-api/test/e2e/offline';
process.env.NODE_ENV = 'test';
export const testDatabase = requireLocalTestDatabase(process.env.TEST_DB_URL);
let catalogReady = false;
export function createHarness() {
  const sql = postgres(testDatabase, { max: 3, prepare: false });
  const children: Array<{ process: ReturnType<typeof Bun.spawn>; log: number }> = [];
  async function startRust(overrides: Record<string, string> = {}) {
    const listener = Bun.listen({
      hostname: '127.0.0.1',
      port: 0,
      socket: { data() {} },
    });
    const port = listener.port;
    listener.stop(true);
    const origin = `http://localhost:${port}`;
    const log = openSync(`/tmp/astral-native-test-${port}.log`, 'w');
    const config = {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabase,
      HOST: '127.0.0.1',
      PORT: String(port),
      PA_API_KEY: 'ak_synthetic_native_test',
      PA_BASE_URL: 'http://127.0.0.1:1',
      ADMIN_SYNC_TOKEN: 'synthetic-native-admin-token',
      BETTER_AUTH_SECRET: 'synthetic-native-auth-secret-more-than-32-characters',
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
        throw new Error(`Rust failed; log /tmp/astral-native-test-${port}.log`);
      const health = await fetch(origin + '/api/v1/health').catch(() => null);
      if (health?.ok) {
        if (!catalogReady) {
          await seedOfflineCatalog(sql);
          catalogReady = true;
        }
        return {
          origin,
          config,
          logPath: `/tmp/astral-native-test-${port}.log`,
          fetch: (path: string, options: RequestInit = {}) =>
            fetch(origin + path, {
              ...options,
              headers: { origin, ...options.headers },
            }),
        };
      }
      await Bun.sleep(100);
    }
    throw new Error('Rust did not start');
  }
  async function stopRust() {
    let failure: string | undefined;
    for (const child of children) {
      child.process.kill('SIGTERM');
      await Promise.race([child.process.exited, Bun.sleep(5000)]);
      if (child.process.exitCode === null) {
        failure = 'Rust did not drain within five seconds after SIGTERM';
        child.process.kill('SIGKILL');
        await child.process.exited;
      }
      if (child.process.exitCode !== 0)
        failure ??= 'Rust did not exit cleanly after SIGTERM';
      closeSync(child.log);
    }
    children.length = 0;
    await sql.end();
    if (failure) throw new Error(failure);
  }
  return { sql, startRust, stopRust };
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

export async function runNativeCommand(config: Record<string, string>, args: string[]) {
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
