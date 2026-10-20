import { watch } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
let child;
let timer;
let stopped = false;
let restart = false;
function start() {
  if (stopped) return;
  child = spawn(
    process.execPath,
    ['--no-env-file', resolve(root, 'scripts/backend-cli.mjs'), 'serve'],
    {
      cwd: root,
      stdio: 'inherit',
    }
  );
  child.once('exit', () => {
    child = undefined;
    if (restart) {
      restart = false;
      start();
    }
  });
}
function changed() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    restart = true;
    if (child) child.kill('SIGTERM');
    else {
      restart = false;
      start();
    }
  }, 250);
}
const watchers = [
  'apps/backend/src',
  'apps/backend/migrations',
  'crates/astral-grove-api-types/src',
].map((path) => watch(resolve(root, path), { recursive: true }, changed));
watchers.push(
  watch(resolve(root, 'Cargo.toml'), changed),
  watch(resolve(root, 'apps/backend/Cargo.toml'), changed)
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    stopped = true;
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    child?.kill(signal);
  });
start();
