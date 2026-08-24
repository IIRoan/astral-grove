import { useMemo } from 'react';
import { useScreenLayout } from '@/components/shell/ScreenLayout';
import { computeFillGrid, type FillGridOptions } from '@/utils/fillGridLayout';

export function useFillGridLayout({ minItemWidth, maxColumns, gap }: FillGridOptions) {
  const { contentWidth } = useScreenLayout();

  return useMemo(
    () => computeFillGrid(contentWidth, { minItemWidth, maxColumns, gap }),
    [contentWidth, minItemWidth, maxColumns, gap]
  );
}
