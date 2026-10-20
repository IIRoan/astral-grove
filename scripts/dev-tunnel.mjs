#!/usr/bin/env bun
/**
 * Dev HTTPS tunnel for the local API.
 *
 * Local named tunnels receive generated API-only ingress; otherwise use an
 * explicitly configured API URL or an API-only quick tunnel.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiOnlyTunnelConfig, tunnelMode } from './lib/dev-tunnel.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = process.env.PORT ?? '7000';
const API_HEALTH = `http://127.0.0.1:${API_PORT}/api/v1/health`;
const DEV_DIR = join(ROOT, '.dev');
const TUNNEL_URL_FILE = join(DEV_DIR, 'tunnel-url');
const MOBILE_ENV = join(ROOT, 'apps/mobile/.env');
const PUBLIC_HOST = 'https://riftbounddev.roan.dev';
const CONFIG_PATH = join(ROOT, 'cloudflared/config.yml');
const API_ENV = join(ROOT, 'apps/backend/.env');

function loadApiEnv() {
  if (!existsSync(API_ENV)) return;
  for (const line of readFileSync(API_ENV, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (
      ['PUBLIC_API_URL', 'CLOUDFLARE_TUNNEL_TOKEN'].includes(key) &&
      !(key in process.env)
    ) {
      process.env[key] = value;
    }
  }
}

function log(msg) {
  console.log(`[cloudflared] ${msg}`);
}

function writeTunnelUrl(url) {
  mkdirSync(DEV_DIR, { recursive: true });
  writeFileSync(TUNNEL_URL_FILE, `${url}\n`, 'utf8');
  updateMobileEnv(url);
  log(`HTTPS API URL → ${url}`);
  log(`Wrote ${TUNNEL_URL_FILE}`);
  log(`Updated EXPO_PUBLIC_API_URL in apps/mobile/.env`);
}

function updateMobileEnv(apiUrl) {
  const line = `EXPO_PUBLIC_API_URL=${apiUrl}`;
  let contents = '';

  if (existsSync(MOBILE_ENV)) {
    contents = readFileSync(MOBILE_ENV, 'utf8');
    if (/^EXPO_PUBLIC_API_URL=/m.test(contents)) {
      contents = contents.replace(/^EXPO_PUBLIC_API_URL=.*$/m, line);
    } else {
      contents = `${contents.trimEnd()}\n${line}\n`;
    }
  } else {
    contents = `${line}\n`;
  }

  writeFileSync(MOBILE_ENV, contents, 'utf8');
}

async function waitForApi(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(API_HEALTH);
      if (res.ok) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API not reachable at ${API_HEALTH} after ${String(timeoutMs)}ms`);
}

function runCloudflared(args) {
  const child = spawn('cloudflared', args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.fromEntries(
      Object.entries({
        PATH: process.env.PATH,
        HOME: process.env.HOME,
      }).filter(([, value]) => value !== undefined)
    ),
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) writeTunnelUrl(match[0]);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) writeTunnelUrl(match[0]);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}

async function main() {
  loadApiEnv();

  const publicUrl = (process.env.PUBLIC_API_URL ?? PUBLIC_HOST).replace(/\/$/, '');
  const mode = tunnelMode({
    token: process.env.CLOUDFLARE_TUNNEL_TOKEN,
    hasLocalConfig: existsSync(CONFIG_PATH),
    publicApiUrl: process.env.PUBLIC_API_URL,
  });

  log(`Waiting for API at ${API_HEALTH}…`);
  await waitForApi();

  if (mode === 'local') {
    const config = apiOnlyTunnelConfig(
      Bun.YAML.parse(readFileSync(CONFIG_PATH, 'utf8')),
      publicUrl,
      Number(API_PORT)
    );
    writeTunnelUrl(publicUrl);
    const generated = join(DEV_DIR, 'api-tunnel.yml');
    writeFileSync(generated, Bun.YAML.stringify(config), { mode: 0o600 });
    log(`Starting API tunnel → ${publicUrl}`);
    runCloudflared(['tunnel', '--config', generated, 'run', config.tunnel]);
    return;
  }

  if (mode === 'external') {
    writeTunnelUrl(publicUrl);
    log(
      'PUBLIC_API_URL set without cloudflared/config.yml — update DNS/ingress separately.'
    );
    return;
  }

  log('Starting quick tunnel (trycloudflare.com)…');
  runCloudflared(['tunnel', '--url', `http://127.0.0.1:${API_PORT}`]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
