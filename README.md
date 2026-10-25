# The Astral Grove

A Riftbound companion app for managing collections and building decks, backed by
card data, prices, and community decks from Piltover Archive.

## Local database setup

Install Bun 1.4.4, Node 22.23.4 (`.node-version`), Rust (the pinned 1.98.1 toolchain is selected automatically),
and Docker with Compose. The backend is a Rust/Axum service; the app is Expo
and TypeScript. Install workspace tooling from the repo root:

```bash
bun install
```

For a new checkout, copy the API environment template:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Keep other settings and set its database settings with these local values:

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

Rust validators in `apps/backend/src/http/schemas.rs` generate OpenAPI and
TypeScript types. Shared Zod schemas still validate every Expo response, with
generated compile-time assertions for every Rust-validated schema's output and
request input (see [backend contracts](apps/backend/README.md#contracts)).

```bash
bun run api:contracts          # regenerate after backend contract changes
bun run check                  # generated contracts, TS, lint, format, Rust clippy
bun run test                   # Rust unit, HTTP, shared and mobile tests
```

Tests accept only loopback PostgreSQL databases named `riftbound_test` or
`riftbound_test_*` through `TEST_DB_URL`; upstream, mail and S3 flows use local
fixtures. `DATABASE_URL` is never the fallback test target. No reset is needed.

See [backend development](apps/backend/README.md). Production builds use
`Dockerfile.backend`; the runtime image contains only the server binary.

GitHub CI runs on pull requests and pushes to `main`, split across parallel jobs:
lint/typecheck, Rust unit tests, shared and mobile unit tests, HTTP tests against
the development binary, and a production image build whose release binary runs the
HTTP, performance and browser UI suites plus a container smoke test for
production-mode auth, SSE and shutdown. CI uses synthetic credentials and local service fixtures.

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
