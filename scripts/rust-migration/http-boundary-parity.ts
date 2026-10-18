import { createApp } from '../../tests/reference-api/src/app';
import { createHarness, json, cookie } from '../../apps/backend/test/support';
import { writeFileSync } from 'node:fs';
const harness = createHarness();
const app = await harness.startRust();
const env = {
  ...app.config,
  NODE_ENV: 'test' as const,
  PORT: Number(app.config.PORT),
  DB_POOL_MAX: 3,
  TRUSTED_ORIGINS: [],
  CATALOG_WARMUP_ON_START: false,
  CATALOG_PROBE_DISABLED: true,
  CARDMARKET_GAME_ID: 22,
  PRICE_HISTORY_RETAIN_DAYS: 90,
  PRICE_HISTORY_RETAIN_SNAPSHOTS: 30,
};
const context = createApp(env);
context.app.listen({ hostname: '127.0.0.1', port: 0 });
const legacyOrigin = `http://127.0.0.1:${context.app.server!.port}`;
const email = `boundary-${crypto.randomUUID()}@test.riftbound.dev`;
let checked = 0;
const mismatches: unknown[] = [];
const corrections: unknown[] = [];
try {
  const signup = await app.fetch(
    '/api/auth/sign-up/email',
    json({ name: 'Boundary test', email, password: 'boundary-password-12345' })
  );
  const signed = cookie(signup);
  if (signup.status !== 200) throw new Error('Boundary signup failed');
  const endpoints = [
    ['PUT', '/api/v1/collection/OGN-001'],
    ['POST', '/api/v1/collection/OGN-001/add'],
    ['POST', '/api/v1/collection/OGN-001/remove'],
    ['PUT', '/api/v1/wishlist/OGN-001'],
    ['PUT', '/api/v1/settings/phone'],
    ['POST', '/api/v1/cards/batch'],
    ['POST', '/api/v1/deck-rules/validate'],
    ['PUT', '/api/v1/decks/missing'],
  ];
  const bodies = [
    undefined,
    'null',
    '{}',
    '[]',
    'true',
    '1',
    '"text"',
    '{',
    '{"delta":null}',
    '{"quantity":null}',
    '{"name":null}',
    '{"variantNumbers":null}',
  ];
  for (const [method, path] of endpoints)
    for (const body of bodies)
      for (const authenticated of [true, false]) {
        const init = {
          method,
          headers: {
            origin: app.origin,
            'content-type': 'application/json',
            ...(authenticated ? { cookie: signed } : {}),
          },
          ...(body === undefined ? {} : { body }),
        };
        const old = await fetch(legacyOrigin + path, init);
        const native = await app.fetch(path!, init);
        const read = async (response: Response) => {
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            data = null;
          }
          return { status: response.status, ...(!response.ok ? { body: data } : {}) };
        };
        const a = await read(old),
          b = await read(native);
        checked++;
        if (JSON.stringify(a) === JSON.stringify(b)) continue;
        const correction =
          a.status === 500 &&
          a.body?.name === 'RequestValidationError' &&
          a.body?.cause?.name === 'ZodError' &&
          b.status === 422 &&
          JSON.stringify(b.body) ===
            JSON.stringify({
              error: 'VALIDATION_ERROR',
              message: 'Request validation failed',
            })
            ? 'invalid-schema-input-is-422'
            : a.status === 400 &&
                a.body?.type === 'parse' &&
                b.status === 400 &&
                JSON.stringify(b.body) ===
                  JSON.stringify({
                    error: 'VALIDATION_ERROR',
                    message: 'Invalid JSON request body',
                  })
              ? 'malformed-json-uses-public-error-envelope'
              : null;
        const evidence = { method, path, body, authenticated, legacy: a, rust: b };
        if (correction) corrections.push({ correction, ...evidence });
        else mismatches.push(evidence);
      }
  writeFileSync(
    '/tmp/astral-http-boundary-mismatches.json',
    JSON.stringify({ checked, corrections, mismatches }, null, 2)
  );
  console.log({
    checked,
    intentionalCorrections: corrections.length,
    unexpectedMismatches: mismatches.length,
  });
  if (mismatches.length) process.exitCode = 1;
} finally {
  await context.app.stop();
  await context.client.end();
  await harness.sql`DELETE FROM "user" WHERE email=${email}`;
  await harness.stopRust();
}
