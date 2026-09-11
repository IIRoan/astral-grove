# Search index rollout

Additive PostgreSQL search improvements for The Astral Grove. Production
database changes require separate authorization. This document is the
reviewed runbook, not approval to run them.

## What this change does

- Folds accents in the shared JavaScript normalizer and in
  `public.normalize_card_name_v1`.
- Stores `cards.name_norm`, `cards.name_squashed`, and
  `cards.rules_search_text`, plus matching trigram/type indexes.
- Groups and paginates by printing family, then hydrates only the selected
  page (price sort still loads price keys for every candidate group).
- Leaves `pg_trgm` in place. Does not add pgvector, stemming, stopword
  expansion, or an API search-mode field.

## Immutability assumption

`unaccent` is not inherently immutable. `normalize_card_name_v1` is marked
`IMMUTABLE` only because we pin `public.unaccent` and promise not to change
that dictionary. Do not `CREATE OR REPLACE` the wrapper to change rules.
A future change needs a new function version and a stored-column rewrite.

## Operator setup (local / test)

`riftbound` on the compose Postgres image is a superuser and can create
extensions. Apply forward migrations as usual:

```bash
bun run db:up
bun run --cwd apps/api db:migrate
```

If `unaccent` is missing in a database, the migration creates it in
`public`. Confirm with:

```sql
SELECT extname, extversion, nspname
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname IN ('pg_trgm', 'unaccent');
```

## Diagnostic (database only)

Never omit `--target` / `--database-url` or `--use-env`. The script refuses
production and does not call API search (API search can backfill from PA).

```bash
cd apps/api
bun scripts/explain-search.ts --target=test --use-env=TEST_DB_URL \
  --output=../../tmp/search-explain-test.json
bun scripts/explain-search.ts --target=test --use-env=TEST_DB_URL \
  --with-local-service --repeat=20 \
  --output=../../tmp/search-explain-test-service.json
```

Capture cold vs warm in-process cache separately from Postgres buffers.
Text queries currently skip the service result cache; do not restart
production or `DISCARD` buffers to fake a cold database. `--repeat`
samples process-warm `searchLocalWithoutUpstream` timings only.

## Benchmark-gated indexes (not in the first migration)

Measure before adding:

- B-trees on `energy`, `might`, `power`
- `variants_rarity_idx` and/or `(set_id, rarity)`
- Set-name trigram index
- `name_norm` btree / `text_pattern_ops`

Do not add `cards_type_lower_idx` for the current array-overlap type filter.

## Preflight (production, after separate approval)

1. Confirm backup/recovery and the target Railway service/environment.
2. Confirm `pg_trgm` and `unaccent` are installed, their schemas, server
   version, relation sizes, index definitions, and drizzle journal (last
   applied tag should be `0011_user_settings` before this rollout).
3. Rehearse the generated-column rewrite on a populated staging copy and
   record exclusive-lock duration. Stored generated columns rewrite the
   table. `CREATE INDEX CONCURRENTLY` cannot run inside Drizzle's
   transactional migrator and does not avoid that rewrite.

If the measured rewrite window is unsafe, stop. Present the blocker for a
separately approved online rollout.

## Apply (production, after separate approval)

1. Run the additive migrations in the agreed window **before** deploying
   API code that reads the new columns.
2. `ANALYZE cards; ANALYZE variants;`
3. Confirm generated values and `pg_index.indisvalid`.
4. Deploy API + mobile/shared changes.
5. Run bounded smoke checks against the named benchmark cases.
6. Compare ordering first, then latency. Intended deltas are accent
   support and corrected grouped totals, not lost matches.

## Rollback

Roll back the application. Leave additive columns, functions, and indexes
in place. No down migration and no data deletion. Do not replace
`normalize_card_name_v1` in place as a rollback.

## Residual costs to report

- Fuzzy `unnest(name_norm) + similarity()` is a residual scan of `cards`.
- In-memory grouping/ranking over matching metadata.
- Embedding provider time and incompatible-vector skips.
- Upstream PA reconciliation latency (unchanged, measured separately).

## Local test-DB measurements (not production)

Captured 2026-09-10 against `riftbound_test` (PostgreSQL 16.15,
`pg_trgm` 1.6 and `unaccent` 1.1 in `public`). Approximate sizes:
271 cards, 558 variants, 11 sets. This catalog is incomplete (e2e
sync hit Bun's 10s idle timeout), so do not advertise a percentage
improvement from these numbers.

`--with-local-service --repeat=5` (no PA reconcile):

- Tight name queries (`jinx`, `ambessa`, `embessa`): warmed p50 total
  about 6–12ms; `dbMs` is most of that.
- Wide prefix/set queries (`OGN-`, `origins`, `unit` beyond the old
  500-row cap): `dbMs` stayed ~4–9ms; `rankMs`/`groupMs` dominated
  (about 50–95ms) because embeddings rerank all candidate groups before
  the page is sliced.
- Page hydration scaled with the selected groups: out-of-range pages
  had `colorsMs`/`pricesMs` = 0; a 40-item page hydrated those IDs only.
- Shared buffer reads were 0 after warmup (hits only). Plans were
  Hash Join / Nested Loop; sequential scans on this size are expected.
- `q=a` is stopword-only and correctly returns no rows.

Production still needs a separately approved window, `ANALYZE` after
the rewrite, and a 100-iteration warmed p50/p95 on a populated copy.
Benchmark-gated B-trees (energy/might/power, rarity, set-name trigram)
were not added.
