import { createHash } from 'node:crypto';

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function entityHash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function catalogFingerprint(total: number, filters: unknown): string {
  return entityHash({ total, filters });
}

export function pricesFingerprint(
  rows: {
    cardmarketId: number;
    isFoil: boolean;
    lastUpdated: string;
    marketPrice: string | null;
  }[]
): string {
  const tuples = rows
    .map(
      (r) =>
        `${String(r.cardmarketId)}:${String(r.isFoil)}:${r.lastUpdated}:${r.marketPrice ?? ''}`
    )
    .sort()
    .join('|');
  return createHash('sha256').update(tuples).digest('hex');
}
