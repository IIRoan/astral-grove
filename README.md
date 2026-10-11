# The Astral Grove

A Riftbound companion app for managing collections and building decks, backed by
card data, prices, and community decks from Piltover Archive.

## Local database setup

Install Bun 1.4.2 and Docker with Compose, then install dependencies from the repo
root:

```bash
bun install
```

For a new checkout, copy the API environment template:

```bash
cp apps/api/.env.example apps/api/.env
```

If you already have `apps/api/.env`, keep your other settings and replace its
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
token. If you changed it in `apps/api/.env`, set the same value in your shell first.

Stop the database while keeping its data:

```bash
bun run db:down
```

`Ctrl+C` also stops it when running attached. `bun run test` starts local Postgres
and creates the separate `riftbound_test` database if needed.
