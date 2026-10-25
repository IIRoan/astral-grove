import { describe, expect, mock, test } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Exercise FlashList's real render loop without loading native views in Bun.
mock.module('@shopify/flash-list/src/recyclerview/components/CompatView', () => ({
  CompatView: ({ children }: { children: ReactNode }) => children,
}));
mock.module('@shopify/flash-list/src/recyclerview/RecyclerViewContextProvider', () => ({
  useRecyclerViewContext: () => undefined,
}));
mock.module('@shopify/flash-list/src/recyclerview/ViewHolder', () => ({
  ViewHolder: ({ item }: { item: string }) => createElement('span', null, item),
}));

const { ViewHolderCollection } =
  await import('@shopify/flash-list/src/recyclerview/ViewHolderCollection');

function renderCells(data: string[], missingLayoutIndex = -1) {
  const reads: number[] = [];
  const html = renderToStaticMarkup(
    <ViewHolderCollection
      data={data}
      renderStack={
        new Map([
          ['first', { index: 0 }],
          ['second', { index: 1 }],
          ['recycled', { index: 25 }],
        ])
      }
      getLayout={(index) => {
        reads.push(index);
        if (index >= data.length) {
          throw new Error('index out of bounds, not enough layouts');
        }
        if (index === missingLayoutIndex) return undefined;
        return { x: 0, y: index * 200, width: 400, height: 200 };
      }}
      viewHolderCollectionRef={null}
      refHolder={new Map()}
      onSizeChanged={() => undefined}
      renderItem={() => null}
      extraData={null}
      getChildContainerLayout={() => ({ width: 400, height: 400 })}
      onCommitLayoutEffect={() => undefined}
      onCommitEffect={() => undefined}
      horizontal={false}
      getAdjustmentMargin={() => 0}
    />
  );
  return { html, reads };
}

describe('FlashList recycled cells after search results shrink', () => {
  test('skips removed indexes before reading their layouts', () => {
    const { html, reads } = renderCells(['Ahri', 'Jinx']);
    expect(html).toBe('<span>Ahri</span><span>Jinx</span>');
    expect(reads).toEqual([0, 1]);
  });

  test('skips a missing layout while the manager catches up with data', () => {
    const { html } = renderCells(['Ahri', 'Jinx'], 1);
    expect(html).toBe('<span>Ahri</span>');
  });

  test('renders no recycled cells for empty results', () => {
    expect(renderCells([])).toEqual({ html: '', reads: [] });
  });
});
