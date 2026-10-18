# Astral Grove backend compatibility and test requirements

This checklist records compatibility requirements against `598a9189d8beb1222a789ed836d37754e4826001`. The native implementation is under `apps/backend`; the original paths below refer to the frozen source now under `tests/reference-api/src`. See [local validation](local-validation.md) for completed evidence and explicit limits. The companion `inventory.json` contains source locations, actual route factory names and directly referenced boundary schemas. Helpers add schemas that are not visible in that direct-reference list; the completed Rust DTO/OpenAPI inventory must include those too.

## Application behavior by domain

| Domain                       | Existing implementation                                                                                                                          | Rust destination                                           | Mandatory evidence                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP platform                | `app.ts`, `env.ts`, `plugins/*`, `lib/{api-error,request-validation,trusted-origins,rate-limit,http-listen}.ts`                                  | `http`, `config`, `error`, `middleware`                    | Methods/aliases, CORS, cookie origins, compression/cache headers, bounded bodies/timeouts, invalid transport, graceful shutdown, no raw error disclosure    |
| Auth                         | `auth.ts`, `db/auth-schema.ts`, `lib/{auth-advanced,auth-cookie-domain,bearer-session,session,email,verification-email,password-reset-email}.ts` | `auth/{core,pipeline,service,cookies,password,otp,email}`  | TS↔Rust passwords/cookies/bearer/OTP/reset interoperability; mail enabled/disabled; actual Better Auth React and Expo clients                               |
| Catalog/detail/index         | `services/{card-cache,card-mapper,variant-resolver}.ts`                                                                                          | `catalog/{store,mapper,query}`                             | Logical card versus printing/group counts, raw upstream preservation, details/price fallback, batch ordering/notFound, cache/upstream/mixed source metadata |
| Catalog sync/metadata        | `services/{sync-engine,catalog-metadata,catalog-probe}.ts`, `lib/{catalog-total,upstream-list-params}.ts`                                        | `sync`, `catalog/metadata`, `upstream`                     | Separate `catalog`, `catalog_upstream`, `catalog_probe` state; force/incomplete/retry paths; per-set and foil completeness; fingerprint publication         |
| Search                       | `lib/{search,search-sql,search-candidates,card-types-filter,card-colors-filter}.ts`, shared `search-query`, `card-printings`                     | `catalog/query`, `search`                                  | Matched query corpus, SQL semantics, relevance/ties, full-candidate grouping/sorting/pagination, bounded page hydration                                     |
| Cardmarket IDs/printings     | `services/cardmarket-id-backfill.ts`, `lib/{cardmarket-id-match,variant-cardmarket,synthetic-signed-overnumbered,signature-image}.ts`            | `cardmarket/{matching,backfill}`, `catalog/{mapper,store}` | Correct set/expansion anchors, no ambiguous guessing, explicit upstream IDs preserved, foil sharing, existing signed synthesis/image fallback               |
| Price storage/stats          | `services/price-cache.ts`, `lib/{cardmarket-price-rows,price-stats,price-history-retention}.ts`, upstream export/products                        | `prices`, `cardmarket/guide`                               | Decimal/zero/null distinctions, stable IDs/hashes, daily versus snapshot history, stats/target price semantics, transactions, retention dry run             |
| Collection membership/stacks | `services/{collection-membership,collection-service}.ts`                                                                                         | `collection/{membership,service}`                          | One membership under concurrent first access; exact finish/condition/language keys; atomic increments/decrements; user isolation and audit consistency      |
| Import/export                | Collection service, shared `collection-csv`, `collection-tts`                                                                                    | `collection/{imports,formats}`, golden suite               | Parser/aggregation/order/error parity, CSV quoting/headers, TTS tokens, preview, variant resolution, partial results, mode precedence                       |
| Audit/activity               | `services/collection-audit-service.ts`, shared `collection-audit`                                                                                | `collection/audit`                                         | Actor/collection authorization, filter precedence, cursor microseconds/UUID tie breaks, nonzero activity, exact before/after/delta and bounded pages        |
| Sharing                      | `services/collection-share-service.ts`, `lib/invite-token.ts`                                                                                    | `collection/share`                                         | Atomic two-member limit, single-use invite, expiry/revoke/merge/discard/leave, owner/member semantics, legacy/hash tokens, no unrelated inventory loss      |
| SSE                          | `routes/collection.ts`, `services/collection-live-hub.ts`, shared `collection-live`                                                              | `collection/live`                                          | Three event types, correct scope/actor/reason, eight-listener limit, 25-second heartbeat, abort/backpressure/shutdown and membership/session revocation     |
| Deck legality                | shared `deck-rules`, `card-legality`, `champion-tags`                                                                                            | `deck_rules` plus goldens                                  | Same rules version, formats, issue order/severity, banned/copy/domain/champion/section rules and overrides; TypeScript validator remains on-device          |
| Owned/upstream decks         | `services/{deck-service,deck-sync}.ts`, `lib/upstream-deck-list-params.ts`                                                                       | `decks/{routes,service,upstream}`                          | Read-only upstream views; editable imported copies; per-user composite keys; server-owned provenance; best-effort PA failures without local data loss       |
| Deck versions                | Deck service and `user_deck_versions`                                                                                                            | `decks/{routes,service}`                                   | Active pointer consistency, copy/rename/activate/save/delete, max 25, last-version protection, concurrent mutation cases and family metadata preservation   |
| Wishlist                     | `services/wishlist-service.ts`                                                                                                                   | `user_data`                                                | Per-user unique variant, priority/defaults/nulls, catalog joins, upsert/remove idempotence and response validation                                          |
| Settings                     | `services/user-settings-service.ts`, shared `settings`                                                                                           | `user_data`                                                | Phone/desktop isolation; defaults; omitted partial merge, malformed stored data fallback, timestamps and concurrent patch characterization                  |
| Images                       | `services/image-store.ts`, `lib/{s3,image-resize,image-resize-buffer,capped-body,ttl-cache}.ts`                                                  | `images`                                                   | Safe keys, origin fallback, negative/cache single-flight, byte/entry/decode caps, formats/orientation/no enlargement, 304/redirect/ETag semantics           |
| Internal releases            | `routes/releases.ts`, `lib/internal-release.ts`, `scripts/lib/internal-release.ts`                                                               | `releases`; standalone publishing helper remains TS        | Per-key HMAC, ten-file allowlist, existing URL validity, GET/HEAD, HTML/plist handling, signed downloads, no-store/security headers                         |

### HTTP and validation specifics

- Preserve `{data,meta}` response envelopes, status codes and all route-specific error bodies. There is no single Rocal-style `statusCode/requestId/timestamp/details` envelope here. Core auth errors use Better Auth's own `{code,message}` responses.
- Schema parse failures return 422 with the generic validation message; outbound schema failures return 500. Some domain routes deliberately return `{error: ...}` or `{data:null}`. Model those alternatives truthfully.
- In particular, collection PUT/add/remove can return `{data:null}` even though `CollectionItemResponse` alone describes only a non-null item. Introduce the correct nullable wire response for these operations in the contract work; preserve the actual HTTP behavior.
- Most Zod object schemas strip unknown fields. Bodies can be merged with path values using `mergeRequestBody`, which turns a non-object body into an empty object before adding path keys. Compare this behavior rather than assuming raw-body rejection is uniform.
- Query booleans accept only strings `true`/`false`; numeric query coercion follows Zod/JS `Number`, including boundary behavior. Dates and string lengths need JS-compatible semantics. `ImageThumbQuery` uses `parseInt` and ignores unsupported widths, including its current prefix-parsing behavior.
- CORS is permissive in development and resolves configured browser origins in production; credentials are enabled. Trusted native schemes differ from browser CORS origins. Preserve secure-cookie selection for HTTPS even outside production, explicit/shared cookie domains, and each cookie's expiry/clear attributes.
- General production API rate limit is 180 requests per 60 seconds; OPTIONS, health and images are exempt. Image origin misses have separate per-IP/global limits. The current limiter implementation uses a fixed reset window despite its function name; characterize behavior before changing it. Bound/prune the Rust key store and fail safely at capacity.
- Forwarded IP handling uses a single validated `x-real-ip`, with `unknown` fallback, rather than trusting a client-supplied X-Forwarded-For chain. Validate the actual proxy topology before production reliance.
- Preserve health's current `{status:"ok",db,lastCatalogSync,emailVerificationRequired}` shape even when DB status is `error`; separately decide any readiness/non-200 behavior only as a documented compatible operational change.

### Catalog, search and hashes

Public `refresh=true` only refreshes when the admin bearer token also validates. Ordinary catalog results have their cache headers; a privileged refresh does not share the same response-cache treatment. Normalize both slash forms for collection/root routes without changing the current native URLs.

Port the whole search pipeline, not a name `ILIKE`: identity/type-intent parsing, spelling/trigram fallback, normalized/squashed names, rules/flavor text, tags, artists, printing types and set matches. Keep `pg_trgm`, `unaccent`, `normalize_card_name_v1`, generated stored columns and indexes. Compare query results on the same database/collation. JavaScript `localeCompare`, accent handling and Rust byte ordering are not interchangeable; use a tested deterministic equivalent and fixtures with punctuation, accents and ties.

Correctly combine `all`/`within` color identity filters, compound card type tokens, supertype, rarity, variant JSON type membership (including Signed), token exclusions and energy/power/might ranges. Energy sort/range intentionally excludes no-cost types. Group printing families before pagination; alternate arts remain separate; price order considers all candidate groups, not just one alphabetical SQL page. Keep total/page/hasNext metadata and stable deduplication.

Preserve separate caches for search (5 minutes, 100 entries), upstream checks (15 minutes, 200 entries) and variant-ID resolution (30 minutes). Price/catalog fingerprint changes must invalidate the correct cache. Test cold/warm paths, concurrent misses, upstream 404/timeout/bad JSON and failed reconciliation. Do not publish a full upstream fingerprint after a truncated/failed import or infer completeness from a matching fingerprint alone.

`entityHash` uses recursively sorted object keys plus JavaScript JSON serialization. `pricesFingerprint` uses sorted `id:isFoil:lastUpdated:marketPrice` tuples with JS boolean/date/string formatting. `stablePriceRowId` derives from the exact SHA-256 string `astral-grove:cardmarket-price:<id>:foil|plain`. Golden tests must include number/string/null distinctions, float/negative-zero formatting and Unicode escaping; a generic Rust JSON hash is not automatically the same algorithm.

### Prices

Riftbound's configured Cardmarket game ID is 22. Keep export headers, nullable fields, timestamps and two-decimal persistence. Distinguish no non-foil guide from a real zero value: trend 0 with missing averages can mean unavailable; foil guides may be the only usable source. Keep current provider `cardmarket`, currency `EUR`, percentage rounding/trend labels and target-price units in cents.

Separate latest `prices`, append-only hash/time-qualified snapshots and daily points, including conflict keys and history timestamp ordering. Preserve transaction boundaries for a guide update, remove only obsolete price slots after a complete validated input, and never turn a timeout/partial export into deletion of valid prices. Retention defaults are 90 days and 30 snapshots per slot; test a dry run before apply and keep unrelated rows. Restore/recovery proof precedes any eventual production pruning change.

Variant-number lookup handles foil suffixes and base products. The current expansion-matching regression tests cover T1 versus Radiance Seraphine, promo separation, ambiguous matches, explicit upstream IDs and shared foil products. Keep those exact cases, not a simpler first-name-match backfill.

### Collections, sharing and audit

Stack uniqueness is collection + variant number + condition + language + finish. Omitted finish derives from catalog; `foilMode=both` does not itself mean the row is foil. Quantity lookup deduplicates inputs, returns separate finish rows, sums across condition/language, and emits a zero standard row only when neither finish is present. Requests permit up to 5,000 variants with bounded chunks; preserve order and totals.

An absolute quantity of zero removes that stack; add/remove deltas are positive at the route boundary and remove negates the delta. Preserve metadata default/null behavior, grade/acquisition fields, batch semantics and partial import reports. Make row mutation plus audit insertion atomic and emit live changes only after commit. Test overlapping increments/removals and failure injection at each write step; lost/inaccurate audit state is a migration defect even if the old implementation can exhibit it.

CSV export keeps the upstream PA header/label/quoting format, deterministic set/variant/condition ordering, UTF-8 content type and existing `piltover-collection-export.csv` filename. Preserve import precedence: non-empty explicit items, then TTS, then CSV. Explicit items honor set/add mode; TTS currently adds and CSV currently sets. Preview adds to existing quantity and resolves printings, but must not write inventory. Catalog resolution can populate cache; assert which effects are allowed.

Activity pagination uses `(created_at, id)` descending and retains PostgreSQL microseconds in `nextCursor.at`. The displayed event `at` remains ISO milliseconds. Test equal timestamps, submillisecond boundaries, invalid cursors, complete page traversal without skips/duplicates, collection versus actor access, mine/actor filter precedence and surviving actor history after collection deletion.

Sharing tokens are 32 random bytes as hex, stored as `sha256:<digest>` with legacy raw-token lookup support. The hash string must not become a usable bearer invite. Invites last seven days. Preview, expiry and acceptance errors differ; snapshot the current messages/statuses. `merge` sums matching finish stacks while preserving existing target metadata; `use_theirs` discards the joiner's old items with audit records. Leave creates a new empty personal collection; it does not copy shared inventory. Owner/member/partner identity and audit retention remain consistent.

Two baseline defects are already reproduced: the unique-membership recovery queries an aborted transaction, and two concurrent accepts of one invite can produce three members. Add deterministic barrier-based API/database tests and fix both in Rust. Test accept/revoke/leave/expiry crossings, lost joiner data, one active membership, deterministic lock order, rollback after failure and capacity. Do not count sequential happy-path sharing tests as race coverage.

SSE emits `ready`, `collection.changed`, and `heartbeat`; payloads contain collection ID, correct actor/reason and time as applicable. Maximum listeners per collection is eight; excess returns 429. Heartbeat is 25 seconds; proxy buffering is disabled. Use bounded channels and cancellation, release subscriptions/permits on disconnect, and avoid compressing/buffering a stream until events stop arriving promptly. Revalidate membership/session or close stale streams after leave/revoke so a former member cannot continue receiving private changes. Prove single-replica rollout behavior or implement tested cross-process delivery before adding replicas.

### Decks and validation

The shared rule version is `2026.1`, with Constructed and Pre-Rift behavior. Golden cases cover chosen champion/legend name/tag fallbacks, domain identity, banned effective dates, per-card max copies/Spiderling exceptions, signature total/sideboard restrictions, section counts, rune names and limited-format overrides. Preserve issue code/text/severity/order and `valid`/`hasErrors` derivation, not only a final boolean. The mobile validator remains local.

Owned decks are per-user `(user_id,id)` records. PA list/detail entries are read-only; importing makes an owned copy with server-assigned provenance and duplicate-import detection. Ignore forged incoming `upstreamId`/`importedFromId`; preserve stored provenance and trusted import values. A failed upstream create/delete must not discard a valid local owned deck or accidentally delete the source community deck.

Keep list source/query/preview/pagination behavior and fallback to owned data on upstream failure. Port upstream section/card-ID mapping, unresolved placeholders and variant-ID resolution. Test malformed/partial upstream decks, query escaping and partner write header rules without publishing synthetic test decks to PA.

Versions cap at 25, use default name `Current`, and expose active-first summaries. Name trim/length/default behavior stays compatible. Saving an inactive version must not replace the active deck; copying and activating preserve family ID/name/description/createdAt/provenance. Deleting the active version selects the intended sibling; deleting the last is 409. Serialize concurrent create/delete/activate operations to keep limits and pointers valid. Preserve epoch-millisecond timestamps and read-only/version/domain error shapes.

### Images and private release files

Allowed image paths are catalog `cards/`, `colors/`, and defined thumbnail widths. Reject traversal and SVG/active content; handle encoded paths, suffix case, unsafe response content types and redirects. The CDN host is fixed; do not let arbitrary upstream URLs turn the proxy into an unrestricted fetcher.

Current limits: 5 MiB per fetched body, 128 MiB/2,000 in-memory entries for 24 hours, 60-second negative S3 cache, origin miss limits of 120/IP and 600 globally per minute. Resizing uses two workers and a queue of at most eight. Preserve widths 96/160/240/320, no enlargement, orientation handling and WebP quality behavior; test decoded pixels/output dimensions/alpha/orientation, not identical encoded bytes across codecs. Bound decompressed pixels and cancellation time. Existing ETags use key and byte length; do not accidentally change 304 behavior when changing the encoder.

Without complete S3 config, image rewriting/storage is disabled and CDN behavior remains usable. With config, keep API image rewriting, S3-first serving, memory hits, bounded fill deduplication, lazy background writes and fallback redirects. Preserve cache-control, `x-image-source`, content type and conditional requests.

Only development/preview profiles and their `.ipa`, `.apk`, `.plist`, `.html`, `-qr.png` files are public release-route candidates. The per-object HMAC input is exactly `astral-grove:internal-release:<key>` using `S3_SECRET_ACCESS_KEY`, with constant-time verification. Fingerprint objects are not served. HTML/plist are served with no-store and no-referrer; other files redirect to a 3,600-second presigned URL with correct method/type/disposition. HEAD has no body and signs HEAD downloads. Existing published install URLs must keep working after cutover.

`scripts/lib/internal-release.ts` now imports standalone `scripts/lib/internal-release-signing.ts`. The native release implementation shares the test vectors, and all 13 publishing tests remain in the quality gate. The mobile internal-build pipeline must not depend on retired Elysia source.

### Startup, jobs and operational scripts

| Existing path/command                                    | Migration action                                                                                                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`, `db/migrate.ts`                          | Rust config → guarded migration → listen; preserve retry policy for transient DB errors, fail closed otherwise, drain on signals                            |
| `startCatalogMetadataWarmup`                             | Preserve configured/dev warmup and probe-disabled test mode; one tracked bounded task, no unobserved panics or shutdown leak                                |
| `.github/workflows/sync-catalog.yml`                     | Keep daily 02:00 UTC HTTP sync, force flag, long-run status polling and per-set coverage checks                                                             |
| `.github/workflows/sync-cardmarket-prices.yml`           | Keep daily 03:00 UTC sync after catalog and exact response envelope                                                                                         |
| `SYNC_CRON_ENABLED` in IaC                               | It is preserved in config but no active scheduler was found in current backend startup; do not create duplicate jobs based on this variable alone           |
| `scripts/sync-cardmarket-prices.ts`                      | Rust CLI or stable admin endpoint wrapper with explicit target/config                                                                                       |
| `scripts/audit-cards-upstream.ts`                        | Rust audit command or standalone read-only tooling; opt-in network/key use and equivalent output                                                            |
| `scripts/prune-price-history.ts`                         | Rust command with check/dry-run default and explicit apply, scoped to selected test/production target                                                       |
| `scripts/explain-search.ts`, search benchmark cases      | Rust explain/benchmark equivalents; test query plans and keep reusable case corpus                                                                          |
| `scripts/reset-db.ts`, root reset aliases                | Do not execute or reproduce destructive reset behavior as part of validation; remove obsolete aliases or clearly separate user-only legacy recovery tooling |
| `scripts/dev-tunnel.mjs`                                 | Update API env path/start assumptions when layout changes; retain Expo/tunnel behavior                                                                      |
| `apps/api/railpack.json`, root/Turbo/CI scripts          | Replace backend build/start/check/test wiring only after parity; maintain explicit frontend build pipeline                                                  |
| `ops/postgres-backup`, Expo OTA/internal-build workflows | Preserve backup and app distribution; validate any imported helper path changes; no unrelated infrastructure rewrite                                        |

## Application operation inventory

The generated table below covers every concrete runtime operation. Paths are normalized by removing a trailing slash for comparison; implementation must characterize and preserve both currently accepted slash forms. `session` means resolve the authenticated user and derive collection/owner scope on the server. `admin` means constant-time admin token verification. `release-token` means the per-file HMAC gate, not a login session. Direct schema references are a discovery aid, not a complete success/error OpenAPI definition.

| Method | Path                                             | Access        | Direct boundary schema references                                       |
| ------ | ------------------------------------------------ | ------------- | ----------------------------------------------------------------------- |
| GET    | `/`                                              | public        | Helper-applied schema / non-JSON; see domain checklist                  |
| GET    | `/api/v1/cards`                                  | public        | `CardsListQuery`, `CardsListResponse`                                   |
| GET    | `/api/v1/cards/:variantNumber`                   | public        | `CardDetailResponse`, `CardsDetailQuery`, `VariantNumber`               |
| POST   | `/api/v1/cards/batch`                            | public        | `CardsBatchRequest`, `CardsBatchResponse`                               |
| GET    | `/api/v1/cards/index`                            | public        | `CatalogIndexResponse`                                                  |
| GET    | `/api/v1/collection`                             | session       | Helper-applied schema / non-JSON; see domain checklist                  |
| DELETE | `/api/v1/collection/:variantNumber`              | session       | `CollectionDeleteQuery`, `OkResponse`                                   |
| PUT    | `/api/v1/collection/:variantNumber`              | session       | `CollectionUpsertRequest`                                               |
| POST   | `/api/v1/collection/:variantNumber/add`          | session       | `CollectionAdjustRequest`                                               |
| POST   | `/api/v1/collection/:variantNumber/remove`       | session       | `CollectionAdjustRequest`                                               |
| POST   | `/api/v1/collection/activity-history`            | session       | `CollectionActivityHistoryRequest`, `CollectionActivityHistoryResponse` |
| GET    | `/api/v1/collection/audit`                       | session       | `CollectionAuditListQuery`, `CollectionAuditListResponse`               |
| GET    | `/api/v1/collection/audit/me`                    | session       | `CollectionAuditListQuery`, `CollectionAuditListResponse`               |
| POST   | `/api/v1/collection/batch`                       | session       | `CollectionBatchSyncRequest`, `CollectionBatchSyncResponse`             |
| GET    | `/api/v1/collection/events`                      | session       | Helper-applied schema / non-JSON; see domain checklist                  |
| GET    | `/api/v1/collection/export`                      | session       | Helper-applied schema / non-JSON; see domain checklist                  |
| POST   | `/api/v1/collection/import`                      | session       | `CollectionImportRequest`, `CollectionImportResponse`                   |
| POST   | `/api/v1/collection/import/preview`              | session       | `CollectionImportPreviewRequest`, `CollectionImportPreviewResponse`     |
| POST   | `/api/v1/collection/quantities`                  | session       | `CollectionQuantitiesResponse`, `CollectionVariantNumbersRequest`       |
| POST   | `/api/v1/collection/recent-adds`                 | session       | `CollectionRecentAddsResponse`, `CollectionVariantNumbersRequest`       |
| GET    | `/api/v1/collection/share`                       | session       | `CollectionShareStatusResponse`                                         |
| POST   | `/api/v1/collection/share/invite`                | session       | `CollectionShareInviteCreateResponse`                                   |
| GET    | `/api/v1/collection/share/invite/:token`         | session       | `CollectionShareInvitePreviewResponse`                                  |
| POST   | `/api/v1/collection/share/invite/:token/accept`  | session       | `CollectionShareAcceptRequest`, `CollectionShareAcceptResponse`         |
| POST   | `/api/v1/collection/share/invite/revoke`         | session       | `OkResponse`                                                            |
| POST   | `/api/v1/collection/share/leave`                 | session       | `CollectionShareLeaveResponse`                                          |
| GET    | `/api/v1/deck-rules`                             | public        | `DeckRulesResponse`                                                     |
| POST   | `/api/v1/deck-rules/validate`                    | public        | `DeckValidateInput`, `DeckValidateResponse`                             |
| GET    | `/api/v1/decks`                                  | session       | `DeckListResponse`, `DecksListQuery`                                    |
| DELETE | `/api/v1/decks/:id`                              | session       | `IdResponse`                                                            |
| GET    | `/api/v1/decks/:id`                              | session       | `DeckDetailResponse`                                                    |
| PUT    | `/api/v1/decks/:id`                              | session       | `DeckDetailResponse`, `DeckUpsertRequest`                               |
| POST   | `/api/v1/decks/:id/import`                       | session       | `DeckDetailResponse`                                                    |
| POST   | `/api/v1/decks/:id/versions`                     | session       | `CreateDeckVersionRequest`, `DeckDetailResponse`                        |
| DELETE | `/api/v1/decks/:id/versions/:versionId`          | session       | `DeckDetailResponse`                                                    |
| PATCH  | `/api/v1/decks/:id/versions/:versionId`          | session       | `DeckDetailResponse`, `RenameDeckVersionRequest`                        |
| PUT    | `/api/v1/decks/:id/versions/:versionId`          | session       | `DeckDetailResponse`, `DeckUpsertRequest`                               |
| POST   | `/api/v1/decks/:id/versions/:versionId/activate` | session       | `DeckDetailResponse`                                                    |
| GET    | `/api/v1/filters`                                | public        | `FiltersResponse`                                                       |
| GET    | `/api/v1/health`                                 | public        | `HealthResponse`                                                        |
| GET    | `/api/v1/images/*`                               | public        | `ImageThumbQuery`                                                       |
| GET    | `/api/v1/prices`                                 | public        | `PricesListQuery`, `PricesListResponse`                                 |
| GET    | `/api/v1/prices/history`                         | public        | `PriceHistoryQuery`, `PriceHistoryResponse`                             |
| POST   | `/api/v1/prices/stats/batch`                     | public        | `PriceStatsBatchRequest`, `PriceStatsBatchResponse`                     |
| GET    | `/api/v1/releases/:filename`                     | release-token | Helper-applied schema / non-JSON; see domain checklist                  |
| HEAD   | `/api/v1/releases/:filename`                     | release-token | Helper-applied schema / non-JSON; see domain checklist                  |
| GET    | `/api/v1/search`                                 | public        | `GlobalSearchQuery`, `GlobalSearchResponse`                             |
| GET    | `/api/v1/settings/:device`                       | session       | Helper-applied schema / non-JSON; see domain checklist                  |
| PUT    | `/api/v1/settings/:device`                       | session       | `UserSettingsUpsertRequest`                                             |
| POST   | `/api/v1/sync/catalog`                           | admin         | `SyncCatalogResponse`                                                   |
| POST   | `/api/v1/sync/prices`                            | admin         | `SyncPricesResponse`                                                    |
| GET    | `/api/v1/sync/status`                            | admin         | `SyncStatusResponse`                                                    |
| GET    | `/api/v1/wishlist`                               | session       | `WishlistListResponse`                                                  |
| DELETE | `/api/v1/wishlist/:variantNumber`                | session       | `OkResponse`                                                            |
| PUT    | `/api/v1/wishlist/:variantNumber`                | session       | `WishlistUpsertRequest`                                                 |

## Mounted authentication inventory

The generated table below comes from the **constructed installed Better Auth 1.7.7 instance**, including Expo and email OTP plugins. Every listed HTTP endpoint needs an explicit disposition and HTTP test. Active flows must retain behavior; endpoints with no configured provider/disabled feature must retain their characterized refusal and must not silently become active. Optional HTTP routes cannot be inferred solely from `$Infer` or static frontend searches.

| Methods   | Path                                         | Installed endpoint             | Required disposition                                                                     |
| --------- | -------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| POST      | `/api/auth/sign-in/social`                   | `signInSocial`                 | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| GET, POST | `/api/auth/callback/:id`                     | `callbackOAuth`                | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| GET, POST | `/api/auth/get-session`                      | `getSession`                   | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/sign-out`                         | `signOut`                      | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/sign-up/email`                    | `signUpEmail`                  | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/sign-in/email`                    | `signInEmail`                  | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/reset-password`                   | `resetPassword`                | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/verify-password`                  | `verifyPassword`               | Preserve and test the core/session/verification flow                                     |
| GET       | `/api/auth/verify-email`                     | `verifyEmail`                  | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/send-verification-email`          | `sendVerificationEmail`        | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/change-email`                     | `changeEmail`                  | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/change-password`                  | `changePassword`               | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/update-session`                   | `updateSession`                | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/update-user`                      | `updateUser`                   | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/delete-user`                      | `deleteUser`                   | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/request-password-reset`           | `requestPasswordReset`         | Preserve and test the core/session/verification flow                                     |
| GET       | `/api/auth/reset-password/:token`            | `requestPasswordResetCallback` | Preserve and test the core/session/verification flow                                     |
| GET       | `/api/auth/list-sessions`                    | `listSessions`                 | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/revoke-session`                   | `revokeSession`                | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/revoke-sessions`                  | `revokeSessions`               | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/revoke-other-sessions`            | `revokeOtherSessions`          | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/link-social`                      | `linkSocialAccount`            | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| GET       | `/api/auth/list-accounts`                    | `listUserAccounts`             | Preserve and test the core/session/verification flow                                     |
| GET       | `/api/auth/delete-user/callback`             | `deleteUserCallback`           | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/unlink-account`                   | `unlinkAccount`                | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/refresh-token`                    | `refreshToken`                 | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/get-access-token`                 | `getAccessToken`               | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| GET       | `/api/auth/account-info`                     | `accountInfo`                  | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| GET       | `/api/auth/expo-authorization-proxy`         | `expoAuthorizationProxy`       | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/email-otp/send-verification-otp`  | `sendVerificationOTP`          | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/email-otp/check-verification-otp` | `checkVerificationOTP`         | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/email-otp/verify-email`           | `verifyEmailOTP`               | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/sign-in/email-otp`                | `signInEmailOTP`               | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/email-otp/request-password-reset` | `requestPasswordResetEmailOTP` | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/forget-password/email-otp`        | `forgetPasswordEmailOTP`       | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/email-otp/reset-password`         | `resetPasswordEmailOTP`        | Characterize enabled/disabled/no-provider behavior; preserve refusal or active semantics |
| POST      | `/api/auth/email-otp/request-email-change`   | `requestEmailChangeEmailOTP`   | Preserve and test the core/session/verification flow                                     |
| POST      | `/api/auth/email-otp/change-email`           | `changeEmailEmailOTP`          | Preserve and test the core/session/verification flow                                     |
| GET       | `/api/auth/ok`                               | `ok`                           | Preserve and test the core/session/verification flow                                     |
| GET       | `/api/auth/error`                            | `error`                        | Preserve and test the core/session/verification flow                                     |

Three additional API functions are server-only: `setPassword`, `createVerificationOTP`, and `getVerificationOTP`. They have no mounted HTTP path and must not be accidentally exposed by the Rust replacement.

Frontend call sites that prove required active flows include `AuthPanel`, `ResetPasswordForm`, `EmailVerificationForm`, `CredentialsSection`, `verify-email.tsx`, `reset-password.tsx`, the cookie adapter and session hooks. Cover session list/revoke/account listing and default auth endpoints even if they have no current visible button. In particular, do not repeat Rocal's missing `list-accounts` regression.
