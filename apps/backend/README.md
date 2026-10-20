# Astral Grove backend

`apps/backend` is the production backend. It uses Axum/Tokio, SeaORM's
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
source and migrations, rebuilds, and forwards termination signals. Explicit shell
values take precedence over `apps/backend/.env`. The Rust binary itself reads
environment variables only and never reads the environment file. Startup applies forward migrations and
retries transient PostgreSQL failures before listening on port 7000.

Each backend process keeps two PostgreSQL connections warm, capped by `DB_POOL_MAX`
when configured lower. Surplus idle connections expire after five minutes.
`DB_POOL_MAX` defaults to 10 in production and 20 otherwise.

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
of migrations or tests. The CLI uses the same validation and services as HTTP.

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
| `src/db.rs`, `src/migrations.rs`, `migrations/`                   | Transactions and forward migration history                      |
| `test/`                                                           | HTTP/PostgreSQL tests and local integration fixtures            |
| `../../crates/astral-grove-api-types`                             | Database-independent wire DTOs                                  |

## Contracts

The `http::schemas` definitions own normalization, defaults and unknown-key
behavior. `http::parse`, `value` and `respond` validate inbound and outbound JSON.
Do not bypass response validation or add handwritten TypeScript wire interfaces.

After a wire change, update the Rust schema/DTO and the shared Zod schema together.
Run `cargo xtask openapi`, then build `packages/contracts`. The generated
`packages/api-contracts` exports OpenAPI operations and schemas. The bidirectional
assertions in `packages/contracts/src/rust-type-alignment.ts` reject type drift.
`cargo xtask openapi --check`
compares generated content without editing files or connecting to PostgreSQL.

## Migrations

The runner records applied migrations in the `drizzle.__drizzle_migrations`
ledger with SHA-256 checksums, timestamps and a PostgreSQL advisory lock. Extra
historical entries are preserved; changed known entries fail closed.

For a new migration, add the next forward SQL file and register its unique,
increasing millisecond timestamp in `src/migrations.rs`. Never edit an applied SQL
file or generate a replacement initial schema. Apply to an isolated local test
database, verify the resulting schema/data, and test repeat startup.

## Tests

```bash
export TEST_DB_URL=postgres://riftbound:riftbound@localhost:5433/riftbound_test
bun run --cwd apps/backend test:unit
bun run --cwd apps/backend test:e2e
bun run --cwd apps/backend test:perf --output=/tmp/backend-performance.json
bun run check
bun run test
```

HTTP tests launch the Rust process and use PostgreSQL plus local PA/Cardmarket,
JMAP and independently verified S3 fixtures. `ASTRAL_BACKEND_BIN` selects a
packaged release binary for the same tests. Use `test:http` to run them without
compiling a local binary; `test:e2e` builds the development server first. CI runs
the HTTP suite against both the development binary and the production-image
binary, alongside the container smoke test.

### Performance and load tests

`test:perf` builds the optimized backend, then runs repeated HTTP workloads against
the loopback `TEST_DB_URL` and local PA/Cardmarket, CDN and signed S3 fixtures. Set
`ASTRAL_BACKEND_BIN` to exercise an existing artifact instead. CI runs this suite
against the binary extracted from the production image and uploads its JSON
report and SQL plans. This suite is separate from the ordinary HTTP tests so
debug builds and unrelated concurrent tests do not distort the measurements.

The default is 40 measured requests per workload after three warmups, with serial
and eight-client profiles. `--samples=100` increases the sample count. The report
includes p50/p95/p99 and raw timings, first-request latency, throughput, response
bytes, status counts, assertion failures, binary SHA-256, host details and Linux
RSS/PSS/CPU snapshots. RSS is sampled every 100ms. These are local measurements;
database buffers stay warm and the load generator shares the backend's host.

Workloads cover type/name/fuzzy search and pagination, 20/2,000/5,000-variant
quantity and activity lookups, successive history cursors over at least 10,000
audit events, a 500-item collection, concurrent session renewal, image stampedes
and cache churn using 768x1024 PNGs, blocked object writes, and an eight-job sync
queue. Health latency is checked during and after load. Sync tests abort the
original clients, then verify every queued job completes and further work succeeds.
All synthetic users and their collections are removed with scoped cleanup.

Thresholds and their rationale live in `test/performance/budgets.json`. The
quantity-to-list comparison uses alternating request order and repeated medians. Concurrent
database ceilings account for the client count and also guard against a throughput
collapse. Image and RSS limits are provisional local regression guards, not
production SLAs. Search diagnostics retain all 33 EXPLAIN plans separately
so SQL execution can be distinguished from HTTP, mapping and serialization costs.

## Production artifact

```bash
docker build -f Dockerfile.backend -t astral-grove-backend .
```

The final image runs as an unprivileged user and contains only the release binary
and system TLS roots. It excludes environment files, Bun, Node, and mobile
sources. SSE and in-memory rate/cache state currently require one replica.
