import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type { ViewToken } from '@shopify/flash-list';
import {
  catalogDrawDistance,
  catalogLookaheadCount,
  estimateCatalogRowHeight,
  measureCatalogScrollVelocity,
} from '@/lib/catalog-page-size';
import { prefetchCatalogArt } from '@/lib/imagePrefetch';
import { useLatestRef } from '@/hooks/useLatestRef';

type ArtItem = { imageUrl?: string | null };

type UseCatalogArtLookaheadOptions<T extends ArtItem> = {
  items: readonly T[];
  numColumns: number;
  layout?: 'grid' | 'list';
  tileWidth: number;
  compact?: boolean;
  /** Extra scroll handler (e.g. data pagination). Runs after art warm. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/** Prefetch thumbs ahead of viewport; pair with elevated `drawDistance` so cells mount warm. */
export function useCatalogArtLookahead<T extends ArtItem>({
  items,
  numColumns,
  layout = 'grid',
  tileWidth,
  compact = false,
  onScroll,
}: UseCatalogArtLookaheadOptions<T>) {
  const { height: windowHeight } = useWindowDimensions();
  const viewportHeight = useMemo(
    () => Math.max(320, windowHeight - 220),
    [windowHeight]
  );
  const drawDistance = useMemo(
    () => catalogDrawDistance(viewportHeight),
    [viewportHeight]
  );

  const itemsRef = useLatestRef(items);
  const onScrollRef = useLatestRef(onScroll);
  const lastScrollSampleRef = useRef({ y: 0, t: Date.now() });
  const lastWarmIndexRef = useRef(-1);
  const velocityYRef = useRef(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;
  const artWarmKey = `${items.length}:${items[0]?.imageUrl ?? ''}:${items.at(-1)?.imageUrl ?? ''}`;

  const warmFromIndex = useCallback(
    (startIndex: number, count: number) => {
      if (startIndex < 0 || count <= 0) return;
      const slice = itemsRef.current.slice(startIndex, startIndex + count);
      if (slice.length === 0) return;
      prefetchCatalogArt(slice, { limit: count, includeFull: true });
    },
    [itemsRef]
  );

  useEffect(() => {
    lastWarmIndexRef.current = -1;
    warmFromIndex(0, catalogLookaheadCount(layout, numColumns, 0));
  }, [artWarmKey, layout, numColumns, warmFromIndex]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<T>[] }) => {
      let maxIndex = -1;
      for (const entry of viewableItems) {
        if (typeof entry.index === 'number') {
          maxIndex = Math.max(maxIndex, entry.index);
        }
      }
      if (maxIndex < 0) return;
      const lookahead = catalogLookaheadCount(layout, numColumns, velocityYRef.current);
      warmFromIndex(maxIndex + 1, lookahead);
    },
    [layout, numColumns, warmFromIndex]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      const now = Date.now();
      const velocityY = measureCatalogScrollVelocity(
        lastScrollSampleRef.current,
        contentOffset.y,
        now
      );
      lastScrollSampleRef.current = { y: contentOffset.y, t: now };
      velocityYRef.current = velocityY;

      onScrollRef.current?.(event);

      if (velocityY <= 0) return;

      const rowHeight = estimateCatalogRowHeight(layout, tileWidth, compact);
      const firstRow = Math.max(
        0,
        Math.floor(contentOffset.y / Math.max(1, rowHeight))
      );
      const firstIndex = layout === 'list' ? firstRow : firstRow * numColumns;
      const visibleRows = Math.max(
        1,
        Math.ceil(layoutMeasurement.height / Math.max(1, rowHeight))
      );
      const visibleCount = layout === 'list' ? visibleRows : visibleRows * numColumns;
      const lookahead = catalogLookaheadCount(layout, numColumns, velocityY);
      const warmStart = firstIndex + visibleCount;

      if (Math.abs(warmStart - lastWarmIndexRef.current) < Math.max(1, numColumns)) {
        return;
      }
      lastWarmIndexRef.current = warmStart;
      warmFromIndex(warmStart, lookahead);
    },
    [compact, layout, numColumns, onScrollRef, tileWidth, warmFromIndex]
  );

  return {
    drawDistance,
    viewabilityConfig,
    handleViewableItemsChanged,
    handleScroll,
    viewportHeight,
  };
}
