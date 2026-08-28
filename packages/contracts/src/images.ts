import { z } from 'zod';

export const ALLOWED_THUMB_WIDTHS = [96, 160, 240, 320] as const;
export type AllowedThumbWidth = (typeof ALLOWED_THUMB_WIDTHS)[number];

function isAllowedThumbWidth(value: number): value is AllowedThumbWidth {
  return (ALLOWED_THUMB_WIDTHS as readonly number[]).includes(value);
}

export function parseAllowedThumbWidth(
  raw: string | number | null | undefined
): AllowedThumbWidth | undefined {
  if (raw == null || raw === '') return undefined;
  const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || !isAllowedThumbWidth(parsed)) return undefined;
  return parsed;
}

export const ImageThumbQuery = z.object({
  w: z
    .union([z.string(), z.number()])
    .optional()
    .transform((raw) => parseAllowedThumbWidth(raw)),
});

export type ImageThumbQuery = z.infer<typeof ImageThumbQuery>;
