import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { rm } from 'node:fs/promises';

const entry = resolve(import.meta.dir, 'performance/run.ts');
async function run(env: Record<string, string>, args: string[] = []) {
  const child = Bun.spawn([process.execPath, '--no-env-file', entry, ...args], {
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [exitCode, errors] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  return { exitCode, errors };
}
test.each([
  undefined,
  'postgres://fixture:fixture@remote.invalid/riftbound_test',
  'postgres://fixture:fixture@127.0.0.1/production',
])(
  'performance runner rejects unsafe database selection before building or starting a server: %s',
  async (url) => {
    const result = await run({
      DATABASE_URL: 'postgres://fixture:fixture@remote.invalid/production',
      ...(url ? { TEST_DB_URL: url } : {}),
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.errors).toContain(
      url ? 'Test database must be loopback' : 'TEST_DB_URL is required'
    );
  }
);
test.each(['--samples=0', '--samples=2000', '--samples=NaN', '--unknown'])(
  'performance runner rejects invalid load arguments before compiling: %s',
  async (argument) => {
    const result = await run(
      { TEST_DB_URL: 'postgres://fixture:fixture@127.0.0.1/riftbound_test' },
      [argument]
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.errors).toContain(
      argument === '--unknown'
        ? 'Unknown performance argument'
        : 'Performance samples must be'
    );
  }
);
test('performance runner rejects a missing supplied artifact without launching fixtures', async () => {
  const output = resolve(tmpdir(), `astral-perf-runner-${crypto.randomUUID()}.json`);
  try {
    const result = await run(
      {
        TEST_DB_URL: 'postgres://fixture:fixture@127.0.0.1/riftbound_test',
        ASTRAL_BACKEND_BIN: resolve(tmpdir(), `missing-${crypto.randomUUID()}`),
      },
      [`--output=${output}`]
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.errors).toContain('Backend binary does not exist');
  } finally {
    await rm(output, { force: true });
  }
});
