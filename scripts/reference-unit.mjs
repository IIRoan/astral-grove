import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
const root = resolve(import.meta.dirname, '..');
const report = join(tmpdir(), `astral-reference-unit-${crypto.randomUUID()}.xml`);
try {
  const result = spawnSync(
    process.execPath,
    [
      '--no-env-file',
      'test',
      '--reporter=junit',
      `--reporter-outfile=${report}`,
      'test/unit',
    ],
    {
      cwd: resolve(root, 'tests/reference-api'),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  const check = spawnSync(
    process.execPath,
    [
      '--no-env-file',
      'scripts/rust-migration/test-destinations.ts',
      '--tier',
      'unit',
      '--report',
      report,
    ],
    { cwd: root, stdio: 'inherit' }
  );
  process.exitCode = check.status ?? 1;
} finally {
  rmSync(report, { force: true });
}
