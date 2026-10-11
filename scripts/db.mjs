#!/usr/bin/env bun
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '-d' && arg !== '--detach')) {
  console.error('Usage: bun run db [-d | --detach]');
  process.exit(1);
}

function compose(args) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}

const startStatus = compose(['up', '-d', 'postgres']);
if (startStatus !== 0 || args.length > 0) process.exit(startStatus);

// Following logs separately also works when Podman Compose finds a running container.
const logs = spawn('docker', ['compose', 'logs', '--follow', 'postgres'], {
  cwd: root,
  stdio: 'inherit',
});

let stopping = false;
function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  logs.kill('SIGTERM');
  const stopStatus = compose(['stop', 'postgres']);
  process.exit(exitCode || stopStatus);
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
logs.once('error', (error) => {
  console.error(error.message);
  stop(1);
});
logs.once('exit', (code) => {
  if (!stopping) {
    const stopStatus = compose(['stop', 'postgres']);
    process.exit(code === 0 ? stopStatus : (code ?? 1));
  }
});
