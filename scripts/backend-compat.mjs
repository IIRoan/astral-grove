import { readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const cwd = resolve(root, 'tests/reference-api');
const report = join(tmpdir(), `astral-native-compat-${crypto.randomUUID()}.xml`);
const files = readdirSync(resolve(cwd, 'test/e2e'))
  .filter((file) => file.endsWith('.test.ts') && file !== 'migration-baseline.test.ts')
  .map((file) => 'test/e2e/' + file);
if (!process.env.ASTRAL_BACKEND_BIN) {
  const build = spawnSync(
    'cargo',
    ['build', '--package', 'astral-grove-server', '--bins', '--locked'],
    { cwd: root, stdio: 'inherit' }
  );
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const env = { ...process.env, E2E_BACKEND: 'rust', NODE_ENV: 'test' };
if (!env.E2E_PORT) {
  const listener = Bun.listen({
    hostname: '127.0.0.1',
    port: 0,
    socket: { data() {} },
  });
  env.E2E_PORT = String(listener.port);
  listener.stop(true);
}
const result = spawnSync(
  process.execPath,
  [
    '--no-env-file',
    'test',
    '--reporter=junit',
    `--reporter-outfile=${report}`,
    '--preload',
    './test/e2e/preload.ts',
    '--max-concurrency=1',
    ...files,
  ],
  {
    cwd,
    env,
    stdio: 'inherit',
  }
);
if (result.status === 0) {
  const check = spawnSync(
    process.execPath,
    [
      '--no-env-file',
      'scripts/rust-migration/test-destinations.ts',
      '--tier',
      'e2e',
      '--report',
      report,
    ],
    { cwd: root, stdio: 'inherit' }
  );
  process.exitCode = check.status ?? 1;
} else process.exitCode = result.status ?? 1;
rmSync(report, { force: true });
