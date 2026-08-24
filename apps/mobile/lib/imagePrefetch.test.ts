import { describe, expect, mock, test } from 'bun:test';

const prefetch = mock(async () => true);
const getCachePathAsync = mock(async () => '/cache/img');
const resolveImageUrl = mock(
  (url: string | null | undefined, opts?: { width?: number }) => {
    if (!url) return '';
    return opts?.width != null ? `${url}?w=${opts.width}` : url;
  }
);

mock.module('expo-image', () => ({
  Image: { prefetch, getCachePathAsync },
}));

mock.module('@/utils/resolveImageUrl', () => ({
  resolveImageUrl,
}));

const markSessionImageLoaded = mock(() => undefined);
mock.module('@/lib/imageSessionCache', () => ({
  markSessionImageLoaded,
}));

const { prefetchImageUris, prefetchCatalogArt } = await import('@/lib/imagePrefetch');

describe('prefetchImageUris', () => {
  test('batches unique uris into expo-image disk prefetch', async () => {
    prefetch.mockClear();
    markSessionImageLoaded.mockClear();
    resolveImageUrl.mockImplementation((url: string | null | undefined) => url ?? '');

    await prefetchImageUris(
      ['https://a/1.webp', 'https://a/1.webp', 'https://a/2.webp', null],
      { limit: 10 }
    );

    expect(prefetch).toHaveBeenCalledWith(['https://a/1.webp', 'https://a/2.webp'], {
      cachePolicy: 'memory-disk',
    });
    expect(markSessionImageLoaded).toHaveBeenCalledTimes(2);
  });

  test('respects limit', async () => {
    prefetch.mockClear();
    resolveImageUrl.mockImplementation((url: string | null | undefined) => url ?? '');
    await prefetchImageUris(
      ['https://a/1.webp', 'https://a/2.webp', 'https://a/3.webp'],
      { limit: 2 }
    );
    expect(prefetch.mock.calls[0]?.[0]).toHaveLength(2);
  });
});

describe('prefetchCatalogArt', () => {
  test('warms thumb width first, then full when requested', async () => {
    prefetch.mockClear();
    resolveImageUrl.mockImplementation(
      (url: string | null | undefined, opts?: { width?: number }) => {
        if (!url) return '';
        return opts?.width != null ? `${url}?w=${opts.width}` : url;
      }
    );

    prefetchCatalogArt([{ imageUrl: 'https://a/1.webp' }], {
      limit: 4,
      includeFull: true,
    });

    await Promise.resolve();
    await Promise.resolve();

    const batches = prefetch.mock.calls.map((call) => call[0] as string[]);
    expect(batches.some((batch) => batch.includes('https://a/1.webp?w=160'))).toBe(
      true
    );
    expect(batches.some((batch) => batch.includes('https://a/1.webp'))).toBe(true);
  });
});
