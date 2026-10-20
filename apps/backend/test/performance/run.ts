import { dirname, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { requireLocalTestDatabase } from '../test-target';
import budgets from './budgets.json';

const root = resolve(import.meta.dir, '../../../..');
requireLocalTestDatabase(process.env.TEST_DB_URL);
let output =
  process.env.ASTRAL_PERF_REPORT ??
  resolve(tmpdir(), `astral-backend-performance-${crypto.randomUUID()}.json`);
let samples = budgets.samples;
for (const argument of process.argv.slice(2)) {
  if (argument.startsWith('--output='))
    output = resolve(argument.slice('--output='.length));
  else if (argument.startsWith('--samples='))
    samples = Number(argument.slice('--samples='.length));
  else throw new Error(`Unknown performance argument: ${argument}`);
}
if (!Number.isInteger(samples) || samples < 20 || samples > 1000)
  throw new Error('Performance samples must be an integer from 20 to 1000');
const supplied = process.env.ASTRAL_BACKEND_BIN;
const binary = supplied
  ? resolve(supplied)
  : resolve(root, 'target/release/astral-grove-server');
await mkdir(dirname(output), { recursive: true });
await Bun.write(
  output,
  JSON.stringify({
    startedAt: new Date().toISOString(),
    reportIncomplete: true,
    testExitCode: null,
  }) + '\n'
);
async function run(args: string[], env = process.env) {
  return await Bun.spawn(args, { cwd: root, env, stdout: 'inherit', stderr: 'inherit' })
    .exited;
}
if (!supplied) {
  const built = await run([
    'cargo',
    'build',
    '--package',
    'astral-grove-server',
    '--bin',
    'astral-grove-server',
    '--release',
    '--locked',
  ]);
  if (built !== 0) process.exit(built);
}
if (!(await Bun.file(binary).exists()))
  throw new Error('Backend binary does not exist');
const exitCode = await run(
  [
    process.execPath,
    '--no-env-file',
    'test',
    '--max-concurrency=1',
    'apps/backend/test/performance/backend.test.ts',
  ],
  {
    ...process.env,
    ASTRAL_BACKEND_BIN: binary,
    ASTRAL_PERF_BUILD: supplied ? 'supplied-binary' : 'release',
    ASTRAL_PERF_REPORT: output,
    ASTRAL_PERF_SAMPLES: String(samples),
  }
);
const report = (await Bun.file(output).exists())
  ? z.record(z.unknown()).parse(await Bun.file(output).json())
  : { reportIncomplete: true };
report.testExitCode = exitCode;
await Bun.write(output, JSON.stringify(report, null, 2) + '\n');
process.exitCode = exitCode;
console.log(`Performance report: ${output}`);
