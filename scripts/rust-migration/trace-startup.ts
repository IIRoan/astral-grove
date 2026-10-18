import { openSync, closeSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { requireLocalTestDatabase } from './test-target';
const database = requireLocalTestDatabase(process.env.TEST_DB_URL);
const root = resolve(import.meta.dir, '../..');
const env = {
  NODE_ENV: 'test',
  DATABASE_URL: database,
  PORT: '3287',
  HOST: '127.0.0.1',
  PA_API_KEY: 'ak_synthetic',
  ADMIN_SYNC_TOKEN: 'synthetic-startup-admin',
  BETTER_AUTH_SECRET: 'synthetic-startup-secret-more-than-32-characters',
  BETTER_AUTH_URL: 'http://localhost:3287',
  PUBLIC_APP_URL: 'http://localhost:7001',
  CATALOG_PROBE_DISABLED: 'true',
  BASELINE_TRACE_ON_EXIT: 'true',
  BASELINE_TRACE_OUTPUT: '/tmp/astral-baseline-startup-functions.json',
};
async function stop(child: ReturnType<typeof Bun.spawn>) {
  child.kill('SIGTERM');
  await Promise.race([child.exited, Bun.sleep(5000)]);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await child.exited;
  }
}
const log = openSync('/tmp/astral-ts-startup.log', 'w');
const command = [
  process.execPath,
  '--no-env-file',
  '--preload',
  resolve(root, 'tests/reference-api/test/e2e/trace-plugin.ts'),
  resolve(root, 'tests/reference-api/src/index.ts'),
];
const child = Bun.spawn(command, { cwd: root, env, stdout: log, stderr: log });
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw new Error('Legacy startup failed');
    try {
      if ((await fetch('http://localhost:3287/api/v1/health')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await Bun.sleep(100);
  }
  if (!ready) throw new Error('Legacy startup health failed');
} finally {
  await stop(child);
  closeSync(log);
}
const proxy = createServer((socket) => socket.destroy());
await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const address = proxy.address();
if (!address || typeof address === 'string') throw new Error('Missing proxy address');
const url = new URL(database);
url.port = String(address.port);
const retryLog = '/tmp/astral-ts-startup-retry.log';
const retryFd = openSync(retryLog, 'w');
const retry = Bun.spawn(command, {
  cwd: root,
  env: {
    ...env,
    DATABASE_URL: url.toString(),
    BASELINE_TRACE_OUTPUT: '/tmp/astral-baseline-startup-retry-functions.json',
  },
  stdout: retryFd,
  stderr: retryFd,
});
try {
  let retried = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (readFileSync(retryLog, 'utf8').includes('retrying')) {
      retried = true;
      break;
    }
    if (retry.exitCode !== null) break;
    await Bun.sleep(100);
  }
  if (!retried) throw new Error('Transient startup retry was not observed');
} finally {
  await stop(retry);
  closeSync(retryFd);
  proxy.close();
}
console.log(
  'Legacy startup, graceful signal handling, and transient migration retry exercised'
);
