# The Astral Grove

A Riftbound companion app for managing collections and building decks, backed by
card data, prices, and community decks from Piltover Archive.

## Local database setup

Install Bun 1.4.2, Rust (the pinned 1.98.1 toolchain is selected automatically),
and Docker with Compose. The backend is a native Rust/Axum service; Expo remains
TypeScript. Install workspace tooling from the repo root:

```bash
bun install
```

For a new checkout, copy the API environment template:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Existing `apps/api/.env` files remain supported by the native dev/CLI wrappers.
For a new checkout use `apps/backend/.env`. Keep other settings and set its
database settings with these local values:

```dotenv
NODE_ENV=development
DATABASE_URL=postgres://riftbound:riftbound@localhost:5433/riftbound
TEST_DB_URL=postgres://riftbound:riftbound@localhost:5433/riftbound_test
```

Set `PA_API_KEY` in that file to your upstream API key. Keep production connection
strings in your deployment environment. An exported `DATABASE_URL` takes priority
over the environment file, so unset it in your dev shell if it points elsewhere.

Start PostgreSQL 16 with logs attached:

```bash
bun run db
```

Or run it in the background:

```bash
bun run db -d
```

The database listens on `127.0.0.1:5433`. Its user, password, and database name are
all `riftbound`. Data persists in the `riftbound_pg_data` Compose volume across
stops and restarts. `bun run db:up` is also available as a detached-start alias.

Once Postgres is ready, apply the existing migrations and start the API:

```bash
bun run db:migrate
bun run dev:api
```

The API runs on port 7000 and also applies pending migrations on startup. A fresh
local database has its own accounts, collections, and decks. To populate catalog
and price data, run these in another terminal with the API running:

```bash
bun run sync:catalog
bun run sync:prices
```

These commands use `ADMIN_SYNC_TOKEN` from your shell or the example's default
token. If you changed it in your backend environment, set the same value in your shell first.

Stop the database while keeping its data:

```bash
bun run db:down
```

`Ctrl+C` also stops it when running attached. `bun run test` starts local Postgres
and creates the separate `riftbound_test` database if needed.

## Backend contracts and verification

Rust request validators and DTOs generate OpenAPI and TypeScript types. Shared
Zod schemas still validate every Expo response, with compile-time assertions for
all 135 shared schema outputs.

```bash
bun run api:contracts          # regenerate after backend contract changes
bun run check                  # generated contracts, TS, lint, format, Rust clippy
bun run test                   # native unit/HTTP, compatibility, shared/mobile tests
cargo xtask baseline           # frozen-source, route and case inventory checks
```

Tests accept only loopback PostgreSQL databases named `riftbound_test` or
`riftbound_test_*` through `TEST_DB_URL`; upstream, mail and S3 flows use local
fixtures. `DATABASE_URL` is never the fallback test target. No reset is needed.

See [backend development](apps/backend/README.md), the
[Rocal migration map](plans/rust-migration/rocal-reference.md), and the
[local validation report](plans/rust-migration/local-validation.md).
Production builds use `Dockerfile.backend`; the runtime contains a native binary
and no TypeScript server. `tests/reference-api` retains the original implementation
solely for regression comparison and is excluded from the image.

GitHub CI runs two parallel jobs on pull requests and pushes to `main` or
`rust-backend-rewrite`: **Checks and unit tests** covers Rust/TypeScript checks,
native units, runtime schema/rule parity, shared/mobile and retained oracle units;
**Backend integration** builds the production Docker image and tests its binary
with PostgreSQL, native HTTP/compatibility suites and auth/HTTP boundary parity.
It also checks production-mode auth, SSE and shutdown inside the container. Each
HTTP suite runs once against the release binary. CI uses synthetic credentials
and local service fixtures.

## Internal mobile downloads

Use the install link or QR sent to Discord for the latest preview. The permanent
address starts with `https://riftapi.solace.onl/api/v1/releases/preview.html` and
includes an access token. Development builds use `development.html` at the same
base. Each build replaces its profile's current artifacts; the install page and QR
keep the same address.

The API and the Mobile internal build workflow must use the same R2 bucket and S3
secret access key. The bucket stays private: the API checks a per-file access
token, serves the page and iOS manifest without caching, and generates a fresh
download URL when an APK or IPA is requested. The install links have no timed
expiry; rotating the S3 secret access key revokes existing links. Android users
download the APK, open it from Downloads, and allow installs from their browser if
prompted.

Deploy the API release routes before publishing with this workflow for the first
time, then manually run Mobile internal build with the `preview` profile to replace
the old page and iOS manifest and send the permanent URL to Discord. Existing
Discord links containing an expired signature remain expired.

The workflow defaults `S3_PUBLIC_BASE_URL` to `https://riftapi.solace.onl/api/v1`.
An existing public download host can override it with that GitHub secret. Local
publishing scripts require an explicit permanent HTTPS base and reject signed URLs.
