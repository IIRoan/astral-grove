import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ScrollViewProps,
  type ViewProps,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { ListTopSpacer } from '@/components/ui/list-top-spacer';
import { Layout } from '@/constants/Layout';
import { screenGutterFor } from '@/lib/responsive-layout';
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

/** Screen gutters in px — one source for padding and pre-measure width estimates. */
function useScreenGutters(showRail: boolean) {
  const { width } = useWindowDimensions();
  const { left, right } = useSafeAreaInsets();
  return useMemo(() => {
    const gutter = screenGutterFor(width, showRail);
    return {
      paddingLeft: gutter + (showRail ? 0 : left),
      paddingRight: gutter + right,
    };
  }, [width, showRail, left, right]);
}

function useEstimatedContentWidth(showRail: boolean) {
  const { width } = useWindowDimensions();
  const { paddingLeft, paddingRight } = useScreenGutters(showRail);
  return useMemo(() => {
    const rail = showRail ? SIDE_RAIL_WIDTH : 0;
    // No artificial floor: a 320pt phone or Slide Over column must not be sized wider than itself.
    return Math.max(0, width - rail - paddingLeft - paddingRight);
  }, [width, showRail, paddingLeft, paddingRight]);
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
  const gutters = useScreenGutters(showRail);

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
      <View className={cn('flex-1 bg-background', className)} style={gutters}>
        <ListTopSpacer height={paddingTop} />
        <View className="min-h-0 w-full flex-1">{inner}</View>
      </View>
    );
  }

  return (
    // Keyboard-aware so focused fields (settings credentials, invites) scroll above the keyboard.
    <KeyboardAwareScrollView
      className={cn('flex-1 bg-background', className)}
      contentContainerStyle={[{ width: '100%' }, gutters]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={Layout.tabBarHeight}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      <ListTopSpacer height={paddingTop} />
      {inner}
      <ListBottomSpacer height={paddingBottom} />
    </KeyboardAwareScrollView>
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
