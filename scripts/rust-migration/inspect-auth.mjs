import { writeFileSync } from 'node:fs';
import { createApp } from '../../tests/reference-api/src/app';
const env = {
  NODE_ENV: 'test',
  PORT: 7000,
  HOST: '127.0.0.1',
  DATABASE_URL:
    'postgres://riftbound:riftbound@127.0.0.1:5433/riftbound_test_rust_baseline_20261018',
  DB_POOL_MAX: 1,
  PA_API_KEY: 'ak_synthetic',
  PA_BASE_URL: 'http://127.0.0.1:1',
  ADMIN_SYNC_TOKEN: 'synthetic-baseline-admin',
  BETTER_AUTH_SECRET: 'synthetic-baseline-secret-more-than-32-characters',
  BETTER_AUTH_URL: 'http://localhost:7000',
  PUBLIC_APP_URL: 'http://localhost:7001',
  TRUSTED_ORIGINS: [],
  CATALOG_WARMUP_ON_START: false,
  CATALOG_PROBE_DISABLED: true,
  CARDMARKET_GAME_ID: 22,
  PRICE_HISTORY_RETAIN_DAYS: 90,
  PRICE_HISTORY_RETAIN_SNAPSHOTS: 30,
};
const ctx = createApp(env);
try {
  const api = ctx.auth.api;
  const schemas = Object.fromEntries(
    Object.entries(api).map(([name, endpoint]) => {
      const options = endpoint.options;
      return [
        name,
        {
          path: endpoint.path ?? options?.path,
          method: options?.method,
          bodyOptional: options?.body?.safeParse?.(undefined).success,
          body: options?.body?.toJSONSchema?.({ io: 'input', unrepresentable: 'any' }),
          query: options?.query?.toJSONSchema?.({
            io: 'input',
            unrepresentable: 'any',
          }),
        },
      ];
    })
  );
  writeFileSync(
    'plans/rust-migration/baseline/auth-request-schemas.json',
    JSON.stringify(schemas, null, 2) + '\n'
  );
  console.log(Object.keys(schemas).length, 'auth endpoint definitions captured');
  console.log(JSON.stringify(schemas.signUpEmail));
} finally {
  await ctx.client.end();
}
