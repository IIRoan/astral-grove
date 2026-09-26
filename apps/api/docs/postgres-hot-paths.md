# Postgres hot-path follow-ups

Additive indexes, a unique price upsert, slimmer search candidates, and
`price_history` retention after each successful price cron. Production DDL
still needs a separately approved window. This is not approval to run it.

## What landed

### Phase 1 — always on

- `collection_items_collection_updated_idx` on `(collection_id, updated_at DESC)`
  for the collection list `ORDER BY updated_at DESC`.
- Unique `(cardmarket_id, is_foil)` on `prices`, with sync
  `ON CONFLICT DO UPDATE` on that key and one set-based delete of slots
  that disappeared upstream. Migration dedupes existing siblings first
  (keep newest `fetched_at`).
- `variants_variant_number_lower_idx` btree on `lower(variant_number)` for
  equality / `IN` lookups. GIN trigram stays for fuzzy search.

After migrate: `ANALYZE prices; ANALYZE variants; ANALYZE collection_items;`

Large production tables may want `CREATE INDEX CONCURRENTLY` outside
Drizzle's transactional migrator if lock time is bad. Same caution as
the search-index rollout.

### Phase 2 — not added

Filter B-trees on `cards(energy|might|power)` and `variants(rarity)` /
`(set_id, rarity)` stay out until EXPLAIN on a populated catalog shows
seq-scan cost that those indexes remove. The local/test catalog is too
small for that proof (seq scans are expected). Do not add
`cards_type_lower_idx` for the current array-overlap type filter.

Capture with:

```bash
cd apps/api
bun scripts/explain-search.ts --target=test --use-env=TEST_DB_URL \
  --with-local-service --repeat=20 \
  --output=../../tmp/search-explain.json
```

### Phase 3 — slim materialize

`shouldMaterializeThenPage` still groups printings in process (search,
deck-builder filters, price sort). That path now:

1. Loads slim candidate columns (ids + sort/group keys).
2. Groups, ranks, and pages in JS. Vector merge is unchanged:
   lexical candidates + in-memory embedding rank.
3. Hydrates full variant/card columns for the page only, then prices/colors.

Browse without those filters still uses SQL `ORDER BY … LIMIT/OFFSET`.
Grouped filter queries cannot SQL-limit at the variant row without
changing group totals, so they stay slim-then-page.

### Phase 4 — history retention

`GET /api/v1/prices/history` and stats charts read `price_daily`, not
raw `price_history`. `price_history` is the sync audit/snapshot log.

Default policy: delete a snapshot if it is older than 90 days
**or** not among the newest 30 rows per `(cardmarket_id, is_foil)`.
`POST /api/v1/sync/prices` (called by the daily GitHub workflow) runs that
prune after every Cardmarket sync.

```bash
cd apps/api
bun scripts/prune-price-history.ts --target=test --use-env=TEST_DB_URL --dry-run
bun scripts/prune-price-history.ts --target=staging --database-url=... --apply
```

`--target=production` is refused.

## Local measurements (2026-09-15, `riftbound_test`)

After migration 0014, Cardmarket sync wrote 2979 unique `(cardmarket_id, is_foil)`
slots. `GROUP BY … HAVING count(*) > 1` was empty. Slot lookup used:

```
Index Scan using prices_cardmarket_foil_idx
  Index Cond: ((cardmarket_id = 845712) AND (is_foil = false))
```

Catalog tables were empty (no PA API key in this environment), so collection
and `lower(variant_number)` plans seq-scanned 0 rows — expected. Phase 2
filter indexes were not added.

History prune dry-run: `wouldDelete: 0` (snapshots younger than 90 days).

## Env

| Variable                         | Default | Notes                   |
| -------------------------------- | ------- | ----------------------- |
| `PRICE_HISTORY_RETAIN_DAYS`      | 90      | Age cutoff              |
| `PRICE_HISTORY_RETAIN_SNAPSHOTS` | 30      | Per cardmarket/foil cap |
