import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { CollectionEntry } from '@/services/collectionService';
import { fetchCardDetailsByVariant } from '@/lib/batchCardsIndex';
import {
  formatMarketTrend,
  pickVariantDisplayPrice,
  toPriceEurSummary,
} from '@/utils/variants';
import { collectionQueryKeys } from '@/src/api/queryKeys';

const INSIGHTS_STALE_MS = 5 * 60 * 1000;

export function collectionInsightsQueryKey(collection: CollectionEntry[]) {
  const variantNumbers = [
    ...new Set(collection.map((entry) => entry.variantNumber)),
  ].sort();
  return ['collection', 'insights', variantNumbers.join(',')] as const;
}

export async function computeCollectionInsights(collection: CollectionEntry[]) {
  const variantNumbers = [
    ...new Set(collection.map((entry) => entry.variantNumber)),
  ].sort();

  if (variantNumbers.length === 0) {
    return {
      estimatedValue: 0,
      movers: [] as { entry: CollectionEntry; trend: string }[],
    };
  }

  const detailByVariant = await fetchCardDetailsByVariant(variantNumbers);

  let estimatedValue = 0;
  const movers: { entry: CollectionEntry; trend: string; magnitude: number }[] = [];

  for (const entry of collection) {
    const card = detailByVariant.get(entry.variantNumber);
    if (!card) continue;
    const variant = card.variants.find((v) => v.variantNumber === entry.variantNumber);
    if (!variant) continue;

    const priceRow = pickVariantDisplayPrice(variant.prices, variant);
    const unit = priceRow?.market ?? 0;
    estimatedValue += unit * entry.quantity;

    const trend = formatMarketTrend(toPriceEurSummary(priceRow));
    if (trend.startsWith('+') || trend.startsWith('-')) {
      const magnitude = Math.abs(parseFloat(trend));
      movers.push({ entry, trend, magnitude });
    }
  }

  movers.sort((a, b) => b.magnitude - a.magnitude);

  return {
    estimatedValue,
    movers: movers.slice(0, 5).map(({ entry, trend }) => ({ entry, trend })),
  };
}

/** Warm collection dashboard insights from the already-cached collection list. */
export function prefetchCollectionInsights(queryClient: QueryClient): Promise<void> {
  const collection =
    queryClient.getQueryData<CollectionEntry[]>(collectionQueryKeys.all) ?? [];
  if (collection.length === 0) return Promise.resolve();

  return queryClient.prefetchQuery({
    queryKey: collectionInsightsQueryKey(collection),
    queryFn: () => computeCollectionInsights(collection),
    staleTime: INSIGHTS_STALE_MS,
  });
}

export function useCollectionInsights(collection: CollectionEntry[]) {
  return useQuery({
    queryKey: collectionInsightsQueryKey(collection),
    queryFn: () => computeCollectionInsights(collection),
    enabled: collection.length > 0,
    staleTime: INSIGHTS_STALE_MS,
  });
}
