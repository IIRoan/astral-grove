import { join } from 'node:path';
import {
  parseBunTestOutput,
  printTestSummary,
} from '../../../scripts/lib/test-summary.mjs';

const apiRoot = join(import.meta.dir, '..');

async function runSuite(command: string[]) {
  const proc = Bun.spawn(command, {
    cwd: apiRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  process.stdout.write(stdout);
  process.stderr.write(stderr);

  const suites = parseBunTestOutput(`${stdout}\n${stderr}`);
  const totals = suites.reduce(
    (sum, suite) => ({
      passed: sum.passed + suite.passed,
      failed: sum.failed + suite.failed,
      total: sum.total + suite.total,
    }),
    { passed: 0, failed: 0, total: 0 }
  );

  return { totals, exitCode };
}

const unit = await runSuite(['bun', 'test', 'test/unit']);
if (unit.exitCode !== 0) {
  printTestSummary(
    new Map([['@riftbound/api (unit)', { ...unit.totals, kind: 'unit' }]]),
    {
      title: 'API Test Summary',
      breakdown: {
        unit: unit.totals,
        database: { passed: 0, failed: 0, total: 0 },
      },
    }
  );
  process.exit(unit.exitCode ?? 1);
}

const e2e = await runSuite([
  'bun',
  'test',
  '--preload',
  './test/e2e/preload.ts',
  '--max-concurrency=1',
  './test/e2e',
]);

printTestSummary(
  new Map([
    ['@riftbound/api (unit)', { ...unit.totals, kind: 'unit' }],
    ['@riftbound/api (e2e)', { ...e2e.totals, kind: 'database' }],
  ]),
  {
    title: 'API Test Summary',
    breakdown: {
      unit: unit.totals,
      database: e2e.totals,
    },
  }
);

const failed = unit.totals.failed + e2e.totals.failed;
const exitCode = unit.exitCode !== 0 ? unit.exitCode : e2e.exitCode;
process.exit(failed > 0 || exitCode !== 0 ? 1 : 0);
