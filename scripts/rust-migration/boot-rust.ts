import { openSync, closeSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireLocalTestDatabase } from './test-target';
const database = requireLocalTestDatabase(process.env.TEST_DB_URL);
const port = 3187;
const log = openSync('/tmp/astral-rust-fresh-migration.log', 'w');
const server = Bun.spawn(
  [resolve(import.meta.dir, '../../target/debug/astral-grove-server')],
  {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: database,
      HOST: '127.0.0.1',
      PORT: String(port),
      PA_API_KEY: 'ak_migration_no_network',
      ADMIN_SYNC_TOKEN: 'migration-synthetic-admin',
      BETTER_AUTH_SECRET: 'migration-synthetic-secret-more-than-32-characters',
      BETTER_AUTH_URL: `http://localhost:${port}`,
      PUBLIC_APP_URL: 'http://localhost:7001',
      CATALOG_PROBE_DISABLED: 'true',
    },
    stdout: log,
    stderr: log,
  }
);
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null)
      throw new Error('Rust startup failed; see /tmp/astral-rust-fresh-migration.log');
    try {
      const response = await fetch(`http://localhost:${port}/api/v1/health`);
      const body = await response.json();
      if (response.ok && body.data.db === 'ok') {
        ready = true;
        break;
      }
    } catch {}
    await Bun.sleep(100);
  }
  if (!ready) throw new Error('Rust health did not become ready');
  console.log('Rust startup and database health passed');
} finally {
  server.kill('SIGTERM');
  await Promise.race([server.exited, Bun.sleep(5000)]);
  if (server.exitCode === null) {
    server.kill('SIGKILL');
    await server.exited;
  }
  closeSync(log);
}
