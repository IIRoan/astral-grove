# Native Astral Grove backend

`apps/backend` is the only production backend. It uses Axum/Tokio, SeaORM's
PostgreSQL connection/transaction layer, and Rust-owned request validators and
Serde DTOs. The Expo application and its runtime Zod validation remain TypeScript.

## Local development

From the repository root:

```bash
bun install
cp apps/backend/.env.example apps/backend/.env
bun run db -d
bun run db:migrate
bun run dev:api
```

Set `PA_API_KEY` in the ignored environment file. The dev wrapper watches Rust
source and migrations, rebuilds, and forwards termination signals. Existing
`apps/api/.env` is a compatibility fallback; `apps/backend/.env` and explicit shell
values take precedence. The Rust binary itself reads environment variables only.
It never reads either environment file. Startup applies forward migrations and
retries transient PostgreSQL failures before listening on port 7000.

```bash
cargo build --package astral-grove-server --release --locked
./target/release/astral-grove-server --help
bun scripts/backend-cli.mjs migrate
bun scripts/backend-cli.mjs sync:catalog
bun scripts/backend-cli.mjs sync:prices
bun scripts/backend-cli.mjs audit:cards
bun scripts/backend-cli.mjs prune:prices --target=local --use-env=DATABASE_URL
bun scripts/backend-cli.mjs explain:search --target=test --use-env=TEST_DB_URL --with-local-service --repeat=5 --output=/tmp/astral-search.json
```

Price retention defaults to a dry run and requires an explicit target and URL selector;
`--apply` authorizes its scoped retention deletions. Never reset a database as part
of migration or tests. The CLI uses the same validation and services as HTTP.

## Source map

| Path                                                              | Responsibility                                                  |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| `src/{lib,main,config,middleware,http,error}.rs`                  | Startup, Axum routes, configuration, transport and error policy |
| `src/auth/`                                                       | Better Auth wire/schema/password/cookie/OTP/JMAP compatibility  |
| `src/catalog/`, `src/search.rs`, `src/sync.rs`, `src/upstream.rs` | Cached PA catalog, search, metadata and synchronization         |
| `src/prices.rs`, `src/cardmarket/`                                | Price snapshots, daily history, mapping and product backfill    |
| `src/collection/`                                                 | Membership, stacks, CSV/TTS, audit, sharing and SSE             |
| `src/decks/`, `src/deck_rules.rs`                                 | Owned/community decks, versions, upstream writes and legality   |
| `src/user_data.rs`                                                | Wishlist and device settings                                    |
| `src/{images,releases}.rs`                                        | Bounded image caching/resize/S3 and private release downloads   |
| `src/db.rs`, `src/migrations.rs`, `migrations/`                   | Transactions and Drizzle-compatible forward migration history   |
| `test/`                                                           | Native-process HTTP/PostgreSQL and local integration fixtures   |
| `../../crates/astral-grove-api-types`                             | Database-independent wire DTOs                                  |

## Contracts

The `http::schemas` definitions own normalization, defaults and unknown-key
behavior. `http::parse`, `value` and `respond` validate inbound and outbound JSON.
Do not bypass response validation or add handwritten TypeScript wire interfaces.

After a wire change, update the Rust schema/DTO and the shared Zod schema together.
Run `cargo xtask openapi`, then build `packages/contracts`. The generated
`packages/api-contracts` exports OpenAPI operations and schemas. The bidirectional
assertions in `packages/contracts/src/rust-type-alignment.ts` reject type drift;
the differential corpus checks runtime semantics. `cargo xtask openapi --check`
compares generated content without editing files or connecting to PostgreSQL.

## Migrations

The 16 original SQL migrations are preserved byte for byte. The native runner
uses the existing `drizzle.__drizzle_migrations` ledger, SHA-256 checksums,
timestamps and a PostgreSQL advisory lock. Extra historical entries are preserved;
changed known entries fail closed. All original `timestamptz(6)` precision remains.

For a new migration, add the next forward SQL file and register its unique,
increasing millisecond timestamp in `src/migrations.rs`. Never edit an applied SQL
file or generate a replacement initial schema. Apply to an isolated local test
database, verify the resulting schema/data, and test repeat startup. The frozen
Drizzle schema in `tests/reference-api` describes the pre-rewrite database only.

## Tests

```bash
export TEST_DB_URL=postgres://riftbound:riftbound@localhost:5433/riftbound_test
bun run --cwd apps/backend test:unit
bun run --cwd apps/backend test:e2e
bun run --cwd apps/backend test:compat
bun run --cwd apps/backend test:parity
cargo xtask baseline
bun run check
bun run test
```

Native tests launch the Rust process and use PostgreSQL plus local PA/Cardmarket,
JMAP and independently verified S3 fixtures. `ASTRAL_BACKEND_BIN` can select a
packaged release binary for the same HTTP tests. Use `test:http` to run those
tests without compiling a local binary; `test:e2e` builds the development server
first. With `ASTRAL_BACKEND_BIN` set, the compatibility runner also skips the local
build and auth/HTTP parity probes target that binary. CI runs all HTTP suites
once against the production-image binary, alongside the container smoke test.
The compatibility runner targets
Rust with the 219 original e2e cases; some cases also call frozen TypeScript
services directly, as recorded in the case map. Retained reference unit cases
are oracle evidence, not Rust unit-test coverage. Native corpus and integration
tests provide separate implementation evidence.

## Production artifact

```bash
docker build -f Dockerfile.backend -t astral-grove-backend .
```

The final image runs as an unprivileged user and contains only the release binary
and system TLS roots. It excludes environment files, the frozen reference server,
Bun, Node, and mobile sources. Runtime configuration uses the existing variables.
SSE and in-memory rate/cache state currently require one replica, as before.
Local verification does not deploy the image or switch traffic. See the migration
report for evidence, intentional corrections, and rollout/rollback requirements.
