import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '../../../..');

function run(args: string[], failure?: string) {
  const directory = mkdtempSync(join(tmpdir(), 'astral-grove-db-launcher-'));
  const callsFile = join(directory, 'calls.jsonl');
  writeFileSync(callsFile, '');
  writeFileSync(
    join(directory, 'docker'),
    `#!/usr/bin/env bun
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.DB_LAUNCHER_CALLS, JSON.stringify(args) + '\\n');
process.exit(args[1] === process.env.DB_LAUNCHER_FAILURE ? 7 : 0);
`,
    { mode: 0o755 }
  );
  try {
    const result = spawnSync(process.execPath, ['run', 'db', ...args], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${directory}${delimiter}${process.env.PATH ?? ''}`,
        DB_LAUNCHER_CALLS: callsFile,
        DB_LAUNCHER_FAILURE: failure,
      },
    });
    const calls = readFileSync(callsFile, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line: string) => JSON.parse(line) as string[]);
    return { status: result.status, calls, stderr: result.stderr };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('local database launcher', () => {
  test.each(['-d', '--detach'])('%s starts Postgres without following logs', (flag) => {
    const result = run([flag]);
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([['compose', 'up', '-d', 'postgres']]);
  });

  test('foreground mode follows logs and stops Postgres when they end', () => {
    const result = run([]);
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([
      ['compose', 'up', '-d', 'postgres'],
      ['compose', 'logs', '--follow', 'postgres'],
      ['compose', 'stop', 'postgres'],
    ]);
  });

  test('a failed start exits before following logs', () => {
    const result = run([], 'up');
    expect(result.status).toBe(7);
    expect(result.calls).toEqual([['compose', 'up', '-d', 'postgres']]);
  });

  test('a log failure stops Postgres and preserves the failure status', () => {
    const result = run([], 'logs');
    expect(result.status).toBe(7);
    expect(result.calls.at(-1)).toEqual(['compose', 'stop', 'postgres']);
  });

  test('unsupported flags exit without starting Postgres', () => {
    const result = run(['--invalid']);
    expect(result.status).toBe(1);
    expect(result.calls).toEqual([]);
    expect(result.stderr).toContain('Usage: bun run db');
  });
});
