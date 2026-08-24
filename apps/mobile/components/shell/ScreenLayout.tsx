import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { ListTopSpacer } from '@/components/ui/list-top-spacer';
import { Layout } from '@/constants/Layout';
import {
  CATALOG_DETAIL_GAP,
  SIDE_RAIL_WIDTH,
  useShowSideRail,
} from '@/hooks/useBreakpoint';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { cn } from '@/lib/utils';

type ScreenLayoutContextValue = {
  contentWidth: number;
  measuredWidth: number | null;
  showRail: boolean;
  paddingTop: number;
  paddingBottom: number;
  paddingBottomInline: number;
};

const ScreenLayoutContext = createContext<ScreenLayoutContextValue | null>(null);

const SplitMainContext = createContext<number | null>(null);

function useEstimatedContentWidth(showRail: boolean) {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const pad = showRail
      ? Layout.screenPaddingHorizontalRail * 2
      : Layout.screenPaddingHorizontal * 2;
    const rail = showRail ? SIDE_RAIL_WIDTH : 0;
    return Math.max(320, width - rail - pad);
  }, [width, showRail]);
}

function useMeasureContentWidth() {
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const showRail = useShowSideRail();
  const estimatedWidth = useEstimatedContentWidth(showRail);

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0) {
      setMeasuredWidth((prev) => (prev === next ? prev : next));
    }
  }, []);

  const contentWidth =
    measuredWidth != null && measuredWidth > 0 ? measuredWidth : estimatedWidth;

  return { contentWidth, measuredWidth, onContentLayout };
}

function ScreenLayoutProvider({
  value,
  children,
}: {
  value: ScreenLayoutContextValue;
  children: React.ReactNode;
}) {
  return (
    <ScreenLayoutContext.Provider value={value}>
      {children}
    </ScreenLayoutContext.Provider>
  );
}

export function useScreenLayout() {
  const context = useContext(ScreenLayoutContext);
  if (!context) {
    throw new Error('useScreenLayout must be used within ScreenLayout');
  }
  return context;
}

type ScreenLayoutProps = {
  mode?: 'scroll' | 'flex';
  children: React.ReactNode;
  className?: string;
  scrollProps?: Omit<ScrollViewProps, 'children'>;
  contentClassName?: string;
};

export function ScreenLayout({
  mode = 'scroll',
  children,
  className,
  scrollProps,
  contentClassName,
}: ScreenLayoutProps) {
  const { paddingTop, paddingBottom, paddingBottomCompact, showRail } =
    useScreenInsets();
  const { contentWidth, measuredWidth, onContentLayout } = useMeasureContentWidth();

  const contextValue = useMemo(
    () => ({
      contentWidth,
      measuredWidth,
      showRail,
      paddingTop,
      paddingBottom,
      paddingBottomInline: paddingBottomCompact,
    }),
    [
      contentWidth,
      measuredWidth,
      showRail,
      paddingTop,
      paddingBottom,
      paddingBottomCompact,
    ]
  );

  const inner = (
    <View
      className={cn(
        'w-full',
        // Flex screens must stretch so children can center (e.g. page loaders).
        mode === 'flex' && 'min-h-0 flex-1',
        contentClassName
      )}
      onLayout={onContentLayout}
    >
      <ScreenLayoutProvider value={contextValue}>{children}</ScreenLayoutProvider>
    </View>
  );

  if (mode === 'flex') {
    return (
      <View
        className={cn(
          'flex-1 bg-background',
          showRail ? 'px-4' : 'px-4 sm:px-6',
          className
        )}
      >
        <ListTopSpacer height={paddingTop} />
        <View className="min-h-0 w-full flex-1">{inner}</View>
      </View>
    );
  }

  return (
    <ScrollView
      className={cn('flex-1 bg-background', className)}
      contentContainerClassName={showRail ? 'px-4' : 'px-4 sm:px-6'}
      contentContainerStyle={{ width: '100%' }}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      <ListTopSpacer height={paddingTop} />
      {inner}
      <ListBottomSpacer height={paddingBottom} />
    </ScrollView>
  );
}

type ScreenSplitProps = {
  children: React.ReactNode;
  aside?: React.ReactNode;
  asideWidth: number;
  gap?: number;
  className?: string;
  onMainWidthChange?: (width: number) => void;
};

export function ScreenSplit({
  children,
  aside,
  asideWidth,
  gap = CATALOG_DETAIL_GAP,
  className,
  onMainWidthChange,
}: ScreenSplitProps) {
  const [mainWidth, setMainWidth] = useState<number | null>(null);

  const onMainLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = Math.round(event.nativeEvent.layout.width);
      if (next > 0) {
        setMainWidth((prev) => (prev === next ? prev : next));
        onMainWidthChange?.(next);
      }
    },
    [onMainWidthChange]
  );

  return (
    <View className={cn('w-full flex-1 flex-row', className)} style={{ gap }}>
      <View className="min-h-0 min-w-0 flex-1 flex-col" onLayout={onMainLayout}>
        <SplitMainContext.Provider value={mainWidth}>
          {children}
        </SplitMainContext.Provider>
      </View>
      {aside ? (
        <View
          style={{ width: asideWidth }}
          className="min-h-0 h-full shrink-0 overflow-hidden"
        >
          {aside}
        </View>
      ) : null}
    </View>
  );
}

type ScreenLayoutBodyProps = ViewProps & {
  children: React.ReactNode;
};

export function ScreenLayoutBody({
  children,
  className,
  ...props
}: ScreenLayoutBodyProps) {
  return (
    <View className={cn('min-h-0 w-full flex-1', className)} {...props}>
      {children}
    </View>
  );
}
