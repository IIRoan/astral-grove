#!/usr/bin/env bash
# Cloud Agent install: idempotent, non-interactive dependency + generated-state refresh.
# System daemons (Docker, Postgres) are started per-boot in .cursor/start.sh, not here.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export DEBIAN_FRONTEND=noninteractive
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

log() { printf '\n[install] %s\n' "$*"; }

install_system_packages() {
  # Docker (+ compose) runs Postgres exactly as docker-compose.yml and scripts/test.mjs expect.
  # fuse-overlayfs + uidmap let dockerd run inside the Cloud Agent VM without a host daemon.
  local pkgs=(docker.io docker-compose-v2 fuse-overlayfs uidmap postgresql-client)
  local missing=()
  for pkg in "${pkgs[@]}"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
  done
  if [ "${#missing[@]}" -eq 0 ]; then
    log "system packages already present"
    return 0
  fi
  log "installing system packages: ${missing[*]}"
  sudo apt-get update -qq
  # --force-confold keeps existing conffiles so postinst prompts (e.g. fuse.conf) never block.
  sudo apt-get install -y -qq -o Dpkg::Options::=--force-confold "${missing[@]}"
}

install_bun() {
  local want
  want="$(cat "$ROOT/.bun-version" 2>/dev/null || echo 1.4.2)"
  if command -v bun >/dev/null 2>&1 && [ "$(bun --version)" = "$want" ]; then
    log "bun $want already installed"
    return 0
  fi
  log "installing bun $want"
  curl -fsSL https://bun.sh/install | bash -s "bun-v$want"
}

log "repo root: $ROOT"
install_system_packages
install_bun

log "installing workspace dependencies (bun install)"
bun install

log "building @riftbound/contracts (dist types consumed by api + mobile)"
bun run --cwd packages/contracts build

log "generating Uniwind types for mobile"
bun run --cwd apps/mobile uniwind:types

# Expo emits expo-env.d.ts + .expo/types (typed routes) only when it runs; tsconfig includes them,
# so generate once here to keep `bun run typecheck` green before the dev server starts.
generate_expo_types() {
  cd "$ROOT/apps/mobile"
  if [ -f expo-env.d.ts ] && [ -f .expo/types/router.d.ts ]; then
    log "expo types already generated"
    cd "$ROOT"
    return 0
  fi
  log "generating Expo typed routes + env types"
  EXPO_NO_TELEMETRY=1 timeout 180 bun run web >/tmp/expo-typegen.log 2>&1 &
  local pid=$!
  local ok=0
  for _ in $(seq 1 180); do
    if [ -f expo-env.d.ts ] && [ -f .expo/types/router.d.ts ]; then
      ok=1
      break
    fi
    sleep 1
  done
  kill "$pid" >/dev/null 2>&1 || true
  wait "$pid" 2>/dev/null || true
  [ "$ok" = "1" ] && log "expo types generated" || log "warning: expo types not generated (see /tmp/expo-typegen.log)"
  cd "$ROOT"
}
generate_expo_types

# Local dev env file for the API. Real secrets (e.g. a valid PA_API_KEY) can be supplied via
# Cursor Secrets, which land in process.env and take precedence over these dev defaults.
ensure_api_env() {
  local env_file="$ROOT/apps/api/.env"
  if [ -f "$env_file" ]; then
    log "apps/api/.env already exists — leaving untouched"
    return 0
  fi
  log "writing apps/api/.env dev defaults"
  cat >"$env_file" <<'ENV'
NODE_ENV=development
PORT=7000
DATABASE_URL=postgres://riftbound:riftbound@localhost:5433/riftbound
TEST_DB_URL=postgres://riftbound:riftbound@localhost:5433/riftbound_test
PA_API_KEY=ak_dev_placeholder_no_upstream_sync
PA_BASE_URL=https://piltoverarchive.com/api/external
ADMIN_SYNC_TOKEN=dev-sync-token-change-me
CATALOG_WARMUP_ON_START=false
CATALOG_PROBE_DISABLED=true
CARDMARKET_GAME_ID=22
BETTER_AUTH_SECRET=dev-better-auth-secret-change-me-in-production-0123456789
BETTER_AUTH_URL=http://localhost:7000
PUBLIC_APP_URL=http://localhost:7001
EMBEDDING_PROVIDER=local
ENV
}
ensure_api_env

log "verifying monorepo typecheck (contracts, api, mobile)"
bun run typecheck

log "install complete"
