import { describe, expect, mock, test } from 'bun:test';

mock.module('react-native', () => ({
  Platform: { OS: 'ios' },
}));

mock.module('expo-asset', () => ({
  Asset: {
    fromModule: (source: number) => ({ uri: `bundled://${String(source)}` }),
  },
}));

mock.module('expo-image', () => ({
  Image: {
    prefetch: async () => true,
  },
}));

mock.module('@/constants/gameAssets', () => ({
  allFilterPanelIconSources: () => [101, 102, 103],
}));

const { collectFilterIconUris } = await import('@/lib/prefetchFilterIcons');

describe('collectFilterIconUris', () => {
  test('includes bundled filter panel icons', () => {
    const uris = collectFilterIconUris({ colors: [] });

    expect(uris).toEqual(['bundled://101', 'bundled://102', 'bundled://103']);
  });

  test('includes resolved upstream color image URLs from the filter snapshot', () => {
    const uris = collectFilterIconUris({
      colors: [
        {
          id: 'fury',
          name: 'Fury',
          count: 10,
          imageUrl: '/api/v1/images/colors/fury.webp',
        },
      ],
    });

    expect(uris.some((uri) => uri.endsWith('/api/v1/images/colors/fury.webp'))).toBe(
      true
    );
  });

  test('deduplicates URIs', () => {
    const uris = collectFilterIconUris({
      colors: [
        {
          id: 'fury',
          name: 'Fury',
          count: 10,
          imageUrl: '/api/v1/images/colors/fury.webp',
        },
        {
          id: 'fury-dup',
          name: 'Fury Alt',
          count: 1,
          imageUrl: '/api/v1/images/colors/fury.webp',
        },
      ],
    });

    const remoteMatches = uris.filter((uri) =>
      uri.endsWith('/api/v1/images/colors/fury.webp')
    );
    expect(remoteMatches).toHaveLength(1);
  });
});
