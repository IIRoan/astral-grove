import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { z } from 'zod';
import { PaLogicalCard } from '@riftbound/contracts';
import type postgres from 'postgres';
import { enrichedFilterSnapshot } from './enriched-filters';

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const JsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValue),
    z.record(JsonValue),
  ])
);
const Fixture = z.record(z.array(z.record(JsonValue)));
type PublicRow = Record<string, JsonValue>;
const text = (row: PublicRow, key: string) =>
  typeof row[key] === 'string' ? row[key] : '';
const fixtureDir = import.meta.dir;
const bytes = gunzipSync(readFileSync(join(fixtureDir, 'catalog.json.gz')));
if (
  createHash('sha256').update(bytes).digest('hex') !==
  readFileSync(join(fixtureDir, 'catalog.sha256'), 'utf8').trim()
)
  throw new Error('Catalog fixture checksum mismatch');
const fixture = Fixture.parse(JSON.parse(bytes.toString()));
const knownSets = new Map((fixture.sets ?? []).map((row) => [text(row, 'id'), row]));
const variants = fixture.variants ?? [];
const logicalCards = (fixture.cards ?? []).map((row) =>
  PaLogicalCard.parse({
    ...z.record(z.unknown()).parse(row.upstream_raw),
    id: row.id,
    name: row.name,
    type: row.type,
    super: row.super,
    description: row.description,
    energy: row.energy,
    might: row.might,
    power: row.power,
    tags: row.tags,
    colors: z
      .object({ colors: z.array(z.unknown()).default([]) })
      .parse(row.upstream_raw).colors,
    variants: variants
      .filter((variant) => variant.card_id === row.id)
      .map((variant) => {
        const set = knownSets.get(text(variant, 'set_id'));
        return {
          id: variant.id,
          variantNumber: variant.variant_number,
          rarity: variant.rarity,
          variantType: variant.variant_type,
          foilMode: variant.foil_mode,
          variantTypes: variant.variant_types,
          imageUrl: variant.image_url,
          flavorText: variant.flavor_text,
          artist: variant.artist,
          releaseDate: variant.release_date,
          variantLabel: variant.variant_label,
          showInLibrary: variant.show_in_library,
          isCollectible: variant.is_collectible,
          cardmarketId: variant.cardmarket_id,
          tcgplayerId: variant.tcgplayer_id,
          parentVariantId: variant.parent_variant_id,
          set: { id: set?.id, prefix: set?.code, name: set?.name },
        };
      }),
  })
);
const byVariant = new Map(
  logicalCards.flatMap((card) =>
    card.variants.map((variant) => [variant.variantNumber.toLowerCase(), card] as const)
  )
);

export async function seedOfflineCatalog(client: postgres.Sql): Promise<void> {
  const tables = [
    'sets',
    'colors',
    'cards',
    'card_colors',
    'variants',
    'prices',
    'price_daily',
    'price_history',
    'filter_snapshots',
    'sync_state',
  ] as const;
  await client.begin(async (tx) => {
    for (const table of tables) {
      const rows = fixture[table] ?? [];
      if (!rows.length) continue;
      const info =
        await tx`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=${table} AND is_generated='NEVER' AND is_identity='NO' ORDER BY ordinal_position`;
      const columns = info
        .map((row) => String(row.column_name))
        .filter((column) => column !== 'id' || table !== 'filter_snapshots');
      const quoted = columns
        .map((column) => `"${column.replaceAll('"', '""')}"`)
        .join(',');
      for (let start = 0; start < rows.length; start += 500) {
        await tx.unsafe(
          `INSERT INTO "${table}" (${quoted}) SELECT ${quoted} FROM json_populate_recordset(NULL::"${table}", $1::text::json) ON CONFLICT DO NOTHING`,
          [JSON.stringify(rows.slice(start, start + 500))]
        );
      }
    }
  });
}

export function startOfflineUpstream() {
  const guide = new Map<number, Record<string, unknown>>();
  const snapshots = [...(fixture.price_history ?? [])].sort((a, b) =>
    text(a, 'upstream_last_updated').localeCompare(text(b, 'upstream_last_updated'))
  );
  for (const price of [...snapshots, ...(fixture.prices ?? [])]) {
    const id = Number(price.cardmarket_id);
    const entry = guide.get(id) ?? {
      idProduct: id,
      idCategory: 1655,
      avg: null,
      low: null,
      trend: null,
      avg1: null,
      avg7: null,
      avg30: null,
      'avg-foil': null,
      'low-foil': null,
      'trend-foil': null,
      'avg1-foil': null,
      'avg7-foil': null,
      'avg30-foil': null,
    };
    const suffix = price.is_foil ? '-foil' : '';
    for (const [field, column] of Object.entries({
      avg: 'mid_price',
      low: 'low_price',
      trend: 'market_price',
      avg1: 'avg_1_day',
      avg7: 'avg_7_day',
      avg30: 'avg_30_day',
    }))
      entry[`${field}${suffix}`] = price[column] == null ? null : Number(price[column]);
    guide.set(id, entry);
  }
  const products = logicalCards.flatMap((card) =>
    card.variants
      .filter((variant) => variant.cardmarketId != null)
      .map((variant) => ({
        idProduct: variant.cardmarketId,
        name: card.name,
        idCategory: 1655,
        idExpansion: [...knownSets.keys()].indexOf(variant.set.id) + 6000,
      }))
  );
  const legend =
    logicalCards.find((card) => card.type.toLowerCase().includes('legend')) ??
    logicalCards[0];
  const champion =
    logicalCards.find(
      (card) =>
        card.super?.toLowerCase().includes('champion') &&
        card.type.toLowerCase().includes('unit')
    ) ?? logicalCards[1];
  if (!legend?.variants[0] || !champion?.variants[0])
    throw new Error('Missing deck fixture cards');
  const upstreamDeck = {
    id: 'migration-fixture-community-deck',
    name: 'Fixture Community Deck',
    createdAt: '2026-10-01T00:00:00.000Z',
    authorName: 'Fixture author',
    description: 'Synthetic community deck',
    views: 5,
    likes: 2,
    legend: {
      id: legend.id,
      name: legend.name,
      variantNumber: legend.variants[0].variantNumber,
      tags: legend.tags,
      colors: legend.colors,
      imageUrl: legend.variants[0].imageUrl,
    },
    champions: [
      { cardId: champion.id, variantId: champion.variants[0].id, quantity: 1 },
    ],
    maindeck: [
      { cardId: champion.id, variantId: champion.variants[0].id, quantity: 3 },
    ],
    runes: [],
    battlefields: [],
    sideboard: [],
    sets: [{ prefix: 'OGN' }],
    contentFlags: { hasGuide: false, hasVideo: false, hasMatchups: false },
  };
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.includes('/priceGuide/price_guide_22.json'))
        return Response.json({
          version: 1,
          createdAt: '2026-10-18T00:00:00.000Z',
          priceGuides: [...guide.values()],
        });
      if (url.pathname.includes('/productList/products_singles_22.json'))
        return Response.json({
          version: 1,
          createdAt: '2026-10-18T00:00:00.000Z',
          products,
        });
      if (url.pathname.startsWith('/cdn/')) return new Response(null, { status: 404 });
      if (url.pathname === '/v1/cards') {
        const query = (url.searchParams.get('q') ?? '').toLowerCase();
        const sets = url.searchParams.get('sets')?.split(',');
        const all = logicalCards.flatMap((card) =>
          card.variants
            .filter(
              (variant) =>
                (!query ||
                  `${card.name} ${variant.variantNumber}`
                    .toLowerCase()
                    .includes(query)) &&
                (!sets || sets.includes(variant.set.prefix))
            )
            .map((variant) => ({ ...variant, card: { id: card.id, name: card.name } }))
        );
        const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 50));
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        return Response.json({
          data: all.slice((page - 1) * limit, page * limit),
          pagination: {
            total: all.length,
            limit,
            page,
            totalPages: Math.max(1, Math.ceil(all.length / limit)),
            hasNext: page * limit < all.length,
            hasPrevious: page > 1,
          },
          meta: { filters: enrichedFilterSnapshot },
        });
      }
      if (url.pathname === '/v1/cards/batch') {
        const { variantNumbers } = z
          .object({ variantNumbers: z.array(z.string()) })
          .parse(await request.json());
        return Response.json({
          data: variantNumbers.flatMap(
            (number) =>
              byVariant
                .get(number.toLowerCase())
                ?.variants.filter(
                  (variant) =>
                    variant.variantNumber.toLowerCase() === number.toLowerCase()
                ) ?? []
          ),
          notFound: variantNumbers.filter(
            (number) => !byVariant.has(number.toLowerCase())
          ),
        });
      }
      if (url.pathname.startsWith('/v1/cards/')) {
        const card = byVariant.get(
          decodeURIComponent(url.pathname.slice('/v1/cards/'.length)).toLowerCase()
        );
        return card
          ? Response.json(card)
          : Response.json({ error: 'Not found' }, { status: 404 });
      }
      if (url.pathname === '/v1/decks') {
        if (request.method === 'POST')
          return Response.json(
            { error: 'Fixture write intentionally refused' },
            { status: 403 }
          );
        return Response.json({
          data: [upstreamDeck],
          pagination: { total: 1, page: 1, pageSize: 25, totalPages: 1 },
        });
      }
      if (url.pathname === `/v1/decks/${upstreamDeck.id}`)
        return request.method === 'GET'
          ? Response.json(upstreamDeck)
          : Response.json(
              { error: 'Fixture write intentionally refused' },
              { status: 403 }
            );
      return Response.json({ error: 'Not found' }, { status: 404 });
    },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input, init) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input.toString() : input.url
    );
    if (['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      return originalFetch(input, init);
    if (url.hostname === 'downloads.s3.cardmarket.com')
      return originalFetch(`http://127.0.0.1:${server.port}${url.pathname}`, init);
    if (url.hostname === 'cdn.piltoverarchive.com')
      return originalFetch(`http://127.0.0.1:${server.port}/cdn${url.pathname}`, init);
    throw new Error(`Migration tests forbid external network access (${url.hostname})`);
  }) as typeof fetch;
  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => {
      globalThis.fetch = originalFetch;
      server.stop(true);
    },
  };
}
