import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import { CardDetailResponse } from '@riftbound/contracts';
import { cookie, createHarness, json } from './support';

setDefaultTimeout(60000);
const harness = createHarness();
const emails: string[] = [];
const cardIds: string[] = [];
let app: Awaited<ReturnType<typeof harness.startRust>>;
let upstreamCard: unknown = null;
const pa = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch(request) {
    return new URL(request.url).pathname.startsWith('/v1/cards/') && upstreamCard
      ? Response.json(upstreamCard)
      : Response.json({ error: 'Not found' }, { status: 404 });
  },
});
beforeAll(async () => {
  app = await harness.startRust({ PA_BASE_URL: pa.url.origin });
});
afterAll(async () => {
  await harness.sql`DELETE FROM "user" WHERE email=ANY(${emails})`;
  await harness.sql`DELETE FROM card_colors WHERE card_id=ANY(${cardIds}::uuid[])`;
  await harness.sql`DELETE FROM variants WHERE card_id=ANY(${cardIds}::uuid[])`;
  await harness.sql`DELETE FROM cards WHERE id=ANY(${cardIds}::uuid[])`;
  await harness.stopRust();
  pa.stop(true);
});

test('a Piltover Archive renumber of an existing variant id updates the cached row', async () => {
  const [seed] = await harness.sql<
    { raw: { variants: Record<string, unknown>[] } & Record<string, unknown> }[]
  >`SELECT upstream_raw AS raw FROM cards WHERE jsonb_array_length(upstream_raw->'variants')>0 LIMIT 1`;
  if (!seed) throw new Error('Offline catalog has no cards');
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
  const cardId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  cardIds.push(cardId);
  const card = (variantNumber: string) => ({
    ...seed.raw,
    id: cardId,
    name: `Renumber ${suffix}`,
    variants: [
      {
        ...seed.raw.variants[0],
        id: variantId,
        variantNumber,
        cardmarketId: null,
        tcgplayerId: null,
        parentVariantId: null,
      },
    ],
  });
  upstreamCard = card(`RVW-${suffix}`);
  expect((await app.fetch(`/api/v1/cards/RVW-${suffix}`)).status).toBe(200);
  upstreamCard = card(`RVW-${suffix}a`);
  const refreshed = await app.fetch(`/api/v1/cards/RVW-${suffix}?refresh=true`, {
    headers: { authorization: 'Bearer ' + app.config.ADMIN_SYNC_TOKEN },
  });
  expect(refreshed.status).toBe(200);
  const detail = CardDetailResponse.parse(await refreshed.json());
  expect(detail.data.variants.map((variant) => variant.variantNumber)).toEqual([
    `RVW-${suffix}a`,
  ]);
  expect([
    ...(await harness.sql`SELECT variant_number FROM variants WHERE card_id=${cardId}::uuid`),
  ]).toEqual([{ variant_number: `RVW-${suffix}a` }]);
});

test('collection writes for a variant missing from the catalog return 404, not a foreign-key 500', async () => {
  const email = `review-missing-${crypto.randomUUID()}@test.riftbound.dev`;
  emails.push(email);
  const signup = await app.fetch(
    '/api/auth/sign-up/email',
    json({ name: 'Missing', email, password: 'review-missing-password-12345' })
  );
  expect(signup.status).toBe(200);
  const session = cookie(signup);
  const missing = `ZZZ-${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const set = await app.fetch(`/api/v1/collection/${missing}`, {
    ...json({ quantity: 1 }, session),
    method: 'PUT',
  });
  expect(set.status).toBe(404);
  expect(await set.json()).toMatchObject({ message: `Variant ${missing} not found` });
  for (const body of [{}, { isFoil: true }]) {
    expect(
      (await app.fetch(`/api/v1/collection/${missing}/add`, json(body, session))).status
    ).toBe(404);
  }
});
