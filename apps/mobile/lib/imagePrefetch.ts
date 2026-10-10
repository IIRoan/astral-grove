import { Image } from 'expo-image';
import { markSessionImageLoaded } from '@/lib/imageSessionCache';
import { CATALOG_ART_THUMB_WIDTH } from '@/constants/CardArt';
import { resolveImageUrl } from '@/utils/resolveImageUrl';

const DEFAULT_BATCH = 48;
const inFlightUris = new Set<string>();

function normalizePrefetchUri(
  raw: string | null | undefined,
  width?: number
): string | null {
  if (!raw) return null;
  const resolved = resolveImageUrl(raw, width != null ? { width } : undefined);
  if (resolved) return resolved;
  if (raw.startsWith('http') || raw.startsWith('file:') || raw.startsWith('asset:')) {
    return raw;
  }
  return null;
}

/** Warm expo-image disk+memory cache for remote/resolved URIs. */
export async function prefetchImageUris(
  uris: Array<string | null | undefined>,
  options?: { limit?: number; width?: number }
): Promise<void> {
  const limit = options?.limit ?? DEFAULT_BATCH;
  const width = options?.width;
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const raw of uris) {
    const uri = normalizePrefetchUri(raw, width);
    if (!uri || seen.has(uri) || inFlightUris.has(uri)) continue;
    seen.add(uri);
    unique.push(uri);
    if (unique.length >= limit) break;
  }

  if (unique.length === 0) return;
  for (const uri of unique) inFlightUris.add(uri);

  try {
    const ok = await Image.prefetch(unique, { cachePolicy: 'memory-disk' });
    if (ok) {
      for (const uri of unique) markSessionImageLoaded(uri);
      return;
    }
    await Promise.allSettled(
      unique.map(async (uri) => {
        const path = await Image.getCachePathAsync(uri).catch(() => null);
        if (path) markSessionImageLoaded(uri);
      })
    );
  } catch {
    // Prefetch is best-effort; screens still load images on demand.
  } finally {
    for (const uri of unique) inFlightUris.delete(uri);
  }
}

/** Prefetch like CardArtImage: ?w=thumb first, then optional full URI. */
export function prefetchCatalogArt(
  items: Array<{ imageUrl?: string | null }>,
  options?: { limit?: number; includeFull?: boolean }
): void {
  const limit = options?.limit ?? DEFAULT_BATCH;
  const uris = items.map((item) => item.imageUrl);
  void prefetchImageUris(uris, { limit, width: CATALOG_ART_THUMB_WIDTH });
  if (options?.includeFull) {
    void prefetchImageUris(uris, { limit });
  }
}
