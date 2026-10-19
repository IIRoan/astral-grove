import { ALLOWED_THUMB_WIDTHS } from '@riftbound/contracts';
import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl();
const LOCAL_API_DEFAULT = 'http://localhost:7000';
const API_IMAGES_PREFIX = '/api/v1/images/';
const CDN_HOST = 'cdn.piltoverarchive.com';

export type ResolveImageUrlOptions = {
  /** Request a cached derivative from GET /api/v1/images/*?w=… */
  width?: number;
};

// The API only resizes to these widths; anything else would silently return the full image.
function servedWidth(width: number | undefined): number | undefined {
  return width == null
    ? undefined
    : ALLOWED_THUMB_WIDTHS.find((served) => served >= width);
}

function isSafeImageKey(key: string): boolean {
  if (!key || key.includes('..')) return false;
  return key.startsWith('cards/') || key.startsWith('colors/');
}

function keyFromApiPath(pathname: string): string | null {
  if (!pathname.startsWith(API_IMAGES_PREFIX)) return null;
  const key = pathname.slice(API_IMAGES_PREFIX.length);
  return isSafeImageKey(key) ? key : null;
}

function keyFromCdnPath(pathname: string): string | null {
  const key = pathname.replace(/^\//, '');
  return isSafeImageKey(key) ? key : null;
}

function apiImageUrl(key: string, options?: ResolveImageUrlOptions): string {
  const base = `${API_URL}${API_IMAGES_PREFIX}${key}`;
  const width = options?.width;
  if (width != null && key.startsWith('cards/')) {
    return `${base}?w=${String(width)}`;
  }
  return base;
}

function appendWidthParam(url: string, width: number): string {
  if (!url.includes('cards/')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}w=${String(width)}`;
}

/** Normalize card image URLs to EXPO_PUBLIC_API_URL so clients load from the configured API. */
export function resolveImageUrl(
  url: string | null | undefined,
  options?: ResolveImageUrlOptions
): string {
  if (!url) return '';
  const width = servedWidth(options?.width);
  options = width == null ? undefined : { width };

  if (url.startsWith(API_IMAGES_PREFIX)) {
    const key = keyFromApiPath(url);
    return key ? apiImageUrl(key, options) : `${API_URL}${url}`;
  }

  try {
    const parsed = new URL(url);
    const apiKey = keyFromApiPath(parsed.pathname);
    if (apiKey) {
      if (API_URL === LOCAL_API_DEFAULT && parsed.hostname !== 'localhost') {
        return options?.width != null ? appendWidthParam(url, options.width) : url;
      }
      return apiImageUrl(apiKey, options);
    }

    if (parsed.hostname === CDN_HOST) {
      const cdnKey = keyFromCdnPath(parsed.pathname);
      if (cdnKey) return apiImageUrl(cdnKey, options);
    }
  } catch {
    // Fall through for non-URL strings.
  }

  return url;
}

/** Cached list-tile derivative — pair with full `resolveImageUrl` for progressive art. */
export function resolveThumbImageUrl(
  url: string | null | undefined,
  width: number
): string {
  return resolveImageUrl(url, { width });
}
