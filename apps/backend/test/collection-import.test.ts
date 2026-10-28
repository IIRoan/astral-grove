import { afterAll, beforeAll, expect, setDefaultTimeout, test } from 'bun:test';
import {
  CollectionImportPreviewResponse,
  CollectionImportResponse,
  CollectionListResponse,
} from '@riftbound/contracts';
import { createHarness, json } from './support';

setDefaultTimeout(60000);
const harness = createHarness();
let app: Awaited<ReturnType<typeof harness.startServer>>;
let upstreamRequests = 0;
const upstream = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch() {
    upstreamRequests++;
    return Response.json({ error: 'Fixture upstream unavailable' }, { status: 503 });
  },
});

beforeAll(async () => {
  app = await harness.startServer({ PA_BASE_URL: upstream.url.origin });
});
afterAll(async () => {
  await harness.stopServer();
  upstream.stop(true);
});

test.each(['import', 'import/preview'])(
  '%s resolves mixed-case local variant numbers without contacting upstream',
  async (operation) => {
    const user = await harness.signup(app, 'import-case');
    const before = upstreamRequests;
    const response = await app.fetch(
      `/api/v1/collection/${operation}`,
      json(
        {
          items: [
            { variantNumber: ' ogn-001 ', quantity: 2 },
            { variantNumber: 'oGn-001', quantity: 3 },
          ],
        },
        user.cookie
      )
    );
    expect(response.status).toBe(200);
    if (operation === 'import') {
      const { data } = CollectionImportResponse.parse(await response.json());
      expect(data).toMatchObject({
        imported: 1,
        totalCopies: 5,
        resolvedFromUpstream: 0,
        failedRows: 0,
      });
      const collection = CollectionListResponse.parse(
        await (
          await app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } })
        ).json()
      );
      expect(collection.data).toHaveLength(1);
      expect(collection.data[0]).toMatchObject({
        variantNumber: 'OGN-001',
        quantity: 5,
      });
    } else {
      const { data } = CollectionImportPreviewResponse.parse(await response.json());
      expect(data).toMatchObject({
        totalTokens: 5,
        totalCopies: 5,
        uniquePrintings: 1,
        unresolvedCount: 0,
      });
      expect(data.items[0]).toMatchObject({ variantNumber: 'OGN-001', quantity: 5 });
    }
    expect(upstreamRequests).toBe(before);
  }
);

test.each([
  ['OGN-001', false],
  ['OGN-111', true],
] as const)(
  'imports merge inferred and explicit finishes for %s without losing copies',
  async (variantNumber, isFoil) => {
    const user = await harness.signup(app, 'import-finish');
    const items = [
      { variantNumber, quantity: 2 },
      { variantNumber, quantity: 3, isFoil },
      { variantNumber, quantity: 4, isFoil: !isFoil },
    ];
    const previewResponse = await app.fetch(
      '/api/v1/collection/import/preview',
      json({ items }, user.cookie)
    );
    expect(previewResponse.status).toBe(200);
    const preview = CollectionImportPreviewResponse.parse(await previewResponse.json());
    const response = await app.fetch(
      '/api/v1/collection/import',
      json({ items }, user.cookie)
    );
    expect(response.status).toBe(200);
    const result = CollectionImportResponse.parse(await response.json());
    const collection = CollectionListResponse.parse(
      await (
        await app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } })
      ).json()
    );
    expect(collection.meta.totalQuantity).toBe(9);
    expect(collection.data).toHaveLength(2);
    expect(collection.data.find((item) => item.isFoil === isFoil)?.quantity).toBe(5);
    expect(collection.data.find((item) => item.isFoil !== isFoil)?.quantity).toBe(4);
    expect(result.data).toMatchObject({ imported: 2, totalCopies: 9, failedRows: 0 });
    expect(preview.data).toMatchObject({
      totalCopies: 9,
      uniquePrintings: 2,
      unresolvedCount: 0,
    });
    expect(preview.data.items).toEqual([
      { variantNumber, quantity: 5, isFoil, condition: 'near_mint', language: 'en' },
      {
        variantNumber,
        quantity: 4,
        isFoil: !isFoil,
        condition: 'near_mint',
        language: 'en',
      },
    ]);
  }
);

test('add imports retain metadata on new stacks and preserve existing stack metadata', async () => {
  const user = await harness.signup(app, 'import-metadata');
  const original = {
    variantNumber: 'OGN-001',
    quantity: 2,
    notes: 'First purchase',
    isGraded: true,
    gradeCompany: 'PSA',
    gradeScore: '10',
  };
  for (const item of [
    original,
    { ...original, notes: 'Second purchase', gradeScore: '9' },
  ]) {
    const response = await app.fetch(
      '/api/v1/collection/import',
      json({ mode: 'add', items: [item] }, user.cookie)
    );
    expect(response.status).toBe(200);
    const result = CollectionImportResponse.parse(await response.json());
    expect(result.data).toMatchObject({ imported: 1, totalCopies: 2, failedRows: 0 });
    const collection = CollectionListResponse.parse(
      await (
        await app.fetch('/api/v1/collection', { headers: { cookie: user.cookie } })
      ).json()
    );
    expect(collection.data).toHaveLength(1);
    expect(collection.data[0]).toMatchObject({
      ...original,
      quantity: item === original ? 2 : 4,
    });
  }
});
