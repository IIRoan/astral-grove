import { CDN_BASE_URL } from './s3.js';

function paSignedImageCandidates(variantNumber: string): string[] {
  const base = variantNumber.trim().replace(/\*$/, '');
  return [
    `${CDN_BASE_URL}/cards/${base}s.webp`,
    `${CDN_BASE_URL}/cards/${base}S.webp`,
    `${CDN_BASE_URL}/cards/${base}*.webp`,
  ];
}

async function paImageExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: 'image/*,*/*' },
    });
    if (!res.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    if (type.startsWith('image/')) return true;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 8) return false;
    const bytes = new Uint8Array(buf);
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return true;
    if (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** PA Overnumbered Signed art only; null if unpublished — keep parent Overnumbered imageUrl. */
export async function resolveSignedOvernumberedImageUrl(
  _cardName: string,
  signedVariantNumber: string
): Promise<string | null> {
  for (const url of paSignedImageCandidates(signedVariantNumber)) {
    if (await paImageExists(url)) return url;
  }
  return null;
}

export function isPiltoverArchiveImageUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'cdn.piltoverarchive.com' || host.endsWith('.piltoverarchive.com');
  } catch {
    return false;
  }
}
