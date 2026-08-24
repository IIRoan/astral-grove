/** Allowed ?w= values for /api/v1/images/* — keeps resize work bounded. */
export const ALLOWED_THUMB_WIDTHS = [96, 160, 240, 320] as const;

export type AllowedThumbWidth = (typeof ALLOWED_THUMB_WIDTHS)[number];

export function parseThumbWidth(
  raw: string | null | undefined
): AllowedThumbWidth | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return undefined;
  return (ALLOWED_THUMB_WIDTHS as readonly number[]).includes(parsed)
    ? (parsed as AllowedThumbWidth)
    : undefined;
}

export function thumbStorageKey(sourceKey: string, width: AllowedThumbWidth): string {
  return `thumbs/w${String(width)}/${sourceKey.replace(/^\//, '')}`;
}

export function canResizeKey(key: string): boolean {
  return key.replace(/^\//, '').startsWith('cards/');
}
