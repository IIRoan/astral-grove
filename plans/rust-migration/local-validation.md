# Rust backend local validation

Implementation branch: `rust-backend-rewrite`. Original Astral Grove revision: `598a9189d8beb1222a789ed836d37754e4826001`. Rocal reference: `b28edbe04e1ecccbe01ebf4e77b173f6d4a12a8e`.

The production backend is now `apps/backend`. Expo screens, state, persistence, native identifiers and the marketing site are unchanged. This report records local acceptance before branch publication; hosted CI is a separate verification step. No deployment was performed. The ignored `apps/api/.env` remains untouched; QA uses synthetic configuration and explicitly selected loopback databases.

## Baseline and scope of coverage

- **84/84 original backend source files** are byte-pinned against Git in `baseline/source.json`; the executable oracle lives in `tests/reference-api/src` and is excluded from the production image.
- **516/516 named functions/methods exercised** across original unit, HTTP/DB, integration-boundary, startup and transient-startup runs. `baseline/functions.json` records the tiers; `function-destinations.json` maps each source file and its function count to native modules. This is named-function coverage, not 100% branch, anonymous-callback, or input-space coverage.
- **617 original named cases** remain accounted for: 398 unit and 219 e2e. Three private-file-dependent CSV skips were replaced by a distributable synthetic 725-row/1,597-copy fixture. Eight extra oracle unit cases bring the retained unit suite to 406. Five additional oracle integration cases exercised previously uncovered boundaries during baseline collection.
- `test-destinations.tsv` distinguishes retained oracle units from compatibility cases. `test-destinations.ts` validates real source identifiers and JUnit execution counts, including parameterized names and duplicate occurrences. No row remains planned or silently skipped.
- Compatibility tests direct HTTP to Rust, but some also invoke reference TypeScript services/DB helpers. Those direct calls are oracle evidence, not newly ported Rust tests. Native process/integration tests and differential corpora provide independent Rust evidence.
- **55 application operations + 42 auth method/path pairs** match the mounted inventory. The 40 auth definitions include disabled/unconfigured endpoints with explicit responses; three server-only functions remain unexposed. Unique operation IDs and required path parameters are checked.

The initial baseline audit and its original failure/race evidence are preserved in [pre-migration-validation.md](pre-migration-validation.md). Later native results supersede its planning-only statements.

## Contract and runtime verification

| Gate                                                                                   | Local result                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Shared schema parse/default/coercion/boundaries                                        | 45,050 cases, zero mismatches                                                     |
| Installed Better Auth request-schema behavior                                          | 2,318 cases, zero mismatches                                                      |
| Business logic: search, Cardmarket matching/guide rows, prices, CSV/TTS, deck legality | 2,228 cases, zero mismatches                                                      |
| Auth HTTP errors, routes, redirect/origin and protocol behavior                        | 100 cases, zero mismatches                                                        |
| Application HTTP transport/body boundaries, authenticated and unauthenticated          | 192 cases, zero unexpected mismatches; 86 explicitly classified corrections below |
| Rust/OpenAPI versus shared Zod output types                                            | All 135 bidirectional compile-time assertions; generated-file drift check         |

The compressed corpora contain synthetic/public card data and expected oracle results. Checkers regenerate the current oracle results and compare them with the pinned corpus before comparing the native validators. OpenAPI is generated from the actual native route registration and schema implementations, not a handwritten TypeScript interface mirror. Successful response bodies are validated through the retained Zod schemas in HTTP suites; the transport boundary probe separately checks success status and error bodies.

## Native HTTP and external integration coverage

Native tests launch a Rust binary and PostgreSQL, using loopback PA/Cardmarket/CDN, JMAP and S3 fixtures. The 22 native integration cases cover existing Better Auth password/cookie/bearer interoperability in both directions, session lifetimes/renewal/freshness/revocation, profile privilege protection, OTP attempts/expiry/eight competing consumers, email verification/reset/email change/JWT proof, catalog/price sync, image decoding/resizing/cache/conditional requests, signed release GET/HEAD MIME and filename behavior, per-finish quantities, and database timestamp round trips. Long fractions are truncated before PostgreSQL can round them, matching JavaScript for acquisition and legality dates, including pre-epoch and year-boundary values. Existing audit cursor precision remains six digits.

The S3 fixture independently verifies SigV4; Bun-generated signatures cross-check the verifier. Native image GET/HEAD/PUT and followed APK presigned downloads therefore exercise the signature rather than trusting any URL. JMAP tests perform real local discovery and Email/Submission requests. They do not send mail or write real object storage.

Concurrency regressions are explicit: 16 simultaneous first reads create one membership without an aborted transaction; two invitation acceptors produce exactly one success and at most two members; former members and revoked sessions stop receiving private live events. Subscription-limit/disconnect/shutdown tests check bounded SSE resources. HTTP tests exercise empty default bodies, malformed JSON before authentication and PATCH preflight.

Maintenance commands are native too. The audit test corrupts one synthetic/local fixture card, observes a failed read-only field audit, applies `--fix`, and verifies the repaired hash/name. Retention tests reject implicit database selection and verify dry-run row counts remain unchanged. Search diagnostics run all 33 benchmark queries with EXPLAIN and local-service timings, with PA unreachable and read-only EXPLAIN transactions.

## Database and migration proof

The 16 committed SQL files remain byte-identical. The native advisory-lock migrator owns the original Drizzle ledger/checksums/timestamps; no production Drizzle/Bun process is needed. Native startup applied all 16 migrations to a newly created empty local database, then the native suites seeded only public/synthetic fixtures.

An isolated clone of the old test database's **schema and migration ledger only** was upgraded twice. All 17 history rows, its extra historical timestamp, all 24 public tables including `card_art_fingerprints`, and all 42 `timestamptz(6)` columns were preserved. Normalized schema SHA-256 before and after is identical; see [database-proof.json](baseline/database-proof.json). The original test database was read only for this proof; no accounts/collections were copied. No database/table was reset, truncated or dropped.

Test databases are loopback-only `riftbound_test` / `riftbound_test_*` targets. Existing development/test data and extra migration history were not removed. Synthetic users are cleaned up with scoped helpers. Scratch databases remain available for review.

## Intentional corrections

| Legacy behavior found during baseline/probes                            | Native behavior and evidence                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| First-membership race could leave a transaction aborted (`25P02`)       | Serialize bootstrap on the user row; 16-way native HTTP regression                                   |
| Two competing invite acceptors both succeeded, yielding three members   | Serialize sharing with advisory/row locks; one native success and two members                        |
| Departed users could retain old collection live subscriptions           | Recheck current session and membership before every event/heartbeat; native leave/revoke regressions |
| Web CORS omitted PATCH despite version-rename routes                    | PATCH preflight allowed and tested                                                                   |
| 70 malformed-schema transport cases returned detailed 500/Zod internals | Controlled 422 `{error:"VALIDATION_ERROR",message:"Request validation failed"}`                      |
| 16 malformed JSON cases exposed parser details                          | Status remains 400 with controlled public error envelope                                             |

The HTTP probe only exempts those exact legacy/native error structures; every other difference fails. The original relative quantity-performance assertion and absolute latency budgets remain unchanged. A fresh release run exposed a fixture defect: the setup could add a foil stack through HTTP and then insert a second regular stack for the same sampled variant directly in SQL, while asserting one result per variant. The bulk fixture now skips that already-seeded variant. A native regression separately verifies that the API correctly retains both finishes, sums condition stacks and deduplicates requested variants.

## Production artifact and remaining evidence boundaries

`Dockerfile.backend` builds a pinned Rust release and a Debian TLS runtime as UID/GID 10001. No Bun, Node, TypeScript server, reference source, environment file or mobile source enters the runtime image. Backend IaC selects this Dockerfile; mobile IaC remains unchanged. The native dev/CLI wrappers retain the old ignored environment-file fallback without moving it.

The final root, packaged-binary and container results are recorded below. Native dev/CLI smoke also verified migration, health, restart after a watched file change, and clean wrapper/child signal handling using synthetic environment variables; see [development-proof.json](baseline/development-proof.json). Local tests do not establish device/browser interaction, hosted CI, live PA compatibility, real JMAP/S3 provider behavior, deployed TLS/routing, production migration inventory, backup restoration or a traffic-switch rollback. No deployment is part of this task. Before a later switch, retain the previous immutable backend image, inspect production history read-only, verify backup/restore in isolation, exercise both versions against the compatible schema, and verify hostname/cookies/SSE on the hosted test release. Current SSE delivery requires one replica.

## Final execution record

Toolchains: Rust/Cargo 1.98.1, pinned Bun 1.4.2 (the initial host Bun was 1.4.3), loopback PostgreSQL 16.15. All test results below are fresh executions; Turbo cached only dependency builds in the aggregate test run. Native Rust tasks and test tasks bypass Turbo result caching, and `TEST_DB_URL` is explicitly passed through its strict environment filter.

| Command / proof                                                           | Result                                                                                                                                       |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check`                                                           | Generated contract drift check, workspace TS, backend IaC TS, ESLint, Prettier, rustfmt and strict all-target Clippy                         |
| `bun run typecheck --force`                                               | 6/6 tasks, zero cached, all workspaces checked                                                                                               |
| `bun run test`                                                            | Entire monorepo gate, with explicit isolated `TEST_DB_URL`                                                                                   |
| `cargo test --workspace --locked` through root test                       | 30 native unit cases + 1 generator-check regression; zero failures/ignores                                                                   |
| Native-process HTTP suites through root test                              | 22 cases; zero failures/skips                                                                                                                |
| Original compatibility suites against native HTTP                         | 219 cases / 38 files; JUnit gate verifies every original identifier                                                                          |
| Retained oracle units                                                     | 406 pass, including all 398 original cases; zero skips                                                                                       |
| Contracts                                                                 | 152 pass                                                                                                                                     |
| Mobile                                                                    | 1,029 pass                                                                                                                                   |
| Release publishing and test-target guards                                 | 24 pass                                                                                                                                      |
| Extra baseline integration probes against the frozen backend              | 5 pass; local upstream/mail/storage fixtures                                                                                                 |
| `cargo xtask baseline`                                                    | 84 byte-pinned source files, 516 exercised named functions, 617 test dispositions, 16 unchanged SQL files, 97 native operation registrations |
| Production container build                                                | PASS, pinned release image, UID/GID 10001, no Bun/Node in runtime                                                                            |
| Same suites with `ASTRAL_BACKEND_BIN` set to the image's extracted binary | 22 native cases + 219 compatibility cases                                                                                                    |
| Production-mode container HTTP and active-SSE shutdown                    | Database health, signup, secure-cookie session, immediate ready event and clean exit 0 within the 5-second stop bound                        |
| Existing-schema upgrade and negative migration probes                     | Schema/17 ledger rows preserved; altered checksum and missing historical entry rejected; cloned ledger restored                              |

The exact image ID/binary SHA-256 and runtime result are in [container-proof.json](baseline/container-proof.json). [acceptance.json](baseline/acceptance.json) records final counts and command outcomes. Local raw logs are temporary `/tmp/astral-*` working evidence; durable source inventories, synthetic fixtures, corpora, case maps and proof summaries are kept in this directory and the test tree.

Reproduce the aggregate gate from the repository root with the pinned tools and a loopback test database:

```bash
export TEST_DB_URL=postgres://riftbound:riftbound@localhost:5433/riftbound_test
bun install --frozen-lockfile
bun run check
bun run test
cargo xtask baseline
bun test scripts/lib/internal-release.test.ts scripts/rust-migration/test-target.test.ts
```

For packaged-binary tests, build `Dockerfile.backend`, extract `/usr/local/bin/astral-grove-server`, set `ASTRAL_BACKEND_BIN` to that absolute path, and run the native HTTP and compatibility commands in the backend guide. The auth HTTP probe explicitly disables Better Auth's test-only origin/CSRF bypass on the reference context so the comparison exercises the configured policy even when invoked under `NODE_ENV=test`.
