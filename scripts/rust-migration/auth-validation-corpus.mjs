import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../tests/reference-api/src/app';
const root = resolve(import.meta.dirname, '../..');
process.chdir(root);
const path = 'plans/rust-migration/baseline/auth-validation.jsonl.gz';
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
function sample(schema) {
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  if (schema.anyOf) return sample(schema.anyOf[0]);
  if (schema.allOf) return Object.assign({}, ...schema.allOf.map(sample));
  if (schema.type === 'object')
    return Object.fromEntries(
      Object.entries(schema.properties ?? { fixture: { type: 'string' } }).map(
        ([key, child]) => [key, sample(child)]
      )
    );
  if (schema.type === 'array') return [sample(schema.items ?? {})];
  if (schema.type === 'string')
    return schema.format === 'email'
      ? 'fixture@example.test'
      : 'x'.repeat(Math.max(1, schema.minLength ?? 1));
  if (schema.type === 'boolean') return true;
  if (schema.type === 'number' || schema.type === 'integer') return 1;
  if (schema.type === 'null') return null;
  return {};
}
function* paths(value, path = []) {
  if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) {
      yield [...path, key];
      yield* paths(child, [...path, key]);
    }
}
function replace(source, path, value) {
  const result = structuredClone(source);
  let object = result;
  for (const key of path.slice(0, -1)) object = object[key];
  if (value === undefined) delete object[path.at(-1)];
  else object[path.at(-1)] = value;
  return result;
}
const primitives = [
  undefined,
  null,
  false,
  true,
  0,
  1,
  1.5,
  '',
  'invalid',
  'a..b@example.test',
  'fixture@example.test',
  [],
  {},
  ['x'],
];
const definitions = JSON.parse(
  readFileSync('apps/backend/src/auth/request-schemas.json', 'utf8')
);
const cases = [];
try {
  for (const [name, definition] of Object.entries(definitions))
    for (const kind of ['body', 'query']) {
      const zod = ctx.auth.api[name].options[kind],
        schema = definition[kind];
      if (!schema || !zod) continue;
      const valid = sample(schema);
      if (!zod.safeParse(valid).success)
        throw new Error(`Bad auth sample: ${name} ${kind}`);
      const values = [...(kind === 'body' ? primitives : []), valid];
      for (const path of paths(valid))
        for (const value of primitives) values.push(replace(valid, path, value));
      values.push({ ...valid, extra: 'unknown' });
      for (const original of values) {
        const input =
          original === undefined ? undefined : JSON.parse(JSON.stringify(original));
        const parsed = zod.safeParse(input);
        const expected = parsed.success
          ? { ok: true }
          : {
              ok: false,
              message: parsed.error.issues
                .map(
                  (issue) =>
                    `[${kind}${issue.path.length ? '.' + issue.path.join('.') : ''}] ${issue.message}`
                )
                .join('; '),
            };
        cases.push({
          schema: name,
          kind,
          hasInput: input !== undefined,
          ...(input === undefined ? {} : { input }),
          expected,
        });
      }
    }
  if (!process.argv.includes('--check-rust')) {
    writeFileSync(
      path,
      Bun.gzipSync(cases.map((row) => JSON.stringify(row)).join('\n') + '\n')
    );
    console.log(`Pinned ${cases.length} auth schema cases`);
  } else {
    const pinned = new TextDecoder()
      .decode(Bun.gunzipSync(readFileSync(path)))
      .trim()
      .split('\n')
      .map(JSON.parse);
    if (JSON.stringify(pinned) !== JSON.stringify(cases))
      throw new Error('Auth schema baseline drifted');
    const result = spawnSync('target/debug/validate-contracts', [], {
      input:
        pinned.map((row) => JSON.stringify({ ...row, auth: true })).join('\n') + '\n',
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) throw new Error(result.stderr);
    const actual = result.stdout.trim().split('\n').map(JSON.parse);
    if (actual.length !== pinned.length)
      throw new Error('Missing auth validation results');
    const errors = pinned.flatMap((row, i) =>
      JSON.stringify(row.expected) === JSON.stringify(actual[i])
        ? []
        : [{ ...row, actual: actual[i] }]
    );
    writeFileSync(
      '/tmp/astral-auth-validation-mismatches.json',
      JSON.stringify(errors, null, 2)
    );
    console.log({ checked: pinned.length, mismatches: errors.length });
    if (errors.length) process.exitCode = 1;
  }
} finally {
  await ctx.client.end();
}
