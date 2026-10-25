import { describe, expect, mock, test } from 'bun:test';
import ts from 'typescript';

mock.module('react-native', () => ({
  PixelRatio: {
    getPixelSizeForLayoutSize: (value: number) => value,
    roundToNearestPixel: (value: number) => value,
  },
}));

const { RecyclerViewManager } =
  await import('@shopify/flash-list/src/recyclerview/RecyclerViewManager');
const { areDimensionsNotEqual } =
  await import('@shopify/flash-list/src/recyclerview/utils/measureLayout');

type Size = { width: number; height: number };

function makeManager(numColumns: number) {
  const props = {
    data: Array.from({ length: 30 }, (_, id) => ({ id })),
    keyExtractor: (item: { id: number }) => String(item.id),
    renderItem: () => null,
    numColumns,
  };
  const manager = new RecyclerViewManager(props);
  manager.updateLayoutParams({ width: 400, height: 500 }, 0);
  manager.processDataUpdate();
  return { manager, props };
}

// Run the shipped callback itself with the real layout manager; only native pixel rounding is stubbed.
async function measurementCallback(
  entry: string,
  manager: ReturnType<typeof makeManager>['manager'],
  onLayout: () => void
) {
  const path = import.meta.resolve(`@shopify/flash-list/${entry}`);
  const source = ts.createSourceFile(
    path,
    await Bun.file(new URL(path)).text(),
    ts.ScriptTarget.Latest,
    true,
    entry.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.JS
  );
  function findCallback(node: ts.Node): ts.Expression | undefined {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === 'validateItemSize' &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      return node.initializer.arguments[0];
    }
    return ts.forEachChild(node, findCallback);
  }
  const callback = findCallback(source);
  if (!callback) throw new Error(`Missing FlashList measurement callback: ${entry}`);
  const { outputText } = ts.transpileModule(
    `const callback = ${callback.getText(source)};`,
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }
  );
  return new Function(
    'recyclerViewManager',
    'recyclerViewContext',
    'areDimensionsNotEqual',
    'measureLayout_1',
    `${outputText}\nreturn callback;`
  )(manager, { layout: onLayout }, areDimensionsNotEqual, {
    areDimensionsNotEqual,
  }) as (index: number, size: Size) => void;
}

for (const entry of [
  'src/recyclerview/RecyclerView.tsx',
  'dist/recyclerview/RecyclerView.js',
]) {
  for (const numColumns of [1, 3]) {
    describe(`${entry}, ${numColumns} columns`, () => {
      test('ignores a late size event after its item was removed', async () => {
        const { manager, props } = makeManager(numColumns);
        expect(manager.getLayout(25)).toBeDefined();
        const onLayout = mock(() => undefined);
        const callback = await measurementCallback(entry, manager, onLayout);
        manager.updateProps({ ...props, data: props.data.slice(0, 1) });
        manager.processDataUpdate();
        expect(() => manager.getLayout(25)).toThrow(
          'index out of bounds, not enough layouts'
        );
        expect(() => callback(25, { width: 400, height: 200 })).not.toThrow();
        expect(onLayout).not.toHaveBeenCalled();
      });

      test('ignores late events after all results disappear', async () => {
        const { manager, props } = makeManager(numColumns);
        const onLayout = mock(() => undefined);
        const callback = await measurementCallback(entry, manager, onLayout);
        manager.updateProps({ ...props, data: [] });
        manager.processDataUpdate();
        expect(() => callback(0, { width: 400, height: 200 })).not.toThrow();
        expect(onLayout).not.toHaveBeenCalled();
      });

      test('still requests layout for a valid cell whose size changed', async () => {
        const { manager } = makeManager(numColumns);
        const onLayout = mock(() => undefined);
        const callback = await measurementCallback(entry, manager, onLayout);
        const layout = manager.getLayout(0);
        callback(0, { width: layout.width, height: layout.height });
        expect(onLayout).not.toHaveBeenCalled();
        callback(0, { width: layout.width, height: layout.height + 20 });
        expect(onLayout).toHaveBeenCalledTimes(1);
      });

      test('resumes measurement after empty results grow again', async () => {
        const { manager, props } = makeManager(numColumns);
        const onLayout = mock(() => undefined);
        const callback = await measurementCallback(entry, manager, onLayout);
        manager.updateProps({ ...props, data: [] });
        manager.processDataUpdate();
        callback(25, { width: 100, height: 100 });
        expect(onLayout).not.toHaveBeenCalled();
        manager.updateProps(props);
        manager.processDataUpdate();
        const layout = manager.getLayout(25);
        callback(25, { width: layout.width, height: layout.height + 20 });
        expect(onLayout).toHaveBeenCalledTimes(1);
      });
    });
  }
}
