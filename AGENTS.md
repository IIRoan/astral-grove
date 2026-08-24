# Agent instructions — The Astral Grove

> **The Astral Grove** is our product: a fast Riftbound companion app for managing your collection and building decks.
> [**Piltover Archive**](https://piltoverarchive.com) is the upstream source of truth for card data, prices, and community decks — we are a separate product that sits on top of it, not a reskin of their site.
>
> Read this file first. For mobile UI work, also read [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md), [`apps/mobile/PRODUCT.md`](apps/mobile/PRODUCT.md), and [`apps/mobile/DESIGN.md`](apps/mobile/DESIGN.md).

---

## What we build

The Astral Grove exists because listing and updating a collection on Piltover Archive can be slow. We optimize that workflow while still treating PA as authoritative for **what cards exist**, **what they cost**, and **what the community has published**.

### Product goals

| Area                 | What The Astral Grove does                                                 | Why it matters                                   |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| **Collection**       | Fast browse, add, remove, and quantity edits with local persistence        | Core daily-use flow — must feel snappier than PA |
| **Catalog & prices** | Cached card index, search, filters, Cardmarket price history               | Served from our DB after hash-based sync from PA |
| **Decks**            | Build and validate decks locally; browse community lists from PA           | Full deck builder with Riftbound legality rules  |
| **Deck import**      | Import PA deck text, browse PA decks, copy upstream decks into owned decks | Meet users where their data already lives        |
| **Accounts**         | Our own auth (Better Auth) and per-user data                               | Astral Grove users, not PA session passthrough   |

### What Piltover Archive owns (upstream)

PA remains source of truth for data we do not invent:

- Card catalog — sets, variants, rarities, images, legality metadata
- Price data — Cardmarket snapshots and history
- Community decks — public deck lists and detail payloads on piltoverarchive.com
- The **PiltoverArchive text format** for deck import/export (section headers like `Main Deck`, `Runes`, etc.)

Our API syncs this data into PostgreSQL (`sync-engine`, `card-cache`, `price-cache`) and re-serves it quickly. The mobile app **never** calls `piltoverarchive.com` directly.

### What The Astral Grove owns (our product)

| Data                     | Stored in                       | Notes                                                  |
| ------------------------ | ------------------------------- | ------------------------------------------------------ |
| User accounts & sessions | Postgres + Better Auth          | Independent from PA accounts                           |
| User collection          | `collection_items`              | Fast CRUD via `/api/v1/collection`                     |
| Owned decks              | `user_decks`                    | Editable copies; survives even if upstream write fails |
| Imported decks           | `user_decks` with `upstream_id` | Copied from a PA deck via `POST /decks/:id/import`     |
| Catalog & price cache    | Postgres                        | Refreshed from PA on hash change or cron               |

**Imported/upstream deck views are read-only.** Users edit by importing into an owned copy.

### Architecture at a glance

```mermaid
flowchart TB
  subgraph astralGrove [The Astral Grove — our product]
    Mobile["apps/mobile\nExpo app"]
    API["apps/api\nElysia API"]
    DB[(PostgreSQL)]
    Mobile --> API --> DB
  end

  subgraph upstream [Piltover Archive — source of truth]
    PA["piltoverarchive.com\nexternal API"]
  end

  API -->|"sync catalog, prices, decks\n(PaClient)"| PA
```

### Naming in this repo

The codebase uses several names — agents should understand the mapping:

| Name                              | Meaning                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **The Astral Grove**              | Product name (Expo app, user-facing copy)                                                                                                                    |
| **Piltover Archive / PA**         | Upstream card & deck platform we integrate with                                                                                                              |
| **`@riftbound/*` packages**       | Internal npm scope (historical codename — same monorepo)                                                                                                     |
| **`PA_API_KEY`, `PaClient`**      | Env vars and code for the **PA external API** client                                                                                                         |
| **`piltoverarchive` repo folder** | Git checkout path — not the product name                                                                                                                     |
| **`design/`**                     | Marketing site, separate from the Expo app                                                                                                                   |
| **EAS identifiers**               | Expo owner `astralgrove`, slug `astral-grove`, project `84e78cd9-68b6-4642-964f-2212b036d515`, scheme `astral-grove`, bundle/package `com.iroan.astralgrove` |

When writing user-facing copy, prefer **The Astral Grove**. When reading upstream integration code, expect **Piltover Archive** terminology in comments and deck I/O (`importPiltoverArchive`, `exportPiltoverArchive`).

---

## Repository map

| Path                         | Package                        | Role                                                                                                        |
| ---------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `apps/mobile`                | `@riftbound/mobile`            | **The Astral Grove app** — Expo SDK 57 (iOS, Android, Web), Expo Router, TanStack Query, tetra-ui + Uniwind |
| `apps/api`                   | `@riftbound/api`               | The Astral Grove API — Elysia on Bun, Drizzle ORM, Better Auth, PA upstream sync                            |
| `packages/contracts`         | `@riftbound/contracts`         | Shared Zod schemas + `z.infer` types for our API **and** PA payload shapes                                  |
| `packages/typescript-config` | `@riftbound/typescript-config` | Shared strict TS config                                                                                     |
| `design/`                    | `astral-grove.com`             | Marketing / landing site (Next.js — not the mobile client)                                                  |
| `SPEC.md`                    | —                              | Architecture spec (may lag implementation — trust the code)                                                 |

**Data flow:** The Astral Grove mobile → our API → PostgreSQL → (sync) → Piltover Archive external API.

---

## Quality gate — run before finishing work

Agents **must** verify changes before marking a task complete. Run the narrowest scope that covers your edits, then widen if unsure.

```bash
# Full monorepo check (preferred before hand-off)
bun run check          # typecheck + lint + format:check
bun run test           # all package tests (starts Postgres if needed)

# Individual steps
bun run typecheck      # turbo typecheck (contracts build first)
bun run lint           # ESLint across apps + packages
bun run lint:fix       # auto-fix where possible
bun run format:check   # Prettier
bun run format         # write Prettier fixes
```

### Scoped commands

```bash
# Single package
bun run --cwd apps/api typecheck
bun run --cwd apps/api test
bun run --cwd apps/mobile typecheck
bun run --cwd apps/mobile test
bun run --cwd packages/contracts typecheck

# API: unit only (fast, no DB server)
bun run --cwd apps/api test test/unit

# API: e2e only (Postgres + test server on port 3099)
bun run --cwd apps/api test test/e2e

# Mobile: one file
bun test apps/mobile/lib/deck-validation.test.ts

# Contracts: build required for dependents
bun run --cwd packages/contracts build
```

> **Do not skip checks** because a change “looks small.” Type errors in `contracts` propagate to API and mobile. E2E tests catch auth, DB, and route regressions that unit tests miss.

---

## Toolchain

| Tool           | Version / notes                                                       |
| -------------- | --------------------------------------------------------------------- |
| **Runtime**    | [Bun](https://bun.sh) 1.2.x (`packageManager` in root `package.json`) |
| **Monorepo**   | Turborepo — tasks in `turbo.json`                                     |
| **Language**   | TypeScript **strict** everywhere                                      |
| **Validation** | Zod 3 — shared via `@riftbound/contracts`                             |
| **API**        | Elysia + Drizzle + postgres.js                                        |
| **Mobile**     | Expo 57, React 19, React Native New Architecture                      |
| **DB**         | PostgreSQL 16 (Docker Compose on port **5433**)                       |

Install dependencies from the repo root:

```bash
bun install
```

---

## Linting

Root ESLint config: `eslint.config.js` (typescript-eslint, recommended + project rules).

**Key rules agents must follow:**

- `consistent-type-imports` — use `import type { Foo }` for type-only imports
- `no-unused-vars` — prefix intentionally unused names with `_`
- Test files under `**/test/**` are ignored by root ESLint (API/mobile have their own test lint paths)

```bash
bun run lint                 # all workspaces
bun run lint:fix
bun run --cwd apps/mobile lint    # expo lint
bun run --cwd apps/api lint
```

**Prettier** (`prettier --check` / `--write`) covers `*.{ts,tsx,js,json,md}`. Match existing formatting; do not reformat unrelated files.

---

## Type checking

All packages use strict TypeScript. Shared base config enforces:

- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- `noUnusedLocals`, `noUnusedParameters`

```bash
bun run typecheck    # turbo: builds ^dependencies first, then tsc --noEmit
```

**Mobile extras:**

- Path alias: `@/*` → `apps/mobile/*`
- After changing Uniwind/Tailwind tokens: `bun run --cwd apps/mobile uniwind:types`
- Test files are excluded from mobile `tsc` — they are still run by `bun test`

**Contracts:** changing a schema requires `bun run --cwd packages/contracts build` (or `turbo build`) so `dist/` types update for API/mobile imports.

---

## Zod & `@riftbound/contracts`

Zod is the **contract layer** between API, mobile, and upstream payloads. Do not duplicate shapes as hand-written interfaces.

### Where schemas live

| Domain                           | File(s) in `packages/contracts/src/`                       |
| -------------------------------- | ---------------------------------------------------------- |
| HTTP responses / errors          | `api.ts`                                                   |
| Cards, catalog, pagination       | `cards.ts`                                                 |
| Prices                           | `prices.ts`                                                |
| Filters snapshot                 | `filters.ts`                                               |
| Collection + CSV                 | `collection.ts`, `collection-csv.ts`                       |
| Deck rules & validation          | `deck-rules.ts`                                            |
| Deck CRUD / list queries         | `decks.ts`                                                 |
| Upstream Piltover Archive shapes | `upstream.ts`                                              |
| Legality, variants, tags         | `card-legality.ts`, `variant-utils.ts`, `champion-tags.ts` |

Export new schemas from `packages/contracts/src/index.ts`.

### Patterns to follow

```ts
// 1. Define schema, then infer type (never the reverse)
export const DeckValidateInput = z.object({ /* ... */ });
export type DeckValidateInput = z.infer<typeof DeckValidateInput>;

// 2. API routes — parse inbound, parse outbound
const input = DeckValidateInput.parse(body);
return DeckValidateResponse.parse({ data: result });

// 3. Query strings — coerce types explicitly
page: z.coerce.number().int().positive().default(1),

// 4. Mobile API client — validate every JSON response
return schema.parse(await res.json());

// 5. Env/config — safeParse with clear errors (see apps/api/src/env.ts)
const parsed = EnvSchema.safeParse(process.env);
```

### When to add or change contracts

1. **New or changed API field** → update Zod in `contracts` first
2. Run `build` on contracts, then fix API route + mobile client
3. Add/adjust **unit tests** in `packages/contracts/src/*.test.ts` for pure schema logic
4. Add **API e2e** coverage when behavior crosses HTTP + DB boundaries

**Do not:**

- Add parallel `interface` types that mirror Zod schemas
- Use `as SomeType` to bypass validation on external JSON (upstream, client responses, request bodies)
- Put API-only or UI-only types in `contracts` — keep shared wire formats there

---

## Testing

Test runner: **Bun test** (`bun:test`). Root `bun run test` orchestrates Docker Postgres, migrations, and turbo.

### Layout

```
apps/api/test/
  unit/           # Fast, isolated — no running server required
  e2e/            # HTTP + Postgres — preload.ts starts API on E2E_PORT (3099)
  fixtures/       # Shared test data
  upstream/       # Upstream integration probes

apps/mobile/
  **/*.test.ts    # Colocated unit tests (lib/, utils/, services/, components/)

packages/contracts/src/
  *.test.ts       # Schema / pure logic tests
```

### API test tiers

| Tier               | Location                  | Needs                                      | Examples                                                    |
| ------------------ | ------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| **Unit**           | `apps/api/test/unit/`     | Nothing external                           | `search.test.ts`, `deck-import.test.ts`, `hash` helpers     |
| **E2E**            | `apps/api/test/e2e/`      | Postgres (`riftbound_test` DB), API server | `decks-db.test.ts`, `auth.test.ts`, `collection-db.test.ts` |
| **Upstream probe** | `apps/api/test/upstream/` | Network + `PA_API_KEY`                     | PA catalog probe                                            |

E2E flow (`apps/api/scripts/run-tests.ts`):

1. Run all unit tests — **fail fast** if any fail
2. Run e2e with `--preload ./test/e2e/preload.ts --max-concurrency=1`

E2E preload syncs catalog/prices fixtures unless `E2E_SKIP_CATALOG_SYNC=true`.

### Mobile tests

- Pure logic: deck validation, catalog filters, collection math, theme contrast
- Prefer testing **behavior** in `lib/` and `utils/` over snapshotting components
- Import path alias `@/` works in tests

### Writing good tests

```ts
import { describe, expect, test } from 'bun:test';

describe('feature', () => {
  test('describes observable behavior', () => {
    expect(fn(input)).toEqual(expected);
  });
});
```

- **Unit:** one concern per test; use fixtures/mocks, not live DB
- **E2E:** unique emails like `test-feature-${Date.now()}@test.riftbound.dev`; clean up in `afterAll` via `cleanupTestUsers`
- **Contracts:** table-driven cases for edge cases in coercion and validation
- When fixing a bug, add a test that would have caught it

---

## Database & migrations

```bash
bun run db:up          # docker compose up postgres (port 5433)
bun run db:migrate     # drizzle-kit migrate (apps/api)
bun run db:generate    # generate migration from schema changes
bun run db:studio      # Drizzle Studio
```

**Agents must never run destructive database commands** — not on local Postgres, test DB, or production/Railway. Forbidden: `db:reset`, `db:reset:full`, `scripts/reset-db.ts`, `DROP`/`TRUNCATE`/unscoped `DELETE`, `drizzle-kit drop`, or any command that wipes tables or databases. Use forward-only `db:migrate` and scoped test helpers (e.g. `cleanupTestUsers`) instead. Ask the user before any operation that could delete production data.

- Schema: `apps/api/src/db/schema.ts`
- Migrations: `apps/api/drizzle/`
- Test DB: `postgres://riftbound:riftbound@localhost:5433/riftbound_test` (auto-created by `scripts/test.mjs`)

**After schema changes:** generate migration, apply locally, run e2e tests that touch affected tables.

---

## API conventions (`apps/api`)

```
src/
  index.ts          # Entry — loadEnv, migrate, listen
  app.ts            # createApp — wires routes, services, auth
  env.ts            # Zod-validated environment
  auth.ts           # Better Auth
  db/               # Drizzle client + schema
  routes/           # Elysia route modules (parse with contracts)
  services/         # Business logic
  upstream/         # Piltover Archive HTTP client (PaClient)
  plugins/          # error handler, auth plugin
```

- Routes are factory functions: `createCardsRoutes(deps)` mounted in `app.ts`
- Validate inputs with `Schema.parse()` from `@riftbound/contracts`
- Validate responses before returning when shape is non-trivial
- Auth: Better Auth at `/api/auth/*`; e2e uses cookie-based `authFetch` helpers
- Errors: use `plugins/error-handler.ts` patterns — do not leak stack traces in production

Local dev:

```bash
bun run dev:api      # watch mode on port 7000
bun run dev:mobile   # Expo on port 7001
```

---

## Mobile conventions (`apps/mobile`)

See **[`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md)** for UI rules (tetra-ui, Uniwind, theming, component registry).

Highlights:

- **Expo Router** file-based routes under `app/`
- **TanStack Query** for server state; invalidate queries after mutations
- **API client:** `src/api/client.ts` — always parse responses with contract schemas
- **Deck logic:** `lib/deck-*` — validation rules should align with `packages/contracts/src/deck-rules.ts`
- **No direct Piltover Archive calls** — go through `EXPO_PUBLIC_API_URL`
- **Deck I/O:** `lib/deck-io.ts` — PiltoverArchive text import/export; align with PA community format

---

## Change workflow

```mermaid
flowchart LR
  A[Understand task] --> B{API shape change?}
  B -->|yes| C[Update contracts + tests]
  B -->|no| D[Implement]
  C --> D
  D --> E[typecheck + lint]
  E --> F[unit tests]
  F --> G{DB / routes touched?}
  G -->|yes| H[e2e tests]
  G -->|no| I[Done]
  H --> I
```

1. **Read** relevant code and existing tests before editing
2. **Minimize scope** — match surrounding style; no drive-by refactors
3. **Contracts first** when the wire format changes
4. **Write or update tests first** when changing behavior, then implement to green
5. **Run checks** (see Quality gate)
6. **Do not commit** unless the user asks

---

## Code style

- **ES modules** — `import`/`export`, `.js` extensions in API/contracts transpiled output
- **Naming:** `camelCase` functions/vars, `PascalCase` types/components, `kebab-case` files in routes
- **Imports:** type-only imports separated (`import type`)
- **Comments:** only for non-obvious business rules, and keep each comment to one line
- **Errors:** prefer typed errors and contract validation messages over silent coercion
- **No secrets** in code — use `.env` (API) or `EXPO_PUBLIC_*` (mobile)

### Cleanup standards

- Keep Zod schemas composable and centralized with shared helpers instead of repeated inline primitives
- Add or extend backend unit tests for every cleanup or behavior change, and leave them passing
- Prefer TDD for contract, route, and service changes so failing expectations drive the refactor

---

## Do not

| Avoid                                                                                           | Do instead                                                                                      |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Skip `bun run typecheck` / `lint` / tests                                                       | Run scoped checks at minimum                                                                    |
| Duplicate Zod shapes outside `contracts`                                                        | Import from `@riftbound/contracts`                                                              |
| `any` or unchecked `as` on JSON                                                                 | `.parse()` / `.safeParse()`                                                                     |
| Call piltoverarchive.com from mobile                                                            | Use our API client                                                                              |
| Treat The Astral Grove as a PA fork or mirror                                                   | We are our own product; PA is upstream data only                                                |
| Edit imported/upstream decks in place                                                           | Import into an owned copy first                                                                 |
| `StyleSheet.create` / legacy theme in mobile                                                    | tetra-ui + Uniwind (see mobile AGENTS.md)                                                       |
| Edit `dist/` or `drizzle/` generated output by hand                                             | Regenerate from source                                                                          |
| Force-push `main` or amend pushed commits                                                       | New commits unless user requests                                                                |
| Large unrelated formatting diffs                                                                | Keep PRs focused                                                                                |
| Destructive DB commands (`db:reset`, `DROP`, `TRUNCATE`, unscoped `DELETE`, `drizzle-kit drop`) | Forward migrations (`db:migrate`), scoped test cleanup only; ask user before prod-impacting ops |

---

## Reference docs

- [`SPEC.md`](SPEC.md) — product spec and architecture history
- [`apps/mobile/AGENTS.md`](apps/mobile/AGENTS.md) — Expo, tetra-ui, Uniwind
- [Expo SDK 57 docs](https://docs.expo.dev/versions/v57.0.0/)
- [Elysia docs](https://elysiajs.com/)
- [Drizzle ORM docs](https://orm.drizzle.team/)
- [Zod docs](https://zod.dev/)
