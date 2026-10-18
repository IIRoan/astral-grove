import { readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dir, '../../../..');
const baseline = JSON.parse(
  readFileSync(resolve(root, 'plans/rust-migration/baseline/source.json'), 'utf8')
) as {
  source: Array<{ path: string; symbols: Array<{ name: string; line: number }> }>;
};
const known = new Map(
  baseline.source.map((file) => [
    file.path,
    new Set(file.symbols.map((symbol) => `${symbol.line}:${symbol.name}`)),
  ])
);
const hits = new Set<string>();
const traceKey = Symbol.for('astral-grove.baseline.hits');
Reflect.set(globalThis, traceKey, hits);

Bun.plugin({
  name: 'astral-grove-function-baseline',
  setup(builder) {
    builder.onLoad({ filter: /tests\/reference-api\/src\/.*\.ts$/ }, (args) => {
      const path = relative(root, args.path).replace(
        'tests/reference-api/src/',
        'apps/api/src/'
      );
      const source = ts.createSourceFile(
        path,
        readFileSync(args.path, 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      const transformed = ts.transform(source, [
        (context) => {
          function visit(node: ts.Node): ts.Node {
            const current = ts.visitEachChild(node, visit, context);
            if (!(
              (ts.isFunctionDeclaration(current) ||
                ts.isMethodDeclaration(current) ||
                ts.isConstructorDeclaration(current) ||
                ts.isGetAccessorDeclaration(current) ||
                ts.isSetAccessorDeclaration(current) ||
                ts.isArrowFunction(current)) &&
              current.body
            ))
              return current;
            const original = node;
            const owner: string[] = [];
            for (
              let parent: ts.Node | undefined = original;
              parent;
              parent = parent.parent
            ) {
              if (
                (ts.isClassDeclaration(parent) ||
                  ts.isFunctionDeclaration(parent) ||
                  ts.isMethodDeclaration(parent) ||
                  ts.isGetAccessorDeclaration(parent) ||
                  ts.isSetAccessorDeclaration(parent)) &&
                parent.name
              )
                owner.unshift(parent.name.getText(source));
              else if (ts.isConstructorDeclaration(parent))
                owner.unshift('constructor');
            }
            const declaration =
              ts.isArrowFunction(original) && ts.isVariableDeclaration(original.parent)
                ? original.parent
                : original;
            if (ts.isArrowFunction(original)) {
              if (!ts.isVariableDeclaration(original.parent)) return current;
              owner.push(original.parent.name.getText(source));
            }
            const identity = `${source.getLineAndCharacterOfPosition(declaration.getStart(source)).line + 1}:${owner.join('.')}`;
            if (!known.get(path)?.has(identity)) return current;
            const hit = ts.factory.createExpressionStatement(
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createElementAccessExpression(
                    ts.factory.createIdentifier('globalThis'),
                    ts.factory.createCallExpression(
                      ts.factory.createPropertyAccessExpression(
                        ts.factory.createIdentifier('Symbol'),
                        'for'
                      ),
                      undefined,
                      [ts.factory.createStringLiteral('astral-grove.baseline.hits')]
                    )
                  ),
                  'add'
                ),
                undefined,
                [ts.factory.createStringLiteral(`${path}:${identity}`)]
              )
            );
            const body = ts.isBlock(current.body)
              ? ts.factory.updateBlock(current.body, [hit, ...current.body.statements])
              : ts.factory.createBlock(
                  [hit, ts.factory.createReturnStatement(current.body)],
                  true
                );
            if (ts.isFunctionDeclaration(current))
              return ts.factory.updateFunctionDeclaration(
                current,
                current.modifiers,
                current.asteriskToken,
                current.name,
                current.typeParameters,
                current.parameters,
                current.type,
                body
              );
            if (ts.isMethodDeclaration(current))
              return ts.factory.updateMethodDeclaration(
                current,
                current.modifiers,
                current.asteriskToken,
                current.name,
                current.questionToken,
                current.typeParameters,
                current.parameters,
                current.type,
                body
              );
            if (ts.isConstructorDeclaration(current))
              return ts.factory.updateConstructorDeclaration(
                current,
                current.modifiers,
                current.parameters,
                body
              );
            if (ts.isGetAccessorDeclaration(current))
              return ts.factory.updateGetAccessorDeclaration(
                current,
                current.modifiers,
                current.name,
                current.parameters,
                current.type,
                body
              );
            if (ts.isSetAccessorDeclaration(current))
              return ts.factory.updateSetAccessorDeclaration(
                current,
                current.modifiers,
                current.name,
                current.parameters,
                body
              );
            return ts.factory.updateArrowFunction(
              current,
              current.modifiers,
              current.typeParameters,
              current.parameters,
              current.type,
              current.equalsGreaterThanToken,
              body
            );
          }
          return (sourceFile) => ts.visitNode(sourceFile, visit) as ts.SourceFile;
        },
      ]);
      const result = transformed.transformed[0];
      if (!result) throw new Error('Missing instrumented source');
      const contents = ts.createPrinter().printFile(result);
      transformed.dispose();
      return { contents, loader: 'ts' };
    });
  },
});

export function writeTrace() {
  const result = baseline.source.flatMap((file) =>
    file.symbols.map((symbol) => ({
      file: file.path,
      ...symbol,
      exercised: hits.has(`${file.path}:${symbol.line}:${symbol.name}`),
    }))
  );
  const exercised = result.filter((symbol) => symbol.exercised).length;
  const target =
    process.env.BASELINE_TRACE_OUTPUT ?? '/tmp/astral-baseline-functions.json';
  writeFileSync(
    target,
    `${JSON.stringify({ total: result.length, exercised, uncovered: result.length - exercised, functions: result }, null, 2)}\n`
  );
  console.log(
    `Named function baseline: ${exercised}/${result.length} exercised; full inventory at ${target}`
  );
}

if (process.env.BASELINE_TRACE_ON_EXIT === 'true') {
  process.once('exit', writeTrace);
  process.on('SIGTERM', () => {
    writeTrace();
    if (process.listenerCount('SIGTERM') === 1) process.exit(0);
  });
}
