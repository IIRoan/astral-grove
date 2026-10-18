import { afterAll, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { createAuth } from '../../src/auth';
import { startCatalogMetadataWarmup } from '../../src/app';
import { sendTransactionalEmail } from '../../src/lib/email';
import { ImageStoreService } from '../../src/services/image-store';
import { PaClient } from '../../src/upstream/pa-client';
import { DeckSyncService } from '../../src/services/deck-sync';
import { ensureCollectionMembership } from '../../src/services/collection-membership';
import { collectionItems } from '../../src/db/schema';
import { startJmapFixture } from '../fixtures/migration/jmap';
import { getContext, getEnv } from './support';
import { cleanupTestUsers, signUpTestUser, authFetch } from './helpers/auth';
import { z } from 'zod';

const prefix = 'test-migration-baseline-';
afterAll(async () => {
  await cleanupTestUsers(`${prefix}%`);
});

describe('migration baseline service boundaries', () => {
  test('partial catalog sync publishes a local hash and remains retryable', async () => {
    const context = getContext();
    const previous = process.env.SYNC_MAX_PAGES;
    process.env.SYNC_MAX_PAGES = '1';
    try {
      startCatalogMetadataWarmup(context, {
        ...getEnv(),
        CATALOG_WARMUP_ON_START: false,
      });
      const result = await context.syncEngine.syncCatalog({ force: true });
      expect(result.pages).toBe(1);
      expect(result.changed).toBe(true);
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      const logical = await context.pa.getCard('OGN-001');
      await context.cardCache.upsertFromUpstream(logical);
      expect(await context.cardCache.upsertFromUpstream(logical)).toBe(false);
      expect(await context.cardCache.computeLocalCatalogHash()).toBe(result.hash);
      expect(
        Object.keys(await context.cardCache.countCollectibleVariantsBySetCode()).length
      ).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) delete process.env.SYNC_MAX_PAGES;
      else process.env.SYNC_MAX_PAGES = previous;
    }
  });
  test('TTS direct import adds copies and removeMany stays scoped to its collection', async () => {
    const stamp = Date.now();
    const first = await signUpTestUser({
      email: `${prefix}first-${stamp}@test.riftbound.dev`,
      password: 'synthetic-password-12345',
      name: 'First baseline user',
    });
    const second = await signUpTestUser({
      email: `${prefix}second-${stamp}@test.riftbound.dev`,
      password: 'synthetic-password-12345',
      name: 'Second baseline user',
    });
    const ids: string[] = [];
    for (const cookie of [first, second]) {
      const session = await (
        await authFetch('/api/auth/get-session', { cookie })
      ).json();
      ids.push(session.user.id);
      const response = await authFetch('/api/v1/collection/import', {
        cookie,
        method: 'POST',
        body: JSON.stringify({ tts: 'OGN-001-1 OGN-001-1' }),
      });
      expect(response.status).toBe(200);
    }
    const ctx = getContext();
    const firstCollection = await ensureCollectionMembership(ctx.db, ids[0]!);
    const secondCollection = await ensureCollectionMembership(ctx.db, ids[1]!);
    await ctx.collectionService.removeMany(firstCollection.collectionId, []);
    await ctx.collectionService.removeMany(firstCollection.collectionId, ['OGN-001']);
    const firstRows = await ctx.db
      .select()
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, firstCollection.collectionId),
          eq(collectionItems.variantNumber, 'OGN-001')
        )
      );
    const secondRows = await ctx.db
      .select()
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, secondCollection.collectionId),
          eq(collectionItems.variantNumber, 'OGN-001')
        )
      );
    expect(firstRows).toHaveLength(0);
    expect(secondRows[0]?.quantity).toBe(2);
  });
  test('legacy PA helpers retain validation and partner headers', async () => {
    const ctx = getContext();
    const sync = new DeckSyncService(ctx.db, ctx.pa, ctx.cardCache, {
      name: 'x-fixture-partner',
      value: 'synthetic',
    });
    expect((await sync.listUpstreamDeckIds(1)).length).toBe(1);
    expect((await sync.listStoredDeckPayloads(1))[0]?.mainDeck.length).toBeGreaterThan(
      0
    );
    await expect(
      sync.deleteUpstreamDeck('migration-fixture-community-deck')
    ).rejects.toThrow('403');
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch() {
        return Response.json({
          data: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              cardmarketId: 1,
              provider: 'cardmarket',
              currency: 'EUR',
              isFoil: false,
              lowPrice: '1.00',
              marketPrice: '2.00',
              midPrice: null,
              highPrice: null,
              avg1Day: null,
              avg7Day: null,
              avg30Day: null,
              lastUpdated: '2026-10-01T00:00:00.000Z',
            },
          ],
        });
      },
    });
    try {
      const pa = new PaClient({ ...getEnv(), PA_BASE_URL: server.url.origin });
      expect((await pa.getAllPrices())[0]?.marketPrice).toBe('2.00');
    } finally {
      server.stop(true);
    }
  });
  test('real email-OTP signup and reset invoke the configured local JMAP transport', async () => {
    const jmap = startJmapFixture();
    jmap.failDiscovery();
    const ctx = getContext();
    const email = `${prefix}mail-${Date.now()}@test.riftbound.dev`;
    const env = {
      ...getEnv(),
      STALWART_JMAP_URL: jmap.url,
      STALWART_JMAP_USERNAME: 'fixture-user',
      STALWART_JMAP_PASSWORD: 'fixture-password',
      EMAIL_FROM: 'noreply@test.riftbound.dev',
    };
    try {
      const auth = createAuth(ctx.db, env);
      const request = async (path: string, body: unknown) =>
        auth.handler(
          new Request(`${env.BETTER_AUTH_URL}${path}`, {
            method: 'POST',
            headers: {
              origin: env.BETTER_AUTH_URL,
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          })
        );
      const signup = await request('/api/auth/sign-up/email', {
        email,
        password: 'synthetic-password-12345',
        name: 'Verification baseline',
      });
      expect(signup.status).toBe(200);
      expect((await signup.json()).token).toBeNull();
      expect(jmap.messages).toHaveLength(1);
      const message = z
        .object({ bodyValues: z.object({ text: z.object({ value: z.string() }) }) })
        .parse(jmap.messages[0]);
      const otp = /Verification code: (\d{6})/.exec(message.bodyValues.text.value)?.[1];
      expect(otp).toHaveLength(6);
      const verify = await request('/api/auth/email-otp/verify-email', { email, otp });
      expect(verify.status).toBe(200);
      expect(verify.headers.get('set-cookie')).toContain('session_token');
      const reset = await request('/api/auth/request-password-reset', {
        email,
        redirectTo: 'http://localhost:7001/reset-password',
      });
      expect(reset.status).toBe(200);
      expect(jmap.messages).toHaveLength(2);
      await sendTransactionalEmail(env, {
        to: email,
        subject: 'Transport baseline',
        text: 'Synthetic fixture',
        html: '<p>Synthetic fixture</p>',
      });
      expect(jmap.messages).toHaveLength(3);
    } finally {
      jmap.stop();
    }
  });
  test('native object storage writes originals and resized WebP derivatives locally', async () => {
    const objects = new Map<string, { body: ArrayBuffer; type: string }>();
    const storage = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        const key = new URL(request.url).pathname;
        if (request.method === 'PUT') {
          objects.set(key, {
            body: await request.arrayBuffer(),
            type: request.headers.get('content-type') ?? '',
          });
          return new Response(null, { status: 200 });
        }
        const object = objects.get(key);
        return object
          ? new Response(request.method === 'HEAD' ? null : object.body, {
              headers: {
                'content-type': object.type,
                'content-length': String(object.body.byteLength),
              },
            })
          : new Response(null, { status: 404 });
      },
    });
    const fetchOriginal = globalThis.fetch;
    const sharp = (await import('sharp')).default;
    const png = await sharp({
      create: { width: 256, height: 128, channels: 4, background: '#123456' },
    })
      .png()
      .toBuffer();
    globalThis.fetch = async (input, init) =>
      String(input instanceof Request ? input.url : input).startsWith(
        'https://cdn.piltoverarchive.com/'
      )
        ? new Response(png, { headers: { 'content-type': 'image/png' } })
        : fetchOriginal(input, init);
    try {
      const store = new ImageStoreService({
        ...getEnv(),
        S3_ENDPOINT: storage.url.origin,
        S3_BUCKET: 'migration-fixture',
        S3_ACCESS_KEY_ID: 'fixture-access',
        S3_SECRET_ACCESS_KEY: 'fixture-secret',
      });
      const result = await store.serveImage('cards/migration-fixture.png', {
        width: 96,
        clientIp: '127.0.0.1',
      });
      expect(result?.kind).toBe('body');
      if (result?.kind !== 'body') throw new Error('Missing image body');
      expect(result.contentType).toBe('image/webp');
      const metadata = await sharp(Buffer.from(result.body)).metadata();
      expect(metadata.width).toBe(96);
      expect(metadata.height).toBe(48);
      for (
        let attempt = 0;
        attempt < 50 && !objects.has('/migration-fixture/cards/migration-fixture.png');
        attempt++
      )
        await Bun.sleep(20);
      expect(objects.has('/migration-fixture/cards/migration-fixture.png')).toBe(true);
      expect(
        objects.has('/migration-fixture/thumbs/w96/cards/migration-fixture.png')
      ).toBe(true);
      const cached = await store.serveImage('cards/migration-fixture.png', {
        width: 96,
      });
      expect(cached?.kind === 'body' && cached.source).toBe('memory');
    } finally {
      globalThis.fetch = fetchOriginal;
      storage.stop(true);
    }
  });
});
