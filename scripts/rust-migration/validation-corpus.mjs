import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as contracts from '../../packages/contracts/src/index.ts';

const destination = resolve(
  import.meta.dir,
  '../../plans/rust-migration/baseline/validation.jsonl.gz'
);
function sample(schema, expanded = false) {
  const d = schema._def;
  switch (d.typeName) {
    case 'ZodDefault':
      return d.defaultValue();
    case 'ZodOptional':
      return expanded ? sample(d.innerType, true) : undefined;
    case 'ZodNullable':
      return expanded ? sample(d.innerType, true) : null;
    case 'ZodEffects':
      return sample(d.schema, expanded);
    case 'ZodUnknown':
    case 'ZodAny':
      return {};
    case 'ZodLiteral':
      return d.value;
    case 'ZodBoolean':
      return false;
    case 'ZodNumber': {
      const minimum = d.checks.find((c) => c.kind === 'min');
      return minimum ? minimum.value + (minimum.inclusive === false ? 1 : 0) : 1;
    }
    case 'ZodString': {
      if (d.checks.some((c) => c.kind === 'uuid'))
        return '11111111-1111-4111-8111-111111111111';
      if (d.checks.some((c) => c.kind === 'email')) return 'fixture@example.test';
      if (d.checks.some((c) => c.kind === 'datetime'))
        return '2026-10-18T00:00:00.000Z';
      if (d.checks.some((c) => c.kind === 'date')) return '2026-10-18';
      if (d.checks.some((c) => c.kind === 'url'))
        return 'https://fixture.example.test/card.webp';
      if (d.checks.some((c) => c.kind === 'regex')) return 'OGN-001';
      return 'x'.repeat(
        Math.max(1, d.checks.find((c) => c.kind === 'min')?.value ?? 1)
      );
    }
    case 'ZodEnum':
      return d.values[0];
    case 'ZodObject':
      return Object.fromEntries(
        Object.entries(d.shape())
          .map(([key, value]) => [key, sample(value, expanded)])
          .filter(([, value]) => value !== undefined)
      );
    case 'ZodArray':
      return Array.from({ length: d.minLength?.value ?? (expanded ? 1 : 0) }, () =>
        sample(d.type, expanded)
      );
    case 'ZodRecord':
      return expanded ? { fixture: sample(d.valueType, true) } : {};
    case 'ZodUnion':
    case 'ZodDiscriminatedUnion':
      return sample(
        (d.options instanceof Map ? [...d.options.values()] : d.options)[0],
        expanded
      );
    default:
      throw new Error(`Missing sample for ${d.typeName}`);
  }
}
const primitives = [
  undefined,
  null,
  false,
  true,
  {},
  [],
  -1,
  0,
  1,
  2147483648,
  9007199254740991,
  1.5,
  '',
  'true',
  'false',
  '1',
  '0',
  '  ',
  '0x10',
  '1e3',
  'Infinity',
  '10junk',
  '💚',
  '2026-01-01T00:00:00.1234567890Z',
  '1969-12-31T23:59:59.9999Z',
  '-0001-01-01',
  '+2026-01-01',
  '0000-02-29',
  '2026-02-29',
  '2024-02-29',
  '2026-01-01T24:00:00Z',
  '2026-01-01T01:00:00+01:00',
  '2026-01-01T00:00:00.0000000000000000Z',
  '2026-01-01T00:00:00z',
  '2026-01-01t00:00:00Z',
  '2026-01-01T00:00Z',
  '2026-01-01T00:00:60Z',
  JSON.parse('{"__proto__":{"polluted":true},"constructor":true}'),
];
function* paths(schema, value, path = [], depth = 0) {
  if (depth > 12) return;
  const d = schema._def;
  if (['ZodOptional', 'ZodNullable', 'ZodDefault'].includes(d.typeName)) {
    yield* paths(d.innerType, value, path, depth + 1);
    return;
  }
  if (d.typeName === 'ZodEffects') {
    yield* paths(d.schema, value, path, depth + 1);
    return;
  }
  if (d.typeName === 'ZodObject')
    for (const [key, child] of Object.entries(d.shape())) {
      yield [...path, key];
      yield* paths(child, value?.[key], [...path, key], depth + 1);
    }
  if (d.typeName === 'ZodArray' && Array.isArray(value) && value.length) {
    yield [...path, 0];
    yield* paths(d.type, value[0], [...path, 0], depth + 1);
  }
  if (d.typeName === 'ZodRecord' && value && typeof value === 'object')
    for (const [key, child] of Object.entries(value)) {
      yield [...path, key];
      yield* paths(d.valueType, child, [...path, key], depth + 1);
    }
  if (d.typeName === 'ZodUnion' || d.typeName === 'ZodDiscriminatedUnion') {
    for (const child of d.options instanceof Map
      ? [...d.options.values()]
      : d.options) {
      if (child.safeParse(value).success) {
        yield* paths(child, value, path, depth + 1);
        break;
      }
    }
  }
}
function changed(source, path, value) {
  const clone = structuredClone(source);
  let object = clone;
  for (const key of path.slice(0, -1)) object = object[key];
  if (value === undefined) delete object[path.at(-1)];
  else object[path.at(-1)] = value;
  return clone;
}
const cases = [];
for (const [name, schema] of Object.entries(contracts).filter(
  ([, value]) => value?._def
)) {
  const valid = sample(schema);
  const parsed = schema.safeParse(valid);
  if (!parsed.success) throw new Error(`Invalid sample for ${name}: ${parsed.error}`);
  const inputs = [...primitives, valid];
  if (schema._def.typeName === 'ZodObject') {
    for (const key of Object.keys(schema._def.shape())) {
      inputs.push(
        Object.fromEntries(Object.entries(valid).filter(([field]) => field !== key))
      );
      for (const value of primitives) inputs.push({ ...valid, [key]: value });
    }
    inputs.push({ ...valid, extraUnknownField: 'must be stripped' });
  }
  const expanded = sample(schema, true);
  if (!schema.safeParse(expanded).success)
    throw new Error(`Invalid expanded sample for ${name}`);
  inputs.push(expanded);
  for (const path of paths(schema, expanded)) {
    if (path.length < 2) continue;
    for (const value of [
      undefined,
      null,
      false,
      {},
      [],
      0,
      1.5,
      '',
      'invalid',
      '2026-02-30',
      9007199254740992,
    ])
      inputs.push(changed(expanded, path, value));
  }
  for (const input of inputs) {
    const normalized =
      input === undefined ? undefined : JSON.parse(JSON.stringify(input));
    const result = schema.safeParse(normalized);
    cases.push({
      schema: name,
      input: normalized,
      hasInput: normalized !== undefined,
      expected: result.success
        ? { ok: true, value: result.data, hasValue: result.data !== undefined }
        : { ok: false },
    });
  }
}
if (process.argv.includes('--check-rust')) {
  const input = new TextDecoder().decode(Bun.gunzipSync(readFileSync(destination)));
  const binary = resolve(import.meta.dir, '../../target/debug/validate-contracts');
  const run = spawnSync(binary, [], {
    input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0)
    throw new Error(`Rust validator probe failed (${run.status}): ${run.stderr}`);
  const actual = run.stdout.trim().split('\n').map(JSON.parse);
  const expected = input.trim().split('\n').map(JSON.parse);
  if (actual.length !== expected.length)
    throw new Error('Missing Rust validation results');
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, child]) => [key, canonical(child)])
          )
        : value;
  const mismatches = expected.flatMap((row, index) =>
    JSON.stringify(canonical(row.expected)) === JSON.stringify(canonical(actual[index]))
      ? []
      : [
          {
            schema: row.schema,
            input: row.input,
            expected: row.expected,
            actual: actual[index],
          },
        ]
  );
  writeFileSync(
    '/tmp/astral-validator-mismatches.json',
    JSON.stringify(mismatches, null, 2)
  );
  if (mismatches.length)
    throw new Error(
      `${mismatches.length}/${expected.length} validator mismatches; see /tmp/astral-validator-mismatches.json`
    );
  console.log(`Rust/Zod validation parity: ${expected.length} cases, zero mismatches`);
} else {
  mkdirSync(resolve(destination, '..'), { recursive: true });
  writeFileSync(
    destination,
    Bun.gzipSync(`${cases.map((row) => JSON.stringify(row)).join('\n')}\n`)
  );
  console.log(
    `Pinned ${cases.length} validation cases across ${new Set(cases.map((row) => row.schema)).size} schemas`
  );
}
