#!/usr/bin/env bash
# Cloud Agent start: per-boot reconciliation of the Docker daemon + Postgres, then DB migrations.
# Must be idempotent and must return (the dev servers run as `terminals`, not here).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

log() { printf '\n[start] %s\n' "$*"; }

start_dockerd() {
  if docker info >/dev/null 2>&1; then
    log "docker daemon already running"
  else
    log "starting dockerd (fuse-overlayfs storage driver)"
    # No systemd in the VM — launch the daemon directly and detach it.
    sudo nohup dockerd --storage-driver=fuse-overlayfs --iptables=false \
      >/tmp/dockerd.log 2>&1 &
    for _ in $(seq 1 30); do
      docker info >/dev/null 2>&1 && break
      sleep 1
    done
    docker info >/dev/null 2>&1 || {
      log "ERROR: dockerd did not become ready (see /tmp/dockerd.log)"
      exit 1
    }
    log "dockerd ready"
  fi
  # Let the non-root agent use docker without sudo (repo scripts call docker directly).
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
}

start_postgres() {
  log "bringing up Postgres via docker compose"
  docker compose up -d postgres
  log "waiting for Postgres to accept connections"
  for _ in $(seq 1 60); do
    docker exec riftbound-postgres pg_isready -U riftbound -d riftbound >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec riftbound-postgres pg_isready -U riftbound -d riftbound >/dev/null 2>&1 || {
    log "ERROR: Postgres did not become ready"
    exit 1
  }
  log "Postgres ready on localhost:5433"
}

ensure_test_db() {
  # scripts/test.mjs expects a riftbound_test database alongside the default riftbound.
  local exists
  exists="$(docker exec riftbound-postgres psql -U riftbound -d riftbound -tAc \
    "SELECT 1 FROM pg_database WHERE datname = 'riftbound_test'" 2>/dev/null || true)"
  if [ "$exists" = "1" ]; then
    log "riftbound_test database already exists"
  else
    log "creating riftbound_test database"
    docker exec riftbound-postgres psql -U riftbound -d riftbound \
      -c "CREATE DATABASE riftbound_test" >/dev/null
  fi
}

run_migrations() {
  log "applying Drizzle migrations (forward-only)"
  bun run db:migrate
}

start_dockerd
start_postgres
ensure_test_db
run_migrations

log "start complete — dev servers run in the api / mobile-web terminals"
