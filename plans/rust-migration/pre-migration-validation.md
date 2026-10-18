> Archived pre-implementation evidence. Current implementation and acceptance results are in [local-validation.md](local-validation.md).

# Local migration planning evidence

Date: 2026-10-18. Source revision: `598a9189d8beb1222a789ed836d37754e4826001`. No application, dependency, deployment or infrastructure source was changed while collecting this baseline. The only repository additions for this task are the migration plan and supporting inventories/documents.

## Environment observed

| Item                   | Observed value                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Bun                    | 1.4.3 locally; repo/CI pin 1.4.2                                                          |
| Rust/Cargo             | 1.98.1 locally; no Astral Grove Rust workspace exists yet                                 |
| Database               | Local Podman/Docker-compatible `riftbound-postgres`, PostgreSQL 16.15, loopback port 5433 |
| Existing test DB       | `riftbound_test`, explicitly selected through `TEST_DB_URL` by root runner                |
| Extensions             | `pg_trgm` 1.6 and `unaccent` 1.1, plus `plpgsql`                                          |
| Existing DB timestamps | 42 `timestamp with time zone` columns at precision 6                                      |
| Source backend         | 84 TypeScript source files, 14,356 lines under `apps/api/src`                             |
| Shared contracts       | 42 TypeScript files, 5,104 lines including tests under `packages/contracts/src`           |
| Fresh scratch DB       | `riftbound_test_rust_migration_audit_1792346565276`                                       |

Bun version drift is reported, not silently treated as the pinned CI runtime. Before final implementation handoff, rerun acceptance on the pinned toolchain as well. PostgreSQL evidence is local; no production schema or live host was inspected.

## Commands run and outcomes

Commands below describe the actual invocations, including focused follow-ups. They are not future Rust test results.

| Command/action                                                                               | Result                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `BUN_RESOURCE_LIMITED=1 bun run check`                                                       | PASS: TypeScript, ESLint, Prettier. Initial Turbo typecheck/build tasks were cached; fresh typecheck was run separately below |
| `BUN_RESOURCE_LIMITED=1 bun run typecheck --force`                                           | PASS: 4 tasks successful, 0 cached (17.839 seconds)                                                                           |
| `BUN_RESOURCE_LIMITED=1 bun run test`                                                        | FAIL overall: API e2e performance comparison failed; other package suites completed                                           |
| API unit portion of root run                                                                 | 395 pass, 3 skip, 0 fail across 79 files; 398 observed cases                                                                  |
| API e2e portion of root run                                                                  | 218 pass, 1 fail across 38 files; 219 observed cases, real local PostgreSQL                                                   |
| Mobile portion of root run                                                                   | 1,029 pass, 0 fail across 129 files                                                                                           |
| `BUN_RESOURCE_LIMITED=1 bun run --cwd packages/contracts test`                               | Fresh run: 152 pass, 0 fail across 14 files                                                                                   |
| `BUN_RESOURCE_LIMITED=1 bun test scripts/lib/internal-release.test.ts`                       | 13 pass, 0 fail                                                                                                               |
| API focused performance suite with explicit local `TEST_DB_URL`, `NODE_ENV=test` and preload | 14 pass, 1 fail across 15 cases; same failing comparison                                                                      |
| Runtime route enumeration compared with TypeScript AST inventory                             | PASS: 55 application method/path operations match; middleware wildcard/OPTIONS entries excluded and noted                     |
| Constructed auth API/context enumeration with synthetic config                               | 40 mounted endpoint definitions, 3 server-only functions; defaults captured in `inventory.json`                               |
| Existing migration history SHA-256 comparison                                                | All 16 committed migration hashes match local test history; one additional old history row exists                             |
| Fresh Drizzle migrator against newly created scratch DB                                      | PASS: 16 migrations, 23 public tables                                                                                         |
| Concurrent first membership probe                                                            | FAIL invariant: 11/12 succeeded, one rejected with PostgreSQL `25P02`                                                         |
| Concurrent accept of one invite by two users                                                 | FAIL invariant: both succeeded, final collection member count 3, product maximum 2                                            |
| Scoped probe-fixture cleanup                                                                 | PASS: four synthetic users removed; read-back found zero matching synthetic users                                             |

The ordinary root suite can read API `.env` for non-database settings, use cached catalog/prices in `riftbound_test`, and reach live upstream integrations. This run therefore proves the current HTTP+local-DB behavior on that setup; it is not the deterministic, network-independent migration oracle required by the plan. No production database was selected.

Turbo warned that it could not parse the Bun lockfile workspace shape (`invalid type: map, expected a string`, line 143). Checks continued. This warning needs separate toolchain consideration; it was not treated as a failed typecheck or as evidence of Rust readiness.

## Repeatable latency baseline failure

Source: `apps/api/test/e2e/performance.test.ts:156`.

Case: `API response times (cached catalog) > collection quantities stays within budget for targeted lookups`.

The test first satisfies the absolute 400 ms quantity budget, then compares one quantity request against one full-list request with `quantities.ms <= fullList.ms * 1.5`. Initial run: 18.062217 ms against a 16.1636205 ms threshold. Focused rerun: 15.962333 ms against a 15.024756 ms threshold. Both fail the same relative check, far below the absolute budget.

This establishes a repeatable baseline failure in this setup, not a root cause or a production performance conclusion. Keep the case accounted for. During implementation use measured matched workloads, SQL/pool evidence and repeated samples to fix the path or improve the comparison with justification; do not simply raise a budget to claim green.

Raw follow-up output is temporarily at `/tmp/astral-grove-performance-baseline.log`; root package logs are under each package's ignored `.turbo/`. These paths are local working evidence, not durable external artifacts.

## Skipped CSV fixtures

Three `apps/api/test/unit/collection-csv.test.ts` cases skip because the private/sample CSV file is absent:

- `parses piltover sample CSV headers and rows`
- `handles quoted card names with commas`
- `parses full piltover sample with 1597 total copies`

The passing synthetic CSV cases still cover other parser behavior. The migration must add distributable synthetic equivalents or a safe reproducible fixture for these cases. Do not copy private collection data into a test artifact or describe skipped cases as passing.

## Migration-history comparison and fresh database proof

Source `apps/api/drizzle/meta/_journal.json` contains 16 ordered entries. The existing test database has 17 rows in `drizzle.__drizzle_migrations`, including an extra historical timestamp `1789670257771`. Every known entry's SQL SHA-256 matches. Existing test DB has 24 public tables, including `card_art_fingerprints`, which is absent from the current source schema.

The fresh scratch database was created on the same loopback PostgreSQL instance, and `drizzle-orm/postgres-js/migrator` applied the committed chain from empty. Read-back:

```text
fresh migration chain: PASS
migration_rows=16
public_tables=23
synthetic_users_remaining=0
```

This distinguishes stale local additive history from a broken fresh migration chain. The scratch database remains available. It was not dropped or reset, and no extra tables/history in the existing test DB were deleted or rewritten. Production history is unverified and needs its own read-only inventory before eventual cutover.

## Confirmed concurrent first-membership failure

Source: `apps/api/src/services/collection-membership.ts`.

Probe: create one synthetic user with the actual Better Auth signup handler on the fresh scratch DB; issue 12 concurrent `collectionShareService.getStatus(userId)` calls before membership exists.

Observed: 11 fulfilled, 1 rejected with PostgreSQL `25P02` (`in_failed_sql_transaction`). The service handles a unique-membership race by catching an insert error and attempting another SELECT inside the same now-aborted transaction. A transaction-level conflict-safe recovery strategy is required.

Rust regression requirement: all concurrent first-access requests succeed and return the same collection membership; exactly one membership/container persists, no failed transaction/orphan data, and unrelated users remain isolated. Preserve a named old-backend exception until the Rust case passes.

## Confirmed concurrent invite-accept capacity violation

Source: `apps/api/src/services/collection-share-service.ts`, `acceptInvite`.

Probe: create a synthetic owner and two joiners, establish each personal membership, create one owner invite, then concurrently accept that same token as both joiners in `merge` mode.

Observed: both calls fulfilled and the owner's status returned member count **3**, exceeding the product maximum of **2**. Reads/checks occur inside transactions, but the invite/capacity checks are not serialized by the required locks.

Rust regression requirement: exactly one acceptance succeeds; the losing call returns the chosen compatible conflict/invalid-invite response; the target ends with exactly two members, the loser keeps their personal collection and all items, and audit/invite state is consistent. Add acceptance-versus-revoke/expiry/leave cases and repeat with non-empty finish-aware stacks.

The temporary probe used only the scratch DB, synthetic secrets, the actual local signup handler and empty collections. PA, S3 and JMAP were disabled. Four fixture users were removed with a predicate limited to their IDs and run-specific synthetic email prefix. A subsequent read-only query found zero matching users. The temporary script is `/tmp/astral-grove-migration-probes.ts`; its summary output is `/tmp/astral-grove-concurrency-baseline.log`.

## What these results do not establish

- No Rust implementation, compile, Rust unit/API suite, generated Rust→Expo contract check, resource-budget run or TS↔Rust interoperability has been completed.
- No production container image, staging service, live Railway configuration or public endpoint was built, mutated or tested.
- No real iOS/Android device or browser UI was tested in this task.
- Mail was disabled by the existing e2e preload; passing auth tests do not prove verification/reset delivery or mail-enabled policy.
- A successful fresh TS migration does not prove a Rust migration runner preserves Drizzle history or production extras.
- Rocal's deployment/benchmark/test results are reference evidence recorded by its repository, not freshly rerun results here.

The plan marks all of those as future gates. A baseline with one test failure and two confirmed race failures is not a production cutover approval.
