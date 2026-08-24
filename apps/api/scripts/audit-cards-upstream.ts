#!/usr/bin/env bun
/** Audit local card cache vs PA; catches stale rows when sync fingerprint skips upserts. Exit 1 on remaining mismatches. */
import {
  PaLogicalCard,
  type PaLogicalCard as PaLogicalCardType,
} from '@riftbound/contracts';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/db/client.js';
import { cards, variants } from '../src/db/schema.js';
import { loadEnv } from '../src/env.js';
import { paCardHash, paVariantHash } from '../src/services/card-mapper.js';
import { CardCacheService } from '../src/services/card-cache.js';
import { ImageStoreService } from '../src/services/image-store.js';
import { PriceCacheService } from '../src/services/price-cache.js';
import { PaApiError, PaClient } from '../src/upstream/pa-client.js';

type FieldDiff = {
  path: string;
  local: unknown;
  upstream: unknown;
};

type LocalCardRow = {
  id: string;
  name: string;
  contentHash: string;
  upstreamRaw: unknown;
  variantNumbers: string[];
};

type CardMismatch = {
  cardId: string;
  probeVariant: string;
  localName: string;
  upstreamName: string;
  localHash: string;
  upstreamHash: string;
  diffs: FieldDiff[];
};

type AuditArgs = {
  fix: boolean;
  concurrency: number;
  nameFilter: string | null;
  variantFilter: string | null;
  limit: number | null;
  json: boolean;
};

function parseArgs(argv: string[]): AuditArgs {
  let fix = false;
  let concurrency = 6;
  let nameFilter: string | null = null;
  let variantFilter: string | null = null;
  let limit: number | null = null;
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--fix') {
      fix = true;
      continue;
    }
    if (arg === '--json') {
      json = true;
      continue;
    }
    if (arg === '--concurrency') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('--concurrency requires a positive integer');
      }
      concurrency = Math.floor(value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      const value = Number(arg.slice('--concurrency='.length));
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('--concurrency requires a positive integer');
      }
      concurrency = Math.floor(value);
      continue;
    }
    if (arg === '--name') {
      nameFilter = argv[i + 1]?.trim().toLowerCase() ?? null;
      if (!nameFilter) throw new Error('--name requires a value');
      i += 1;
      continue;
    }
    if (arg.startsWith('--name=')) {
      nameFilter = arg.slice('--name='.length).trim().toLowerCase() || null;
      if (!nameFilter) throw new Error('--name requires a value');
      continue;
    }
    if (arg === '--variant') {
      variantFilter = argv[i + 1]?.trim().toUpperCase() ?? null;
      if (!variantFilter) throw new Error('--variant requires a value');
      i += 1;
      continue;
    }
    if (arg.startsWith('--variant=')) {
      variantFilter = arg.slice('--variant='.length).trim().toUpperCase() || null;
      if (!variantFilter) throw new Error('--variant requires a value');
      continue;
    }
    if (arg === '--limit') {
      const value = Number(argv[i + 1]);
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('--limit requires a positive integer');
      }
      limit = Math.floor(value);
      i += 1;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length));
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('--limit requires a positive integer');
      }
      limit = Math.floor(value);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage: bun scripts/audit-cards-upstream.ts [options]

Options:
  --fix              Upsert mismatched / missing cards from upstream
  --concurrency N     Parallel PA getCard calls (default 6)
  --name TEXT         Only cards whose local or upstream name contains TEXT
  --variant CODE      Only the logical card for this variant number
  --limit N           Cap how many logical cards to check
  --json              Print machine-readable summary JSON at the end
  -h, --help          Show this help`);
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { fix, concurrency, nameFilter, variantFilter, limit, json };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

function jsonValue(value: unknown): string {
  return JSON.stringify(value);
}

function pushDiff(
  diffs: FieldDiff[],
  path: string,
  local: unknown,
  upstream: unknown
): void {
  if (jsonValue(local) !== jsonValue(upstream)) {
    diffs.push({ path, local, upstream });
  }
}

function compareLogicalCards(
  local: PaLogicalCardType,
  upstream: PaLogicalCardType
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  pushDiff(diffs, 'name', local.name, upstream.name);
  pushDiff(diffs, 'type', local.type, upstream.type);
  pushDiff(diffs, 'super', local.super ?? null, upstream.super ?? null);
  pushDiff(diffs, 'description', local.description, upstream.description);
  pushDiff(diffs, 'energy', local.energy, upstream.energy);
  pushDiff(diffs, 'might', local.might, upstream.might);
  pushDiff(diffs, 'power', local.power, upstream.power);
  pushDiff(diffs, 'tags', [...local.tags].sort(), [...upstream.tags].sort());
  pushDiff(diffs, 'attachText', local.attachText ?? null, upstream.attachText ?? null);
  pushDiff(diffs, 'effect', local.effect ?? null, upstream.effect ?? null);
  pushDiff(diffs, 'mightBonus', local.mightBonus ?? 0, upstream.mightBonus ?? 0);
  pushDiff(diffs, 'maxCopies', local.maxCopies ?? null, upstream.maxCopies ?? null);
  pushDiff(
    diffs,
    'banEffectiveDate',
    local.banEffectiveDate ?? null,
    upstream.banEffectiveDate ?? null
  );

  const localColors = [...local.colors]
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const upstreamColors = [...upstream.colors]
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.id.localeCompare(b.id));
  pushDiff(diffs, 'colors', localColors, upstreamColors);

  const localVariantMap = new Map(local.variants.map((v) => [v.variantNumber, v]));
  const upstreamVariantMap = new Map(
    upstream.variants.map((v) => [v.variantNumber, v])
  );

  const allVariantNumbers = [
    ...new Set([...localVariantMap.keys(), ...upstreamVariantMap.keys()]),
  ].sort();

  for (const variantNumber of allVariantNumbers) {
    const localVariant = localVariantMap.get(variantNumber);
    const upstreamVariant = upstreamVariantMap.get(variantNumber);
    if (!localVariant) {
      diffs.push({
        path: `variants.${variantNumber}`,
        local: null,
        upstream: {
          rarity: upstreamVariant?.rarity,
          variantType: upstreamVariant?.variantType,
        },
      });
      continue;
    }
    if (!upstreamVariant) {
      diffs.push({
        path: `variants.${variantNumber}`,
        local: {
          rarity: localVariant.rarity,
          variantType: localVariant.variantType,
        },
        upstream: null,
      });
      continue;
    }
    if (paVariantHash(localVariant) !== paVariantHash(upstreamVariant)) {
      const before = diffs.length;
      pushDiff(
        diffs,
        `variants.${variantNumber}.rarity`,
        localVariant.rarity,
        upstreamVariant.rarity
      );
      pushDiff(
        diffs,
        `variants.${variantNumber}.variantType`,
        localVariant.variantType,
        upstreamVariant.variantType
      );
      pushDiff(
        diffs,
        `variants.${variantNumber}.foilMode`,
        localVariant.foilMode,
        upstreamVariant.foilMode
      );
      pushDiff(
        diffs,
        `variants.${variantNumber}.variantLabel`,
        localVariant.variantLabel,
        upstreamVariant.variantLabel
      );
      pushDiff(
        diffs,
        `variants.${variantNumber}.imageUrl`,
        localVariant.imageUrl,
        upstreamVariant.imageUrl
      );
      pushDiff(
        diffs,
        `variants.${variantNumber}.cardmarketId`,
        localVariant.cardmarketId ?? null,
        upstreamVariant.cardmarketId ?? null
      );
      pushDiff(
        diffs,
        `variants.${variantNumber}.set.prefix`,
        localVariant.set.prefix,
        upstreamVariant.set.prefix
      );
      if (diffs.length === before) {
        diffs.push({
          path: `variants.${variantNumber}.contentHash`,
          local: paVariantHash(localVariant),
          upstream: paVariantHash(upstreamVariant),
        });
      }
    }
  }

  return diffs;
}

async function loadLocalCards(
  db: ReturnType<typeof createDb>['db']
): Promise<Map<string, LocalCardRow>> {
  const cardRows = await db
    .select({
      id: cards.id,
      name: cards.name,
      contentHash: cards.contentHash,
      upstreamRaw: cards.upstreamRaw,
    })
    .from(cards);

  const variantRows = await db
    .select({
      cardId: variants.cardId,
      variantNumber: variants.variantNumber,
    })
    .from(variants);

  const byCard = new Map<string, LocalCardRow>();
  for (const row of cardRows) {
    byCard.set(row.id, {
      id: row.id,
      name: row.name,
      contentHash: row.contentHash,
      upstreamRaw: row.upstreamRaw,
      variantNumbers: [],
    });
  }

  for (const row of variantRows) {
    const card = byCard.get(row.cardId);
    if (!card) continue;
    card.variantNumbers.push(row.variantNumber);
  }

  for (const card of byCard.values()) {
    card.variantNumbers.sort();
  }

  return byCard;
}

async function listAllUpstreamVariantNumbers(pa: PaClient): Promise<string[]> {
  const variantNumbers: string[] = [];
  let page = 1;
  const limit = 100;

  for (;;) {
    const res = await pa.listCards({ limit, page });
    for (const item of res.data) {
      variantNumbers.push(item.variantNumber);
    }
    console.log(
      `[audit] Upstream list page ${String(page)}/${String(res.pagination.totalPages)} (${String(res.data.length)} variants)`
    );
    if (!res.pagination.hasNext || page >= res.pagination.totalPages) break;
    page += 1;
  }

  return variantNumbers;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prior = i - 1;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, prior + cost);
      prior = temp;
    }
  }
  return prev[b.length]!;
}

function matchesNameFilter(
  nameFilter: string | null,
  localName: string,
  upstreamName?: string
): boolean {
  if (!nameFilter) return true;
  const names = [localName, upstreamName ?? '']
    .map((v) => v.toLowerCase().trim())
    .filter(Boolean);
  for (const name of names) {
    if (name.includes(nameFilter)) return true;
    // Tolerate small typos so `--name stargazer` still finds local "Stagazer".
    if (
      Math.abs(name.length - nameFilter.length) <= 2 &&
      levenshtein(name, nameFilter) <= 2
    ) {
      return true;
    }
    for (const word of name.split(/\s+/)) {
      if (word.includes(nameFilter)) return true;
      if (
        word.length >= 4 &&
        Math.abs(word.length - nameFilter.length) <= 2 &&
        levenshtein(word, nameFilter) <= 2
      ) {
        return true;
      }
    }
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const { db, client } = createDb(env);
  const pa = new PaClient(env);
  const prices = new PriceCacheService(db);
  const images = new ImageStoreService(env);
  const cardCache = new CardCacheService(db, pa, prices, images);

  try {
    console.log('[audit] Loading local cards…');
    const localById = await loadLocalCards(db);
    const localVariantToCardId = new Map<string, string>();
    for (const card of localById.values()) {
      for (const vn of card.variantNumbers) {
        localVariantToCardId.set(vn.toUpperCase(), card.id);
      }
    }

    console.log(
      `[audit] Local catalog: ${String(localById.size)} logical cards, ${String(localVariantToCardId.size)} variants`
    );

    const scoped = Boolean(args.nameFilter || args.variantFilter);
    let upstreamVariantNumbers: string[] = [];
    let upstreamVariantSet = new Set<string>();

    if (scoped) {
      console.log(
        '[audit] Scoped run — skipping full upstream list; probing matched local cards directly.'
      );
    } else {
      console.log('[audit] Listing upstream variants…');
      upstreamVariantNumbers = await listAllUpstreamVariantNumbers(pa);
      upstreamVariantSet = new Set(
        upstreamVariantNumbers.map((vn) => vn.toUpperCase())
      );
      console.log(
        `[audit] Upstream catalog: ${String(upstreamVariantSet.size)} variants`
      );
    }

    type Probe = {
      cardId: string | null;
      probeVariant: string;
      local: LocalCardRow | null;
      reason: 'local' | 'upstream-only';
    };

    const localProbes: Probe[] = [];

    for (const card of localById.values()) {
      if (args.variantFilter) {
        const hasVariant = card.variantNumbers.some(
          (vn) => vn.toUpperCase() === args.variantFilter
        );
        if (!hasVariant) continue;
      }
      if (args.nameFilter && !matchesNameFilter(args.nameFilter, card.name)) {
        continue;
      }
      const probeVariant =
        (scoped
          ? card.variantNumbers[0]
          : card.variantNumbers.find((vn) =>
              upstreamVariantSet.has(vn.toUpperCase())
            )) ?? card.variantNumbers[0];
      if (!probeVariant) {
        console.warn(`[audit] Local card ${card.id} (${card.name}) has no variants`);
        continue;
      }
      localProbes.push({
        cardId: card.id,
        probeVariant,
        local: card,
        reason: 'local',
      });
    }

    let workLocal = localProbes;
    if (args.limit != null) {
      workLocal = workLocal.slice(0, args.limit);
    }

    console.log(
      `[audit] Checking ${String(workLocal.length)} local cards (concurrency=${String(args.concurrency)}${args.fix ? ', fix=on' : ''})…`
    );

    const mismatches: CardMismatch[] = [];
    const missingLocally: Array<{
      cardId: string;
      name: string;
      probeVariant: string;
      variantCount: number;
    }> = [];
    const localOnlyVariants: string[] = [];
    const fetchErrors: Array<{ probeVariant: string; error: string }> = [];
    const okCardIds = new Set<string>();
    const checkedCardIds = new Set<string>();
    const coveredUpstreamVariants = new Set<string>();
    let fixed = 0;

    if (!scoped) {
      for (const [vn, cardId] of localVariantToCardId) {
        if (upstreamVariantSet.has(vn)) continue;
        const card = localById.get(cardId);
        if (args.variantFilter && vn !== args.variantFilter) continue;
        if (args.nameFilter && card && !matchesNameFilter(args.nameFilter, card.name)) {
          continue;
        }
        localOnlyVariants.push(vn);
      }
    }

    async function fetchProbe(probe: Probe) {
      try {
        const upstream = await pa.getCard(probe.probeVariant);
        return { probe, upstream, error: null as string | null };
      } catch (err) {
        const message =
          err instanceof PaApiError
            ? `${err.message}${err.body ? ` — ${err.body.slice(0, 200)}` : ''}`
            : err instanceof Error
              ? err.message
              : String(err);
        return { probe, upstream: null, error: message };
      }
    }

    function markCovered(upstream: PaLogicalCardType) {
      checkedCardIds.add(upstream.id);
      for (const variant of upstream.variants) {
        coveredUpstreamVariants.add(variant.variantNumber.toUpperCase());
      }
    }

    async function processResult(result: Awaited<ReturnType<typeof fetchProbe>>) {
      if (result.error || !result.upstream) {
        fetchErrors.push({
          probeVariant: result.probe.probeVariant,
          error: result.error ?? 'unknown error',
        });
        return;
      }

      const upstream = result.upstream;
      if (checkedCardIds.has(upstream.id)) {
        markCovered(upstream);
        return;
      }
      markCovered(upstream);

      if (
        args.nameFilter &&
        !matchesNameFilter(
          args.nameFilter,
          result.probe.local?.name ?? '',
          upstream.name
        )
      ) {
        return;
      }

      const local = localById.get(upstream.id) ?? result.probe.local;
      if (!local) {
        missingLocally.push({
          cardId: upstream.id,
          name: upstream.name,
          probeVariant: result.probe.probeVariant,
          variantCount: upstream.variants.length,
        });
        if (args.fix) {
          const changed = await cardCache.upsertFromUpstream(upstream);
          if (changed) fixed += 1;
          console.log(
            `[audit][fix] Inserted missing card ${upstream.name} (${result.probe.probeVariant})`
          );
        }
        return;
      }

      const upstreamHash = paCardHash(upstream);
      if (local.contentHash === upstreamHash) {
        okCardIds.add(local.id);
        return;
      }

      let localLogical: PaLogicalCardType;
      try {
        localLogical = PaLogicalCard.parse(local.upstreamRaw);
      } catch {
        localLogical = {
          id: local.id,
          name: local.name,
          type: '',
          description: '',
          energy: 0,
          might: 0,
          power: 0,
          tags: [],
          colors: [],
          variants: [],
        };
      }

      const localForDiff: PaLogicalCardType = {
        ...localLogical,
        id: local.id,
        name: local.name,
      };

      const diffs = compareLogicalCards(localForDiff, upstream);
      mismatches.push({
        cardId: local.id,
        probeVariant: result.probe.probeVariant,
        localName: local.name,
        upstreamName: upstream.name,
        localHash: local.contentHash,
        upstreamHash,
        diffs,
      });

      if (args.fix) {
        const changed = await cardCache.upsertFromUpstream(upstream);
        if (changed) {
          fixed += 1;
          console.log(
            `[audit][fix] Updated ${local.name} → ${upstream.name} (${result.probe.probeVariant})`
          );
        }
      }
    }

    const localResults = await mapWithConcurrency(
      workLocal,
      args.concurrency,
      async (probe) => fetchProbe(probe)
    );
    for (const result of localResults) {
      await processResult(result);
    }

    if (!scoped) {
      const pendingUpstreamOnly = upstreamVariantNumbers.filter((variantNumber) => {
        const upper = variantNumber.toUpperCase();
        if (localVariantToCardId.has(upper)) return false;
        if (coveredUpstreamVariants.has(upper)) return false;
        return true;
      });

      let upstreamOnlyBudget =
        args.limit == null ? Infinity : Math.max(0, args.limit - workLocal.length);
      let upstreamOnlyChecked = 0;

      if (pendingUpstreamOnly.length > 0 && upstreamOnlyBudget > 0) {
        console.log(
          `[audit] Scanning up to ${String(Math.min(pendingUpstreamOnly.length, upstreamOnlyBudget))} upstream-only variant probes…`
        );

        for (const variantNumber of pendingUpstreamOnly) {
          if (upstreamOnlyChecked >= upstreamOnlyBudget) break;
          const upper = variantNumber.toUpperCase();
          if (coveredUpstreamVariants.has(upper)) continue;

          upstreamOnlyChecked += 1;
          const result = await fetchProbe({
            cardId: null,
            probeVariant: variantNumber,
            local: null,
            reason: 'upstream-only',
          });
          await processResult(result);
        }
      }
    } else if (args.variantFilter && !localVariantToCardId.has(args.variantFilter)) {
      const result = await fetchProbe({
        cardId: null,
        probeVariant: args.variantFilter,
        local: null,
        reason: 'upstream-only',
      });
      await processResult(result);
    }

    const uniqueMissing = [
      ...new Map(missingLocally.map((m) => [m.cardId, m])).values(),
    ];

    console.log('');
    console.log('[audit] Summary');
    console.log(`  checked logical cards : ${String(checkedCardIds.size)}`);
    console.log(`  matching              : ${String(okCardIds.size)}`);
    console.log(`  content mismatches    : ${String(mismatches.length)}`);
    console.log(`  missing locally       : ${String(uniqueMissing.length)}`);
    console.log(`  local-only variants   : ${String(localOnlyVariants.length)}`);
    console.log(`  fetch errors          : ${String(fetchErrors.length)}`);
    if (args.fix) {
      console.log(`  fixed / upserted      : ${String(fixed)}`);
    }

    if (mismatches.length > 0) {
      console.log('');
      console.log('[audit] Content mismatches:');
      for (const m of mismatches) {
        const nameNote =
          m.localName === m.upstreamName
            ? m.localName
            : `"${m.localName}" → "${m.upstreamName}"`;
        console.log(
          `  - ${nameNote} [${m.probeVariant}] hash ${m.localHash.slice(0, 12)}… → ${m.upstreamHash.slice(0, 12)}…`
        );
        for (const diff of m.diffs.slice(0, 12)) {
          console.log(
            `      ${diff.path}: ${jsonValue(diff.local)} → ${jsonValue(diff.upstream)}`
          );
        }
        if (m.diffs.length > 12) {
          console.log(`      … ${String(m.diffs.length - 12)} more field diffs`);
        }
      }
    }

    if (uniqueMissing.length > 0) {
      console.log('');
      console.log('[audit] Present upstream, missing locally:');
      for (const m of uniqueMissing.slice(0, 50)) {
        console.log(
          `  - ${m.name} [${m.probeVariant}] (${String(m.variantCount)} variants, id=${m.cardId})`
        );
      }
      if (uniqueMissing.length > 50) {
        console.log(`  … ${String(uniqueMissing.length - 50)} more`);
      }
    }

    if (localOnlyVariants.length > 0) {
      console.log('');
      console.log('[audit] Local variants not listed upstream:');
      for (const vn of localOnlyVariants.slice(0, 50)) {
        const cardId = localVariantToCardId.get(vn);
        const name = cardId ? (localById.get(cardId)?.name ?? '?') : '?';
        console.log(`  - ${vn} (${name})`);
      }
      if (localOnlyVariants.length > 50) {
        console.log(`  … ${String(localOnlyVariants.length - 50)} more`);
      }
    }

    if (fetchErrors.length > 0) {
      console.log('');
      console.log('[audit] Upstream fetch errors:');
      for (const err of fetchErrors.slice(0, 30)) {
        console.log(`  - ${err.probeVariant}: ${err.error}`);
      }
      if (fetchErrors.length > 30) {
        console.log(`  … ${String(fetchErrors.length - 30)} more`);
      }
    }

    const remainingMismatches = args.fix ? 0 : mismatches.length;
    const remainingMissing = args.fix ? 0 : uniqueMissing.length;
    // Local-only variants are informational; fail only with content/fetch problems. Re-check after --fix.
    let postFixMismatches = 0;
    if (args.fix && mismatches.length > 0) {
      for (const m of mismatches) {
        const row = await db.query.cards.findFirst({
          where: eq(cards.id, m.cardId),
          columns: { contentHash: true, name: true },
        });
        if (!row || row.contentHash !== m.upstreamHash) {
          postFixMismatches += 1;
          console.warn(
            `[audit] Post-fix verify failed for ${m.cardId} (name=${row?.name ?? '?'})`
          );
        }
      }
    }

    if (args.json) {
      console.log(
        JSON.stringify(
          {
            checked: checkedCardIds.size,
            matching: okCardIds.size,
            mismatches: mismatches.map((m) => ({
              cardId: m.cardId,
              probeVariant: m.probeVariant,
              localName: m.localName,
              upstreamName: m.upstreamName,
              diffs: m.diffs,
            })),
            missingLocally: uniqueMissing,
            localOnlyVariants,
            fetchErrors,
            fixed,
            postFixMismatches,
          },
          null,
          2
        )
      );
    }

    const failed =
      remainingMismatches > 0 ||
      remainingMissing > 0 ||
      fetchErrors.length > 0 ||
      postFixMismatches > 0;

    if (failed) {
      if (!args.fix && (mismatches.length > 0 || uniqueMissing.length > 0)) {
        console.log('');
        console.log(
          '[audit] Re-run with --fix to upsert mismatched / missing cards from upstream.'
        );
        console.log(
          '[audit] Note: normal catalog sync may skip upserts when the fingerprint is unchanged.'
        );
      }
      process.exitCode = 1;
    } else {
      console.log('');
      console.log('[audit] All checked cards match upstream.');
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

void main().catch((error: unknown) => {
  console.error('Card upstream audit failed:', error);
  process.exit(1);
});
