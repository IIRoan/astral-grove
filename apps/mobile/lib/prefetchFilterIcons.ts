import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import type { FilterSnapshot } from '@riftbound/contracts';
import type { ImageSourcePropType } from 'react-native';
import { allFilterPanelIconSources } from '@/constants/gameAssets';
import { markSessionImageLoaded } from '@/lib/imageSessionCache';
import { resolveImageUrl } from '@/utils/resolveImageUrl';

function bundledAssetUri(source: ImageSourcePropType): string | null {
  if (typeof source === 'number') {
    return Asset.fromModule(source).uri;
  }
  if (
    typeof source === 'object' &&
    source &&
    'uri' in source &&
    typeof source.uri === 'string'
  ) {
    return source.uri;
  }
  return null;
}

/** URIs for every icon shown in catalog filter panels. */
export function collectFilterIconUris(
  snapshot: Pick<FilterSnapshot, 'colors'>
): string[] {
  const uris = new Set<string>();

  for (const source of allFilterPanelIconSources()) {
    const uri = bundledAssetUri(source);
    if (uri) uris.add(uri);
  }

  for (const color of snapshot.colors) {
    if (!color.imageUrl) continue;
    const uri = resolveImageUrl(color.imageUrl);
    if (uri) uris.add(uri);
  }

  return [...uris];
}

async function prefetchIconUri(uri: string): Promise<void> {
  const ok = await Image.prefetch(uri, { cachePolicy: 'memory-disk' });
  if (ok) markSessionImageLoaded(uri);
}

/** Warm expo-image cache for filter panel icons (bundled + upstream color art). */
export function prefetchFilterIcons(snapshot: Pick<FilterSnapshot, 'colors'>): void {
  const uris = collectFilterIconUris(snapshot);
  if (uris.length === 0) return;

  void Promise.allSettled(uris.map((uri) => prefetchIconUri(uri)));
}
