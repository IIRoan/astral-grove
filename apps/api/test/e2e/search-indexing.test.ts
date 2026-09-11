import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  setDefaultTimeout,
} from 'bun:test';
import {
  CardsListResponse,
  GlobalSearchResponse,
  SEARCH_NORMALIZATION_CASES,
  normalizeSearchText,
  type CardsListQuery,
  type PaLogicalCard,
  type PaVariant,
} from '@riftbound/contracts';
import { eq, inArray, like } from 'drizzle-orm';
import {
  cardColors,
  cards,
  colors,
  prices,
  sets,
  variants,
} from '../../src/db/schema.js';
import { assertSearchSchemaReady, apiJson, getContext } from './support.js';
import { wholeWordPattern } from '../../src/lib/search.js';

setDefaultTimeout(180_000);

const SET_ID = 'cccccccc-dddd-4eee-8fff-000000000001';
const COLOR_ID = 'cccccccc-dddd-4eee-8fff-0000000000c1';
const RULES_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000011';
const LEAK_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000012';
const ACCENT_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000013';
const PAGE_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000014';
const DUAL_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000015';
const PRICE_CARD_A = 'cccccccc-dddd-4eee-8fff-000000000016';
const PRICE_CARD_B = 'cccccccc-dddd-4eee-8fff-000000000017';
const SPINNER_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000018';
const COMPACT_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000019';
const PLATE_CARD_ID = 'cccccccc-dddd-4eee-8fff-00000000001a';
const PORO_CARD_ID = 'cccccccc-dddd-4eee-8fff-00000000001b';
const STAG_CARD_ID = 'cccccccc-dddd-4eee-8fff-00000000001c';
const BOUNDARY_CARD_ID = 'cccccccc-dddd-4eee-8fff-00000000001d';
const TWO_CHAR_CARD_ID = 'cccccccc-dddd-4eee-8fff-00000000001e';
const TOKEN_CARD_ID = 'cccccccc-dddd-4eee-8fff-00000000001f';
const FURY_CARD_ID = 'cccccccc-dddd-4eee-8fff-000000000020';

const FIXTURE_CARD_IDS = [
  RULES_CARD_ID,
  LEAK_CARD_ID,
  ACCENT_CARD_ID,
  PAGE_CARD_ID,
  DUAL_CARD_ID,
  PRICE_CARD_A,
  PRICE_CARD_B,
  SPINNER_CARD_ID,
  COMPACT_CARD_ID,
  PLATE_CARD_ID,
  PORO_CARD_ID,
  STAG_CARD_ID,
  BOUNDARY_CARD_ID,
  TWO_CHAR_CARD_ID,
  TOKEN_CARD_ID,
  FURY_CARD_ID,
];

const PREFIX = 'ZQN';
const PAGE_COUNT = 520;

function vn(id: string): string {
  return `${PREFIX}-${id}`;
}

function uuid(n: number): string {
  return `cccccccc-dddd-4eee-8fff-${n.toString().padStart(12, '0')}`;
}

function variant(args: {
  id: string;
  number: string;
  label: string;
  type?: string;
  foilMode?: string;
  flavorText?: string | null;
  artist?: string | null;
  rarity?: string;
  cardmarketId?: number | null;
}): PaVariant {
  return {
    id: args.id,
    variantNumber: args.number,
    imageUrl: `https://example.com/${args.number}.webp`,
    rarity: args.rarity ?? 'Rare',
    variantType: args.type ?? 'Standard',
    foilMode: args.foilMode ?? 'none',
    variantTypes: [args.type ?? 'Standard'],
    showInLibrary: true,
    isCollectible: true,
    variantLabel: args.label,
    flavorText: args.flavorText ?? null,
    artist: args.artist ?? null,
    releaseDate: null,
    cardmarketId: args.cardmarketId ?? null,
    tcgplayerId: null,
    parentVariantId: null,
    set: {
      id: SET_ID,
      prefix: PREFIX,
      name: 'ZQN Search Index Set',
    },
  };
}

function logical(args: {
  id: string;
  name: string;
  type: string;
  super?: string | null;
  description?: string;
  effect?: string | null;
  attachText?: string | null;
  energy?: number;
  might?: number;
  power?: number;
  tags?: string[];
  variants: PaVariant[];
}): PaLogicalCard {
  return {
    id: args.id,
    name: args.name,
    type: args.type,
    super: args.super ?? null,
    description: args.description ?? '',
    energy: args.energy ?? 2,
    might: args.might ?? 2,
    power: args.power ?? 1,
    tags: args.tags ?? ['ZQN'],
    colors: [{ id: COLOR_ID, name: 'Zqnbody' }],
    variants: args.variants,
    ...(args.effect !== undefined ? { effect: args.effect } : {}),
    ...(args.attachText !== undefined ? { attachText: args.attachText } : {}),
  };
}

async function searchCards(path: string): Promise<CardsListResponse> {
  return CardsListResponse.parse(await apiJson<unknown>(path));
}

function fixtureCardsPath(q: string, extra = ''): string {
  return `/api/v1/cards?q=${encodeURIComponent(q)}&sets=${PREFIX}${extra}`;
}

function localQuery(
  overrides: Partial<CardsListQuery> & { q: string }
): CardsListQuery {
  return {
    page: 1,
    limit: 50,
    sortBy: 'name',
    dir: 'asc',
    colorMode: 'all',
    sets: PREFIX,
    ...overrides,
  };
}

async function searchLocal(overrides: Partial<CardsListQuery> & { q: string }) {
  return getContext().cardCache.searchLocalWithoutUpstream(localQuery(overrides));
}

async function cleanup(): Promise<void> {
  const { db, cardCache } = getContext();
  await db.delete(cardColors).where(eq(cardColors.colorId, COLOR_ID));
  await db.delete(variants).where(like(variants.variantNumber, `${PREFIX}-%`));
  await db.delete(cards).where(inArray(cards.id, FIXTURE_CARD_IDS));
  await db.delete(cardColors).where(eq(cardColors.colorId, COLOR_ID));
  await db.delete(colors).where(eq(colors.id, COLOR_ID));
  await db.delete(sets).where(eq(sets.id, SET_ID));
  await db.delete(prices).where(inArray(prices.cardmarketId, [910001, 910002]));
  cardCache.invalidateSearchCache();
}

beforeAll(async () => {
  await assertSearchSchemaReady();
  const { cardCache, db } = getContext();
  await cleanup();

  await db.insert(colors).values({
    id: COLOR_ID,
    name: 'Zqnbody',
    hexCode: '#111111',
  });

  const now = new Date();
  await cardCache.upsertFromUpstream(
    logical({
      id: RULES_CARD_ID,
      name: 'Zqn Rulesonly',
      type: 'Spell',
      description: 'The unit is assigned a role.',
      effect: 'Draw a card.',
      attachText: 'Nothing here.',
      variants: [
        variant({
          id: uuid(101),
          number: vn('R01'),
          label: 'Standard',
          flavorText: 'A lonely flavor hit.',
        }),
        variant({
          id: uuid(102),
          number: vn('R01S'),
          label: 'Overnumbered Signed',
          type: 'Overnumbered',
        }),
      ],
    })
  );

  await cardCache.upsertFromUpstream(
    logical({
      id: LEAK_CARD_ID,
      name: 'Zqn Leakjinx',
      type: 'Unit',
      variants: [
        variant({ id: uuid(111), number: vn('L01'), label: 'Standard' }),
        variant({
          id: uuid(112),
          number: vn('L01S'),
          label: 'Overnumbered Signed',
          type: 'Overnumbered',
        }),
      ],
    })
  );

  await cardCache.upsertFromUpstream(
    logical({
      id: ACCENT_CARD_ID,
      name: 'Ambéssa Zqn',
      type: 'Legend',
      variants: [variant({ id: uuid(121), number: vn('A01'), label: 'Standard' })],
    })
  );

  await cardCache.upsertFromUpstream(
    logical({
      id: DUAL_CARD_ID,
      name: 'Zqn Dualgear',
      type: 'Unit Gear',
      super: 'Champion',
      energy: 3,
      variants: [
        variant({
          id: uuid(131),
          number: vn('D01'),
          label: 'Standard',
          rarity: 'Epic',
          artist: 'Zqn Kudos',
        }),
      ],
    })
  );

  await cardCache.upsertFromUpstream(
    logical({
      id: PRICE_CARD_A,
      name: 'Zqn Pricealpha',
      type: 'Unit',
      variants: [
        variant({
          id: uuid(141),
          number: vn('P01'),
          label: 'Standard',
          cardmarketId: 910001,
        }),
      ],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: PRICE_CARD_B,
      name: 'Zqn Pricebravo',
      type: 'Unit',
      variants: [
        variant({
          id: uuid(142),
          number: vn('P02'),
          label: 'Standard',
          cardmarketId: 910002,
        }),
      ],
    })
  );

  await cardCache.upsertFromUpstream(
    logical({
      id: SPINNER_CARD_ID,
      name: 'Zqn Soul Spinner',
      type: 'Unit',
      variants: [variant({ id: uuid(151), number: vn('S01'), label: 'Standard' })],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: COMPACT_CARD_ID,
      name: 'Zqn Soulspinner',
      type: 'Unit',
      variants: [variant({ id: uuid(152), number: vn('S02'), label: 'Standard' })],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: PLATE_CARD_ID,
      name: 'Zqn Platewyrm',
      type: 'Unit',
      variants: [variant({ id: uuid(153), number: vn('PL01'), label: 'Standard' })],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: PORO_CARD_ID,
      name: 'Zqn Affectionate',
      type: 'Unit',
      variants: [variant({ id: uuid(154), number: vn('PO01'), label: 'Standard' })],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: STAG_CARD_ID,
      name: 'Zqn Stagazer',
      type: 'Unit',
      variants: [variant({ id: uuid(155), number: vn('ST01'), label: 'Standard' })],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: BOUNDARY_CARD_ID,
      name: 'Zqn Boundary',
      type: 'Spell',
      description: 'The assigned_role stays together.',
      effect: 'Deal signed-7 damage.',
      attachText: null,
      variants: [
        variant({
          id: uuid(156),
          number: vn('B01'),
          label: 'Standard',
          flavorText: null,
        }),
      ],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: TWO_CHAR_CARD_ID,
      name: 'Zq',
      type: 'Unit',
      variants: [variant({ id: uuid(157), number: vn('ZQ01'), label: 'Standard' })],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: TOKEN_CARD_ID,
      name: 'Zqn Tokenunit',
      type: 'Unit',
      variants: [
        variant({ id: uuid(158), number: `${PREFIX}-T01`, label: 'Standard' }),
      ],
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: FURY_CARD_ID,
      name: 'Zqn Furybound',
      type: 'Unit',
      variants: [variant({ id: uuid(159), number: vn('F01'), label: 'Standard' })],
    })
  );

  const pageVariants: PaVariant[] = [];
  for (let i = 1; i <= PAGE_COUNT; i += 1) {
    const number = `${PREFIX}-P${String(i).padStart(4, '0')}`;
    pageVariants.push(
      variant({
        id: uuid(2000 + i),
        number,
        label: 'Standard',
      })
    );
  }
  pageVariants.push(
    variant({
      id: uuid(3001),
      number: `${PREFIX}-P0499-Foil`,
      label: 'Foil',
      foilMode: 'foil_only',
    }),
    variant({
      id: uuid(3002),
      number: `${PREFIX}-P0500-Foil`,
      label: 'Foil',
      foilMode: 'foil_only',
    }),
    variant({
      id: uuid(3003),
      number: `${PREFIX}-P0001-Release`,
      label: 'Release Event Promo',
    })
  );
  await cardCache.upsertFromUpstream(
    logical({
      id: PAGE_CARD_ID,
      name: 'Zqn Pageflood',
      type: 'Unit',
      variants: pageVariants,
    })
  );

  await db.insert(prices).values([
    {
      id: uuid(4001),
      cardmarketId: 910001,
      isFoil: false,
      provider: 'cardmarket',
      currency: 'EUR',
      lowPrice: '1.00',
      marketPrice: '2.00',
      midPrice: '2.00',
      highPrice: '3.00',
      avg1Day: null,
      avg7Day: '2.00',
      avg30Day: null,
      upstreamLastUpdated: now,
      contentHash: 'a'.repeat(64),
      fetchedAt: now,
    },
    {
      id: uuid(4002),
      cardmarketId: 910002,
      isFoil: false,
      provider: 'cardmarket',
      currency: 'EUR',
      lowPrice: '8.00',
      marketPrice: '9.00',
      midPrice: '9.00',
      highPrice: '10.00',
      avg1Day: null,
      avg7Day: '9.00',
      avg30Day: null,
      upstreamLastUpdated: now,
      contentHash: 'b'.repeat(64),
      fetchedAt: now,
    },
  ]);

  cardCache.invalidateSearchCache();
});

afterAll(async () => {
  await cleanup();
});

describe('search indexing fixtures', () => {
  test('JavaScript and SQL name normalization stay in parity', async () => {
    const { db, client } = getContext();
    for (const fixture of SEARCH_NORMALIZATION_CASES) {
      const rows = (await client.unsafe(
        'select public.normalize_card_name_v1($1) as value',
        [fixture.raw]
      )) as { value: string }[];
      expect(rows[0]?.value ?? '').toBe(fixture.normalized);
      expect(normalizeSearchText(fixture.raw)).toBe(fixture.normalized);
    }

    const catalog = await db
      .select({ name: cards.name, nameNorm: cards.nameNorm })
      .from(cards);
    expect(catalog.length).toBeGreaterThan(0);
    const mismatches = catalog.filter(
      (row) => (row.nameNorm ?? '') !== normalizeSearchText(row.name)
    );
    expect(mismatches.slice(0, 8)).toEqual([]);
  });

  test('generated columns update when the source name changes', async () => {
    const { db } = getContext();
    const [before] = await db
      .select({ nameNorm: cards.nameNorm, nameSquashed: cards.nameSquashed })
      .from(cards)
      .where(eq(cards.id, ACCENT_CARD_ID));
    expect(before?.nameNorm).toBe('ambessa zqn');
    expect(before?.nameSquashed).toBe('ambessazqn');

    await db
      .update(cards)
      .set({ name: 'Ørn, the Æther' })
      .where(eq(cards.id, ACCENT_CARD_ID));
    const [after] = await db
      .select({ nameNorm: cards.nameNorm, nameSquashed: cards.nameSquashed })
      .from(cards)
      .where(eq(cards.id, ACCENT_CARD_ID));
    expect(after?.nameNorm).toBe(normalizeSearchText('Ørn, the Æther'));
    expect(after?.nameSquashed).toBe(
      normalizeSearchText('Ørn, the Æther').replace(/ /g, '')
    );

    await db
      .update(cards)
      .set({ name: 'Ambéssa Zqn' })
      .where(eq(cards.id, ACCENT_CARD_ID));
    getContext().cardCache.invalidateSearchCache();
  });

  test('rules-only and flavor-only hits keep signed vs assigned whole words', async () => {
    const assigned = await searchCards(fixtureCardsPath('assigned', '&limit=50'));
    expect(assigned.data.some((row) => row.variantNumber === vn('R01'))).toBe(true);

    const signed = await searchCards(fixtureCardsPath('signed', '&limit=50'));
    expect(signed.data.some((row) => row.variantNumber === vn('R01S'))).toBe(true);
    expect(signed.data.some((row) => row.variantNumber === vn('R01'))).toBe(false);

    const flavor = await searchCards(fixtureCardsPath('lonely', '&limit=50'));
    expect(flavor.data.some((row) => row.variantNumber === vn('R01'))).toBe(true);
  });

  test('multi-token matches do not leak across variants of the same card', async () => {
    const leaked = await searchCards(fixtureCardsPath('leakjinx signed', '&limit=50'));
    expect(leaked.data.some((row) => row.variantNumber === vn('L01S'))).toBe(true);
    expect(leaked.data.some((row) => row.variantNumber === vn('L01'))).toBe(false);
  });

  test('accented queries hit the accented catalog name', async () => {
    const result = await searchCards(fixtureCardsPath('Ambéssa', '&limit=20'));
    expect(result.data.some((row) => row.cardId === ACCENT_CARD_ID)).toBe(true);
  });

  test('Unit Gear, supertype, set/rarity, numeric, color, and token filters', async () => {
    const dual = await searchCards(
      `/api/v1/cards?q=${encodeURIComponent('dualgear')}&types=Unit,Gear&super=Champion&sets=${PREFIX}&rarities=Epic&energyMin=3&energyMax=3&colors=Zqnbody&colorMode=all&excludeTokens=true&limit=20`
    );
    expect(dual.data.some((row) => row.variantNumber === vn('D01'))).toBe(true);

    const within = await searchCards(
      fixtureCardsPath('dualgear', '&colors=Zqnbody,Mind&colorMode=within&limit=20')
    );
    expect(within.data.some((row) => row.variantNumber === vn('D01'))).toBe(true);

    const tokenExcluded = await searchCards(
      fixtureCardsPath('pageflood', '&excludeTokens=true&limit=20')
    );
    expect(tokenExcluded.meta.pagination.total).toBeGreaterThan(0);
  });

  test('more than 500 matching variants paginate by grouped totals', async () => {
    const expectedPagefloodGroups = PAGE_COUNT + 1;
    const first = await searchCards(fixtureCardsPath('pageflood', '&limit=40&page=1'));
    expect(first.meta.pagination.total).toBeGreaterThanOrEqual(expectedPagefloodGroups);
    expect(first.data.length).toBe(40);
    expect(first.meta.pagination.hasNext).toBe(true);
    expect(first.data.some((row) => row.name === 'Zqn Pageflood')).toBe(true);

    const later = await searchCards(
      fixtureCardsPath(
        'pageflood',
        `&limit=40&page=${String(first.meta.pagination.totalPages)}`
      )
    );
    expect(later.data.length).toBeGreaterThan(0);

    const outOfRange = await searchCards(
      fixtureCardsPath(
        'pageflood',
        `&limit=40&page=${String(first.meta.pagination.totalPages + 3)}`
      )
    );
    expect(outOfRange.data).toEqual([]);
    expect(outOfRange.meta.pagination.total).toBe(first.meta.pagination.total);

    const numbers = new Set(first.data.map((row) => row.variantNumber));
    expect(numbers.size).toBe(first.data.length);

    const foilBoundary = await searchCards(
      fixtureCardsPath(`${PREFIX}-P0499`, '&limit=20')
    );
    const foilGroup = foilBoundary.data.find((row) =>
      row.printings.some(
        (printing) => printing.variantNumber === `${PREFIX}-P0499-Foil`
      )
    );
    expect(foilGroup).toBeTruthy();
  });

  test('price sorting uses all candidate price keys and preserves totals', async () => {
    const priced = await searchCards(
      fixtureCardsPath('price', '&sortBy=price&dir=desc&limit=20')
    );
    const alpha = priced.data.findIndex((row) => row.variantNumber === vn('P01'));
    const bravo = priced.data.findIndex((row) => row.variantNumber === vn('P02'));
    expect(bravo).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(bravo).toBeLessThan(alpha);
    expect(priced.meta.pagination.total).toBeGreaterThanOrEqual(priced.data.length);
  });

  test('/api/v1/cards and /api/v1/search stay schema-compatible', async () => {
    const cardsList = await searchCards(
      `/api/v1/cards?q=${encodeURIComponent('leakjinx')}&limit=10`
    );
    expect(cardsList.data.length).toBeGreaterThan(0);

    const global = GlobalSearchResponse.parse(
      await apiJson<unknown>(
        `/api/v1/search?q=${encodeURIComponent('leakjinx')}&limit=10`
      )
    );
    expect(global.data.cards?.total).toBe(cardsList.meta.pagination.total);
    expect(global.data.cards?.hits.length).toBeGreaterThan(0);
  });

  test('setup exposes unaccent, pg_trgm, and generated search columns', async () => {
    await assertSearchSchemaReady();
    const { db } = getContext();
    const [row] = await db
      .select({
        nameNorm: cards.nameNorm,
        nameSquashed: cards.nameSquashed,
        rulesSearchText: cards.rulesSearchText,
      })
      .from(cards)
      .where(eq(cards.id, RULES_CARD_ID));
    expect(row?.nameNorm).toBe('zqn rulesonly');
    expect(row?.nameSquashed).toBe('zqnrulesonly');
    expect(row?.rulesSearchText).toContain('assigned');
    expect(row?.rulesSearchText).toContain('\n');
  });

  test('compact names match whether spaced or squashed', async () => {
    const spaced = await searchLocal({ q: 'soul spinner', limit: 20 });
    expect(spaced.items.some((row) => row.cardId === SPINNER_CARD_ID)).toBe(true);
    expect(spaced.items.some((row) => row.cardId === COMPACT_CARD_ID)).toBe(true);

    const compact = await searchLocal({ q: 'soulspinner', limit: 20 });
    expect(compact.items.some((row) => row.cardId === SPINNER_CARD_ID)).toBe(true);
    expect(compact.items.some((row) => row.cardId === COMPACT_CARD_ID)).toBe(true);
  });

  test('typos recall close names and reject shared letter scraps', async () => {
    const typo = await searchLocal({ q: 'stargazer', limit: 20 });
    expect(typo.items.length).toBeGreaterThan(0);
    expect(typo.items[0]?.cardId).toBe(STAG_CARD_ID);

    const embessa = await searchLocal({ q: 'embessa', limit: 20 });
    expect(embessa.items.some((row) => row.cardId === ACCENT_CARD_ID)).toBe(true);

    const plate = await searchLocal({ q: 'plate', limit: 20 });
    expect(plate.items.some((row) => row.cardId === PLATE_CARD_ID)).toBe(true);
    expect(plate.items.some((row) => row.cardId === PORO_CARD_ID)).toBe(false);
  });

  test('accent queries including decomposed marks hit Ambéssa', async () => {
    const precomposed = await searchLocal({ q: 'Ambéssa', limit: 20 });
    const decomposed = await searchLocal({ q: 'Ambe\u0301ssa', limit: 20 });
    const spaced = await searchLocal({ q: 'AM BÉSSA', limit: 20 });
    expect(precomposed.items.some((row) => row.cardId === ACCENT_CARD_ID)).toBe(true);
    expect(decomposed.items.some((row) => row.cardId === ACCENT_CARD_ID)).toBe(true);
    expect(spaced.items.some((row) => row.cardId === ACCENT_CARD_ID)).toBe(true);
  });

  test('whole-word rules treat hyphen as a boundary and underscore as a word char', async () => {
    const { client } = getContext();
    const [hyphen] = (await client.unsafe(
      `select (rules_search_text ~* $1) as hit from cards where id = $2`,
      [wholeWordPattern('signed'), BOUNDARY_CARD_ID]
    )) as { hit: boolean }[];
    const [underscore] = (await client.unsafe(
      `select (rules_search_text ~* $1) as hit from cards where id = $2`,
      [wholeWordPattern('assigned'), BOUNDARY_CARD_ID]
    )) as { hit: boolean }[];
    const [rulesAssigned] = (await client.unsafe(
      `select (rules_search_text ~* $1) as hit from cards where id = $2`,
      [wholeWordPattern('assigned'), RULES_CARD_ID]
    )) as { hit: boolean }[];
    expect(hyphen?.hit).toBe(true);
    expect(underscore?.hit).toBe(false);
    expect(rulesAssigned?.hit).toBe(true);
  });

  test('blank and stopword-only queries do not list the fixture set', async () => {
    const stopwords = await searchLocal({ q: 'the of a', limit: 20 });
    expect(stopwords.items).toEqual([]);
    expect(stopwords.total).toBe(0);

    const twoChar = await searchLocal({ q: 'zq', limit: 20 });
    expect(twoChar.items.some((row) => row.cardId === TWO_CHAR_CARD_ID)).toBe(true);
  });

  test('artist, type-intent, and token exclusion stay scoped to matching printings', async () => {
    const artist = await searchLocal({ q: 'kudos', limit: 20 });
    expect(artist.items.some((row) => row.variantNumber === vn('D01'))).toBe(true);

    const fury = await searchLocal({ q: 'unit fury', limit: 20 });
    expect(fury.items.some((row) => row.cardId === FURY_CARD_ID)).toBe(true);
    expect(fury.items.every((row) => row.type.toLowerCase().includes('unit'))).toBe(
      true
    );

    const legend = await searchLocal({ q: 'ambessa legend', limit: 20 });
    expect(legend.items.length).toBeGreaterThan(0);
    expect(legend.items.every((row) => row.type.toLowerCase().includes('legend'))).toBe(
      true
    );

    const withToken = await searchLocal({ q: 'tokenunit', limit: 20 });
    expect(withToken.items.some((row) => row.variantNumber === `${PREFIX}-T01`)).toBe(
      true
    );
    const withoutToken = await searchLocal({
      q: 'tokenunit',
      excludeTokens: true,
      limit: 20,
    });
    expect(
      withoutToken.items.some((row) => row.variantNumber === `${PREFIX}-T01`)
    ).toBe(false);
  });

  test('grouped pages are stable, unique, and fully reachable', async () => {
    const expectedPagefloodGroups = PAGE_COUNT + 1;
    const first = await searchLocal({ q: 'pageflood', limit: 40, page: 1 });
    expect(first.total).toBeGreaterThanOrEqual(expectedPagefloodGroups);
    expect(first.items.length).toBe(40);

    const keys = new Set<string>();
    const pagefloodKeys = new Set<string>();
    const totalPages = Math.max(1, Math.ceil(first.total / 40));
    for (let page = 1; page <= totalPages; page += 1) {
      const result = await searchLocal({ q: 'pageflood', limit: 40, page });
      expect(result.total).toBe(first.total);
      for (const item of result.items) {
        const key = `${item.cardId}:${item.variantNumber}`;
        expect(keys.has(key)).toBe(false);
        keys.add(key);
        if (item.name === 'Zqn Pageflood') pagefloodKeys.add(key);
      }
    }
    expect(pagefloodKeys.size).toBe(expectedPagefloodGroups);
    expect(keys.size).toBe(first.total);

    const outOfRange = await searchLocal({
      q: 'pageflood',
      limit: 40,
      page: totalPages + 3,
    });
    expect(outOfRange.items).toEqual([]);
    expect(outOfRange.total).toBe(first.total);
    expect(outOfRange.timings.colorsMs).toBe(0);
    expect(outOfRange.timings.pricesMs).toBe(0);
  });

  test('alternate arts stay separate from standard/foil families', async () => {
    const page = await searchLocal({ q: `${PREFIX}-P0001`, limit: 20 });
    const standard = page.items.find((row) =>
      row.printings.some((printing) => printing.variantNumber === `${PREFIX}-P0001`)
    );
    const release = page.items.find((row) =>
      row.printings.some(
        (printing) => printing.variantNumber === `${PREFIX}-P0001-Release`
      )
    );
    expect(standard).toBeTruthy();
    expect(release).toBeTruthy();
    expect(standard?.variantNumber).not.toBe(release?.variantNumber);

    const foil = await searchLocal({ q: `${PREFIX}-P0499`, limit: 20 });
    const foilGroup = foil.items.find((row) =>
      row.printings.some(
        (printing) => printing.variantNumber === `${PREFIX}-P0499-Foil`
      )
    );
    expect(foilGroup).toBeTruthy();
    expect(
      foilGroup?.printings.some(
        (printing) => printing.variantNumber === `${PREFIX}-P0499`
      )
    ).toBe(true);
  });

  test('price sort uses every candidate group and page hydration stays bounded', async () => {
    const priced = await searchLocal({
      q: 'price',
      sortBy: 'price',
      dir: 'desc',
      limit: 20,
    });
    expect(priced.items.length).toBeGreaterThan(0);
    const alpha = priced.items.findIndex((row) => row.variantNumber === vn('P01'));
    const bravo = priced.items.findIndex((row) => row.variantNumber === vn('P02'));
    expect(bravo).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(bravo).toBeLessThan(alpha);
    expect(priced.timings.pricesMs).toBeGreaterThan(0);
  });

  test('incompatible stored embeddings fall back to lexical matches and keep filters', async () => {
    const { db, cardCache } = getContext();
    await db
      .update(cards)
      .set({ embeddingModel: 'local-hash-v1', embeddedHash: 'c'.repeat(64) })
      .where(eq(cards.id, ACCENT_CARD_ID));
    cardCache.invalidateSearchCache();

    const result = await searchLocal({
      q: 'ambessa legend',
      types: 'Legend',
      limit: 20,
    });
    expect(result.items.some((row) => row.cardId === ACCENT_CARD_ID)).toBe(true);
    expect(result.items.every((row) => row.type.toLowerCase().includes('legend'))).toBe(
      true
    );

    await db
      .update(cards)
      .set({ embeddingModel: null, embedding: null, embeddedHash: null })
      .where(eq(cards.id, ACCENT_CARD_ID));
    cardCache.invalidateSearchCache();
  });
});
