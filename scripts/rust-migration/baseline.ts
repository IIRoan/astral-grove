import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import './test-destinations';
import { createApp } from '../../tests/reference-api/src/app.ts';
import { loadEnv } from '../../tests/reference-api/src/env.ts';

const root = resolve(import.meta.dir, '../..');
const output = join(root, 'plans/rust-migration/baseline');
const revision = '598a9189d8beb1222a789ed836d37754e4826001';
const check = process.argv.includes('--check');
const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(directory, entry.name))
      : [join(directory, entry.name)]
  );

type SymbolEntry = {
  name: string;
  kind: string;
  line: number;
  endLine: number;
  parameters: string[];
};
function symbols(path: string, text: string): SymbolEntry[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const result: SymbolEntry[] = [];
  function visit(node: ts.Node, owner: string[]) {
    const named =
      ts.isClassDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node);
    const name =
      named && node.name
        ? node.name.getText(source)
        : ts.isConstructorDeclaration(node)
          ? 'constructor'
          : undefined;
    const next = name ? [...owner, name] : owner;
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isConstructorDeclaration(node) ||
        ts.isGetAccessorDeclaration(node) ||
        ts.isSetAccessorDeclaration(node)) &&
      node.body
    ) {
      result.push({
        name: next.join('.'),
        kind: ts.SyntaxKind[node.kind] ?? 'unknown',
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
        parameters: node.parameters.map((parameter) => parameter.getText(source)),
      });
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      result.push({
        name: [...owner, node.name.getText(source)].join('.'),
        kind: 'FunctionVariable',
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        endLine: source.getLineAndCharacterOfPosition(node.end).line + 1,
        parameters: node.initializer.parameters.map((parameter) =>
          parameter.getText(source)
        ),
      });
    }
    ts.forEachChild(node, (child) => visit(child, next));
  }
  visit(source, []);
  return result;
}

const source = files(join(root, 'tests/reference-api/src'))
  .filter((path) => path.endsWith('.ts'))
  .sort()
  .map((path) => {
    const name = relative(root, path).replace(
      'tests/reference-api/src/',
      'apps/api/src/'
    );
    const original = execFileSync('git', ['show', `${revision}:${name}`], {
      cwd: root,
      encoding: 'utf8',
    });
    if (digest(readFileSync(path, 'utf8')) !== digest(original))
      throw new Error(`Frozen reference changed: ${name}`);
    return { path: name, sha256: digest(original), symbols: symbols(name, original) };
  });

const recorded = JSON.parse(readFileSync(join(output, 'functions.json'), 'utf8')) as {
  functions: Array<{ file: string; line: number; name: string; exercisedBy: string[] }>;
};
const destinations = JSON.parse(
  readFileSync(join(output, 'function-destinations.json'), 'utf8')
) as Array<{ reference: string; functionCount: number; native: string[] }>;
for (const file of source) {
  const destination = destinations.find((row) => row.reference === file.path);
  if (
    !destination ||
    destination.functionCount !== file.symbols.length ||
    !destination.native.length ||
    destination.native.some((path) => !existsSync(join(root, path)))
  )
    throw new Error(`Incomplete native function destination: ${file.path}`);
  for (const symbol of file.symbols) {
    const evidence = recorded.functions.find(
      (row) =>
        row.file === file.path && row.line === symbol.line && row.name === symbol.name
    );
    if (!evidence?.exercisedBy.length)
      throw new Error(
        `Missing baseline execution evidence: ${file.path}:${symbol.name}`
      );
  }
}
if (destinations.length !== source.length || recorded.functions.length !== 516)
  throw new Error('Function inventory changed');
const originalMigrations = execFileSync(
  'git',
  ['ls-tree', '-r', '--name-only', revision, 'apps/api/drizzle'],
  { cwd: root, encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .filter((path) => path.endsWith('.sql'));
if (originalMigrations.length !== 16)
  throw new Error('Original migration inventory changed');
for (const path of originalMigrations) {
  const name = path.replace('apps/api/drizzle/', '');
  const file = join(root, 'apps/backend/migrations', name);
  const original = execFileSync(
    'git',
    ['show', `${revision}:apps/api/drizzle/${name}`],
    { cwd: root, encoding: 'utf8' }
  );
  if (digest(readFileSync(file, 'utf8')) !== digest(original))
    throw new Error(`Original migration changed: ${name}`);
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://riftbound:riftbound@127.0.0.1:5433/riftbound_test',
  PA_API_KEY: 'ak_baseline_no_network',
  ADMIN_SYNC_TOKEN: 'baseline-test-admin-token',
  BETTER_AUTH_SECRET: 'baseline-test-auth-secret-more-than-32-characters',
  BETTER_AUTH_URL: 'http://localhost:7000',
  PUBLIC_APP_URL: 'http://localhost:7001',
  CATALOG_PROBE_DISABLED: 'true',
});
for (const key of [
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
  'S3_ENDPOINT',
  'EMAIL_FROM',
  'STALWART_JMAP_USERNAME',
  'STALWART_JMAP_PASSWORD',
])
  delete process.env[key];
const context = createApp(loadEnv());
try {
  const routes = context.app.routes
    .filter((route) => route.method !== '*' && route.method !== 'OPTIONS')
    .map((route) => ({
      method: route.method,
      path: route.path.replace(/\/$/, '') || '/',
    }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
  const expected = JSON.parse(
    readFileSync(join(root, 'plans/rust-migration/inventory.json'), 'utf8')
  ) as { routes: Array<{ method: string; path: string }> };
  if (
    JSON.stringify(routes) !==
    JSON.stringify(expected.routes.map(({ method, path }) => ({ method, path })))
  )
    throw new Error('Mounted application routes differ from the reviewed inventory');
  const content = `${JSON.stringify({ revision, sourceFileCount: source.length, functionCount: source.reduce((sum, file) => sum + file.symbols.length, 0), routes, source }, null, 2)}\n`;
  const path = join(output, 'source.json');
  if (check) {
    if (
      JSON.stringify(JSON.parse(readFileSync(path, 'utf8'))) !==
      JSON.stringify(JSON.parse(content))
    )
      throw new Error('Baseline source/route inventory drifted');
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  console.log(
    `Baseline ${check ? 'verified' : 'written'}: ${source.length} source files, ${source.reduce((sum, file) => sum + file.symbols.length, 0)} named functions/methods, ${routes.length} application operations`
  );
} finally {
  await context.client.end();
}
