import {
  ALLOWED_THUMB_WIDTHS,
  parseAllowedThumbWidth,
  type AllowedThumbWidth,
} from '@riftbound/contracts';

export { ALLOWED_THUMB_WIDTHS, type AllowedThumbWidth };

export function parseThumbWidth(
  raw: string | null | undefined
): AllowedThumbWidth | undefined {
  return parseAllowedThumbWidth(raw);
}

export function thumbStorageKey(sourceKey: string, width: AllowedThumbWidth): string {
  return `thumbs/w${String(width)}/${sourceKey.replace(/^\//, '')}`;
}

export function canResizeKey(key: string): boolean {
  return key.replace(/^\//, '').startsWith('cards/');
}
