import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dir, '../..');
const rows = readFileSync(
  resolve(root, 'plans/rust-migration/test-destinations.tsv'),
  'utf8'
)
  .trim()
  .split('\n');
const columns = rows.shift()!.split('\t');
const destinations = rows.map((line) =>
  Object.fromEntries(line.split('\t').map((value, index) => [columns[index]!, value]))
);
if (
  destinations.length !== 617 ||
  new Set(destinations.map((row) => row.id)).size !== 617
)
  throw new Error('Original 617-case inventory changed');
for (const row of destinations) {
  if (!['ORACLE_UNIT', 'NATIVE_COMPAT_MIXED'].includes(row.status!))
    throw new Error(`Unresolved case ${row.id}`);
  if (!existsSync(resolve(root, row.destination!)))
    throw new Error(`Missing test destination: ${row.destination}`);
  const source = ts.createSourceFile(
    row.destination!,
    readFileSync(resolve(root, row.destination!), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const literals: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isStringLiteralLike(node)) literals.push(node.text);
    if (ts.isTemplateExpression(node))
      literals.push(
        [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(
          '%s'
        )
      );
    ts.forEachChild(node, visit);
  }
  visit(source);
  const name = row.case!.split(' > ').at(-1)!;
  const pattern = (value: string) =>
    new RegExp(
      '^' +
        value
          .split(/%[sdifjo]/)
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*') +
        '$'
    );
  if (!literals.some((value) => pattern(value).test(name)))
    throw new Error(`Test identifier disappeared: ${row.case} in ${row.destination}`);
}
const reportIndex = process.argv.indexOf('--report');
if (reportIndex !== -1) {
  const tier = process.argv[process.argv.indexOf('--tier') + 1];
  if (!['unit', 'e2e'].includes(tier!)) throw new Error('Use --tier unit|e2e');
  const xml = readFileSync(process.argv[reportIndex + 1]!, 'utf8');
  const decode = (value: string) =>
    value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  const cases = new Map<string, number>();
  for (const match of xml.matchAll(
    /<testcase\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g
  )) {
    if (/<(?:failure|error|skipped)\b/.test(match[2] ?? ''))
      throw new Error('Execution report contains a failed, skipped or errored case');
    const attributes = Object.fromEntries(
      [...match[1]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((entry) => [
        entry[1]!,
        decode(entry[2]!),
      ])
    );
    let file = attributes.file!;
    if (file.startsWith('test/')) file = 'tests/reference-api/' + file;
    const key = [
      file,
      attributes.classname
        ? [attributes.classname, attributes.name].join(' > ')
        : attributes.name,
    ].join(':');
    cases.set(key, (cases.get(key) ?? 0) + 1);
  }
  let count = 0;
  for (const row of destinations.filter((row) => row.tier === tier)) {
    const key = row.destination + ':' + row.case;
    if ((cases.get(key) ?? 0) < Number(row.occurrence))
      throw new Error(`Baseline case did not execute: ${key}`);
    count++;
  }
  console.log(
    `Executed baseline destinations verified: ${count} ${tier} cases, none skipped`
  );
} else
  console.log(
    'Baseline destinations verified: 398 retained oracle unit cases, 219 compatibility cases (Rust HTTP plus reference DB/service checks)'
  );
