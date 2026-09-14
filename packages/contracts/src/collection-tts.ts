import { z } from 'zod';
import { CardCondition } from './collection.js';
import {
  aggregateImportItems,
  type CollectionImportItem,
} from './collection-csv.js';

/** PA TTS tokens are `SET-NUMBER-ART` with 1 = base, 2 = a, 3 = b. */
const TTS_TOKEN = /^([A-Za-z]+)-((?:R|SP)?\d+)-([123])$/i;

const ART_INDEX_TO_SUFFIX: Record<string, string> = {
  '1': '',
  '2': 'a',
  '3': 'b',
};

export type CollectionTtsTokenError = {
  token: string;
  message: string;
};

/** Convert a PA TTS token to a deck-code card code (`OGN-166-2` → `OGN-166a`). */
export function fromTtsCardToken(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const match = trimmed.match(TTS_TOKEN);
  if (!match) return null;
  const set = match[1]!.toUpperCase();
  const number = match[2]!;
  const suffix = ART_INDEX_TO_SUFFIX[match[3]!] ?? '';
  return `${set}-${number}${suffix}`;
}

export function splitCollectionTtsTokens(text: string): string[] {
  return text
    .trim()
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function parseCollectionTtsToImportItems(text: string): {
  items: CollectionImportItem[];
  errors: CollectionTtsTokenError[];
  totalTokens: number;
  totalCopies: number;
  uniquePrintings: number;
} {
  const tokens = splitCollectionTtsTokens(text);
  const items: CollectionImportItem[] = [];
  const errors: CollectionTtsTokenError[] = [];

  for (const token of tokens) {
    const variantNumber = fromTtsCardToken(token);
    if (!variantNumber) {
      errors.push({ token, message: `Invalid TTS token: ${token}` });
      continue;
    }
    items.push({
      variantNumber,
      quantity: 1,
      condition: 'near_mint' as CardCondition,
      language: 'en',
    });
  }

  const aggregated = aggregateImportItems(items);
  const totalCopies = aggregated.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: aggregated,
    errors,
    totalTokens: tokens.length,
    totalCopies,
    uniquePrintings: aggregated.length,
  };
}

export const CollectionImportPreviewStatus = z.enum([
  'new',
  'increase',
  'decrease',
  'unchanged',
]);

export type CollectionImportPreviewStatus = z.infer<
  typeof CollectionImportPreviewStatus
>;

export const CollectionImportPreviewChange = z.object({
  variantNumber: z.string().min(1),
  name: z.string().nullable(),
  setCode: z.string().nullable(),
  imageUrl: z.string().nullable(),
  quantityBefore: z.number().int().nonnegative(),
  quantityAfter: z.number().int().nonnegative(),
  quantityDelta: z.number().int(),
  status: CollectionImportPreviewStatus,
});

export type CollectionImportPreviewChange = z.infer<
  typeof CollectionImportPreviewChange
>;

export const CollectionImportPreviewItem = z.object({
  variantNumber: z.string().min(1),
  quantity: z.number().int().positive(),
  condition: CardCondition.default('near_mint'),
  language: z.string().max(16).default('en'),
  isFoil: z.boolean().optional(),
});

export type CollectionImportPreviewItem = z.infer<typeof CollectionImportPreviewItem>;

export const CollectionImportPreviewRequest = z.object({
  tts: z.string().min(1).max(512_000),
});

export type CollectionImportPreviewRequest = z.infer<
  typeof CollectionImportPreviewRequest
>;

export const CollectionImportPreviewResponse = z.object({
  data: z.object({
    totalTokens: z.number().int().nonnegative(),
    totalCopies: z.number().int().nonnegative(),
    uniquePrintings: z.number().int().nonnegative(),
    unresolvedCount: z.number().int().nonnegative(),
    newCount: z.number().int().nonnegative(),
    increasedCount: z.number().int().nonnegative(),
    decreasedCount: z.number().int().nonnegative(),
    unchangedCount: z.number().int().nonnegative(),
    changes: z.array(CollectionImportPreviewChange),
    unresolved: z.array(
      z.object({
        token: z.string(),
        message: z.string(),
      })
    ),
    items: z.array(CollectionImportPreviewItem).max(2000),
  }),
});

export type CollectionImportPreviewResponse = z.infer<
  typeof CollectionImportPreviewResponse
>;

export function collectionImportPreviewStatus(
  quantityBefore: number,
  quantityAfter: number
): CollectionImportPreviewStatus {
  if (quantityBefore === 0 && quantityAfter > 0) return 'new';
  if (quantityAfter > quantityBefore) return 'increase';
  if (quantityAfter < quantityBefore) return 'decrease';
  return 'unchanged';
}
