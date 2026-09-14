import GorhomBottomSheet, {
  type BottomSheetBackgroundProps,
  type BottomSheetProps,
  BottomSheetView,
  BottomSheetScrollView as GorhomBottomSheetScrollView,
  useBottomSheetInternal,
} from '@gorhom/bottom-sheet';
import {
  Children,
  cloneElement,
  createContext,
  Fragment,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onSheetIndexChange } from '@/lib/bottom-sheet-lifecycle';
import {
  BackHandler,
  Keyboard,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { centeredSheetMargins } from '@/lib/responsive-layout';
import { SHEET_REDUCED, SHEET_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Portal, PortalOverlay } from './portal';

const BOTTOM_SHEET_PORTAL_NAME = 'bottom-sheet-portal';
const BOTTOM_SHEET_KEYBOARD_BEHAVIOR = 'extend' as const;
const SHEET_TOP_GAP = 16;
const KEYBOARD_SHOW_EVENT =
  Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const KEYBOARD_HIDE_EVENT =
  Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
const GORHOM_KEYBOARD_SHOWN = 1;
const BOTTOM_SHEET_HEADER_HEIGHT_FALLBACK = 57;
const BOTTOM_SHEET_SCROLL_CONTENT_TOP_PADDING = 16;
const BOTTOM_SHEET_FOOTER_BASE_PADDING = 16;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SnapPointInput = number | string;

type BottomSheetChildDisplayName =
  'BottomSheetFooter' | 'BottomSheetHeader' | 'BottomSheetScrollView';

type BottomSheetContentConfig = {
  snapPoints?: SnapPointInput[];
  defaultSnapIndex?: number;
  enablePanDownToClose?: boolean;
  enableOverDrag?: boolean;
  enableDynamicSizing?: boolean;
  enableContentPanningGesture?: boolean;
  /** Lower = freer downward drag (Gorhom default 2.5). */
  overDragResistanceFactor?: number;
  /** Pixels before pan activates — lower engages dismiss sooner. */
  activeOffsetY?: number;
  keyboardBehavior?: BottomSheetProps['keyboardBehavior'];
  detached?: boolean;
  bottomInset?: number;
};

type UniwindClassName = { className?: string };
type BottomSheetScrollViewProps = React.ComponentProps<
  typeof GorhomBottomSheetScrollView
> &
  UniwindClassName;
type BottomSheetViewProps = React.ComponentProps<typeof BottomSheetView> &
  UniwindClassName;

const SheetView = BottomSheetView as React.ComponentType<BottomSheetViewProps>;
const SheetScrollView =
  GorhomBottomSheetScrollView as React.ComponentType<BottomSheetScrollViewProps>;

type BottomSheetContextValue = {
  open: boolean;
  mounted: boolean;
  setMounted: (mounted: boolean) => void;
  onOpenChange: (open: boolean) => void;
  bottomSheetRef: React.RefObject<GorhomBottomSheet | null>;
  animatedIndex: SharedValue<number>;
  contentConfig: BottomSheetContentConfig;
  setContentConfig: (config: BottomSheetContentConfig) => void;
  currentSnapIndex: number;
  setCurrentSnapIndex: (index: number) => void;
  keyboardVisible: boolean;
};

/** Extra bottom padding for scroll bodies: home-indicator inset when no footer owns it. */
const SheetScrollSafeBottomContext = createContext(0);

type BottomSheetRootProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

type BottomSheetPortalProps = Partial<React.ComponentProps<typeof Portal>>;

type BottomSheetOverlayProps = {
  closeOnPress?: boolean;
  className?: string;
  /** Override max scrim opacity (0–1). Dark default ~0.75. */
  maxOpacity?: number;
};

type BottomSheetContentProps = Omit<React.ComponentProps<typeof View>, 'children'> &
  BottomSheetContentConfig & {
    children: React.ReactNode;
    backgroundClassName?: string;
    handleClassName?: string;
    /** Surface under the grabber when `handleDivider` is set. */
    handleSurfaceClassName?: string;
    /** When true, handle chrome includes a bottom hairline (drawer / no sticky header). */
    handleDivider?: boolean;
    onAnimate?: BottomSheetProps['onAnimate'];
  };

type BottomSheetStickyScrollContentProps = {
  body: React.ReactNode[];
  className?: string;
  header: React.ReactNode;
};

const BottomSheetStickyScrollContent = ({
  body,
  className,
  header,
}: BottomSheetStickyScrollContentProps) => {
  const [headerHeight, setHeaderHeight] = useState<number | null>(null);

  const onHeaderLayout = useCallback((event: LayoutChangeEvent) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  }, []);

  const headerInset = header
    ? (headerHeight ?? BOTTOM_SHEET_HEADER_HEIGHT_FALLBACK) +
      BOTTOM_SHEET_SCROLL_CONTENT_TOP_PADDING
    : 0;

  return (
    <View className={cn('absolute inset-0 flex flex-col bg-card-panel', className)}>
      {header ? (
        <View
          className="absolute inset-x-0 top-0 z-10 border-border border-b bg-card-panel"
          onLayout={onHeaderLayout}
        >
          {header}
        </View>
      ) : null}
      {body.map((child, index) => {
        if (
          isBottomSheetChild(child, 'BottomSheetScrollView') &&
          isValidElement(child)
        ) {
          const scrollChild = child as React.ReactElement<{
            headerInset?: number;
            style?: BottomSheetScrollViewProps['style'];
          }>;

          return cloneElement(scrollChild, {
            headerInset,
            key: scrollChild.key ?? `bottom-sheet-scroll-${index}`,
            style: StyleSheet.flatten([
              { flex: 1, minHeight: 0 },
              scrollChild.props.style,
            ]) as BottomSheetScrollViewProps['style'],
          });
        }

        return child;
      })}
    </View>
  );
};

const getMaxSnapPercent = (windowHeight: number, topInset: number) => {
  if (windowHeight <= 0) {
    return 100;
  }

  return Math.floor(((windowHeight - topInset) / windowHeight) * 100);
};

const normalizeSnapPoints = (
  snapPoints: SnapPointInput[] | undefined,
  maxSnapPercent: number
): (string | number)[] | undefined => {
  if (!snapPoints?.length) {
    return;
  }

  return snapPoints.map((point) => {
    if (typeof point === 'string') {
      if (point.endsWith('%')) {
        const parsed = Number.parseFloat(point);
        if (!Number.isNaN(parsed)) {
          return `${Math.min(Math.round(parsed), maxSnapPercent)}%`;
        }
      }

      return point;
    }

    if (point > 0 && point <= 1) {
      return `${Math.min(Math.round(point * 100), maxSnapPercent)}%`;
    }

    return point;
  });
};

const resolveDefaultSnapIndex = (
  snapPoints: SnapPointInput[] | undefined,
  defaultSnapIndex?: number
) => {
  if (defaultSnapIndex !== undefined) {
    return defaultSnapIndex;
  }

  return snapPoints?.length ? snapPoints.length - 1 : 0;
};

const getBottomSheetChildDisplayName = (child: React.ReactNode) => {
  if (!isValidElement(child)) {
    return;
  }

  return (child.type as { displayName?: string }).displayName;
};

const isBottomSheetChild = (
  child: React.ReactNode,
  displayName: BottomSheetChildDisplayName
) => getBottomSheetChildDisplayName(child) === displayName;

const flattenBottomSheetChildren = (children: React.ReactNode): React.ReactNode[] => {
  const flattened: React.ReactNode[] = [];

  Children.forEach(children, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') {
      return;
    }

    if (isValidElement(child) && child.type === Fragment) {
      flattened.push(
        ...flattenBottomSheetChildren(
          (child.props as { children?: React.ReactNode }).children
        )
      );
      return;
    }

    flattened.push(child);
  });

  return flattened;
};

const splitBottomSheetChildren = (children: React.ReactNode) => {
  const body: React.ReactNode[] = [];
  let footer: React.ReactNode = null;
  let header: React.ReactNode = null;
  let hasScrollView = false;

  for (const child of flattenBottomSheetChildren(children)) {
    const displayName = getBottomSheetChildDisplayName(child);

    if (displayName === 'BottomSheetFooter') {
      footer = child;
      continue;
    }

    if (displayName === 'BottomSheetHeader') {
      header = child;
      continue;
    }

    if (displayName === 'BottomSheetScrollView') {
      hasScrollView = true;
    }

    body.push(child);
  }

  return { body, footer, header, hasScrollView };
};

const getOverlayOpacityRange = (isDark: boolean) => {
  const maxOpacity = isDark ? 0.75 : 0.5;
  return { maxOpacity, minOpacity: maxOpacity * 0.35 };
};

type BottomSheetAnimatedFooterProps = {
  animatedFooterPosition: SharedValue<number>;
  children: React.ReactNode;
};

const BottomSheetAnimatedFooter = ({
  animatedFooterPosition,
  children,
}: BottomSheetAnimatedFooterProps) => {
  const { animatedKeyboardState, animatedLayoutState } = useBottomSheetInternal();
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const keyboard = animatedKeyboardState.get();
    let footerTranslateY = animatedFooterPosition.get();

    if (keyboard.status === GORHOM_KEYBOARD_SHOWN) {
      footerTranslateY += keyboard.heightWithinContainer;
    }

    footerTranslateY += keyboardHeight.value;

    return {
      transform: [{ translateY: Math.max(0, footerTranslateY) }],
    };
  }, [animatedFooterPosition, animatedKeyboardState, keyboardHeight]);

  const handleContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;

      animatedLayoutState.modify((state) => {
        'worklet';
        state.footerHeight = height;
        return state;
      });
    },
    [animatedLayoutState]
  );

  return (
    <Animated.View
      className="absolute top-0 right-0 left-0 z-9999"
      onLayout={handleContainerLayout}
      pointerEvents="box-none"
      style={containerAnimatedStyle}
    >
      {children}
    </Animated.View>
  );
};

const BottomSheetHandleIndicator = ({
  className,
  divider = false,
  surfaceClassName,
}: {
  className?: string;
  divider?: boolean;
  surfaceClassName?: string;
}) => (
  <View
    className={cn(
      'items-center bg-card-panel pt-2.5',
      divider ? 'border-b border-border pb-3' : 'pb-1',
      surfaceClassName
    )}
  >
    <View className={cn('h-1.5 w-12 rounded-full bg-muted-foreground/60', className)} />
  </View>
);

const BottomSheetBackground = ({
  className,
  style,
  ...props
}: BottomSheetBackgroundProps & { className?: string }) => (
  <View
    className={cn(
      'overflow-hidden rounded-t-[20px] border-t border-border bg-card-panel',
      className
    )}
    style={style}
    {...props}
  />
);

const renderNullBackdrop = () => null;

const BottomSheetContext = createContext<BottomSheetContextValue | null>(null);

const useBottomSheetContext = () => {
  const context = useContext(BottomSheetContext);
  if (!context) {
    throw new Error('useBottomSheet must be used within a BottomSheet');
  }
  return context;
};

export const BottomSheet = ({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  children,
}: BottomSheetRootProps) => {
  const [internalOpen, setInternalOpen] = useState(openProp ?? false);
  const [mounted, setMounted] = useState(openProp ?? false);
  const [contentConfig, setContentConfig] = useState<BottomSheetContentConfig>({});
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const bottomSheetRef = useRef<GorhomBottomSheet>(null);
  const animatedIndex = useSharedValue(-1);

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onOpenChangeProp?.(nextOpen);
    },
    [isControlled, onOpenChangeProp]
  );

  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    // Unmount immediately when closed — delayed portal ate catalog taps (selected-but-no-drawer).
    bottomSheetRef.current?.close();
    setMounted(false);
  }, [open]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(KEYBOARD_SHOW_EVENT, () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener(KEYBOARD_HIDE_EVENT, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const ctx = useMemo(
    (): BottomSheetContextValue => ({
      open,
      mounted,
      setMounted,
      onOpenChange,
      bottomSheetRef,
      animatedIndex,
      contentConfig,
      setContentConfig,
      currentSnapIndex,
      setCurrentSnapIndex,
      keyboardVisible,
    }),
    [
      open,
      mounted,
      onOpenChange,
      animatedIndex,
      contentConfig,
      currentSnapIndex,
      keyboardVisible,
    ]
  );

  return (
    <BottomSheetContext.Provider value={ctx}>{children}</BottomSheetContext.Provider>
  );
};

export const BottomSheetPortal = ({
  children,
  name = BOTTOM_SHEET_PORTAL_NAME,
  ...portalProps
}: BottomSheetPortalProps) => {
  const ctx = useBottomSheetContext();

  if (!ctx.mounted) {
    return null;
  }

  // Stop hit-testing when open clears at dismiss-start so catalog taps aren’t blocked.
  return (
    <Portal name={name} {...portalProps}>
      <BottomSheetContext.Provider value={ctx}>
        <PortalOverlay>
          <View
            pointerEvents={ctx.open ? 'box-none' : 'none'}
            style={StyleSheet.absoluteFill}
            // Web: absolute overlay can still capture clicks after open=false.
            {...(Platform.OS === 'web' && !ctx.open
              ? ({ tabIndex: -1, 'aria-hidden': true } as const)
              : null)}
          >
            {children}
          </View>
        </PortalOverlay>
      </BottomSheetContext.Provider>
    </Portal>
  );
};

export const BottomSheetOverlay = ({
  closeOnPress = true,
  className,
  maxOpacity: maxOpacityProp,
}: BottomSheetOverlayProps) => {
  const { open, onOpenChange, animatedIndex, contentConfig, keyboardVisible } =
    useBottomSheetContext();

  const defaults = getOverlayOpacityRange(Uniwind.currentTheme === 'dark');
  const maxOpacity = maxOpacityProp ?? defaults.maxOpacity;
  const minOpacity = maxOpacity * 0.35;
  const maxSnapIndex = Math.max(0, (contentConfig.snapPoints?.length ?? 1) - 1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0, maxSnapIndex],
      [0, minOpacity, maxOpacity],
      Extrapolation.CLAMP
    ),
  }));

  const handlePress = useCallback(() => {
    if (keyboardVisible) {
      Keyboard.dismiss();
      return;
    }

    // Parent `open=false` unmounts the portal immediately — don't wait on close().
    onOpenChange(false);
  }, [keyboardVisible, onOpenChange]);

  return (
    <AnimatedPressable
      className={cn('absolute inset-0 bg-black', className)}
      disabled={!closeOnPress || !open}
      pointerEvents={open ? 'auto' : 'none'}
      onPress={handlePress}
      style={animatedStyle}
    />
  );
};

export const BottomSheetContent = ({
  children,
  className,
  snapPoints: snapPointsProp,
  defaultSnapIndex: defaultSnapIndexProp,
  enablePanDownToClose = true,
  enableOverDrag = true,
  enableDynamicSizing: enableDynamicSizingProp,
  enableContentPanningGesture = true,
  overDragResistanceFactor,
  activeOffsetY,
  keyboardBehavior = BOTTOM_SHEET_KEYBOARD_BEHAVIOR,
  detached,
  bottomInset,
  backgroundClassName,
  handleClassName,
  handleSurfaceClassName,
  handleDivider = false,
  onAnimate,
}: BottomSheetContentProps) => {
  const {
    open,
    onOpenChange,
    bottomSheetRef,
    animatedIndex,
    setContentConfig,
    setCurrentSnapIndex,
  } = useBottomSheetContext();

  const reduceMotion = useReduceMotion();
  const animationConfigs = reduceMotion ? SHEET_REDUCED : SHEET_SPRING;

  const { top, bottom, left, right } = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  // Center + cap width on iPad / wide web; always clear landscape side insets.
  const sheetSideMargins = useMemo(
    () => centeredSheetMargins(windowWidth, { left, right }),
    [windowWidth, left, right]
  );

  const topInset = top + SHEET_TOP_GAP;
  const maxDynamicContentSize = windowHeight - topInset;
  const maxSnapPercent = getMaxSnapPercent(windowHeight, topInset);

  const contentConfig = useMemo(
    (): BottomSheetContentConfig => ({
      snapPoints: snapPointsProp,
      defaultSnapIndex: defaultSnapIndexProp,
      enablePanDownToClose,
      enableOverDrag,
      enableDynamicSizing: enableDynamicSizingProp,
      enableContentPanningGesture,
      overDragResistanceFactor,
      activeOffsetY,
      keyboardBehavior,
      detached,
      bottomInset,
    }),
    [
      snapPointsProp,
      defaultSnapIndexProp,
      enablePanDownToClose,
      enableOverDrag,
      enableDynamicSizingProp,
      enableContentPanningGesture,
      overDragResistanceFactor,
      activeOffsetY,
      keyboardBehavior,
      detached,
      bottomInset,
    ]
  );

  useEffect(() => {
    setContentConfig(contentConfig);
  }, [contentConfig, setContentConfig]);

  const normalizedSnapPoints = useMemo(
    () => normalizeSnapPoints(snapPointsProp, maxSnapPercent),
    [snapPointsProp, maxSnapPercent]
  );

  const snapPointCount = normalizedSnapPoints?.length ?? 0;
  const hasSnapPoints = snapPointCount > 0;
  const enableDynamicSizing = enableDynamicSizingProp ?? !hasSnapPoints;

  const defaultSnapIndex = Math.min(
    resolveDefaultSnapIndex(snapPointsProp, defaultSnapIndexProp),
    Math.max(0, snapPointCount - 1)
  );

  const sheetIndex = open ? (enableDynamicSizing ? 0 : defaultSnapIndex) : -1;

  const { body, footer, header, hasScrollView } = useMemo(
    () => splitBottomSheetChildren(children),
    [children]
  );

  const handleSheetChange = useCallback(
    (index: number) => {
      setCurrentSnapIndex(index);
      onSheetIndexChange(index, () => onOpenChange(false));
    },
    [onOpenChange, setCurrentSnapIndex]
  );

  useEffect(() => {
    // BackHandler is Android-only; react-native-web logs an error when it is used.
    if (!(open && enablePanDownToClose) || Platform.OS === 'web') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      bottomSheetRef.current?.close();
      onOpenChange(false);
      return true;
    });

    return () => subscription.remove();
  }, [open, enablePanDownToClose, onOpenChange, bottomSheetRef]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (enableDynamicSizing) {
        bottomSheetRef.current?.expand();
        return;
      }
      bottomSheetRef.current?.snapToIndex(defaultSnapIndex);
    });

    return () => cancelAnimationFrame(frame);
  }, [open, bottomSheetRef, enableDynamicSizing, defaultSnapIndex]);

  const footerComponent = useCallback(
    (footerProps: { animatedFooterPosition: SharedValue<number> }) => (
      <BottomSheetAnimatedFooter
        animatedFooterPosition={footerProps.animatedFooterPosition}
      >
        {footer}
      </BottomSheetAnimatedFooter>
    ),
    [footer]
  );

  const handleComponent = useCallback(
    () => (
      <BottomSheetHandleIndicator
        className={handleClassName}
        divider={handleDivider}
        surfaceClassName={handleSurfaceClassName}
      />
    ),
    [handleClassName, handleDivider, handleSurfaceClassName]
  );

  const backgroundComponent = useCallback(
    (props: BottomSheetBackgroundProps) => (
      <BottomSheetBackground {...props} className={backgroundClassName} />
    ),
    [backgroundClassName]
  );

  // Sticky absolute wrapper only for overlay headers; bare scroll stays a direct Gorhom child.
  const sheetContent = hasScrollView ? (
    header ? (
      <BottomSheetStickyScrollContent
        body={body}
        className={className}
        header={header}
      />
    ) : (
      <>{body}</>
    )
  ) : (
    <SheetView
      className={cn('bg-card-panel', className)}
      enableFooterMarginAdjustment
      style={{ paddingBottom: footer ? 0 : bottom }}
    >
      {header}
      {body}
    </SheetView>
  );

  return (
    <GorhomBottomSheet
      animatedIndex={animatedIndex}
      animationConfigs={animationConfigs}
      animateOnMount
      backdropComponent={renderNullBackdrop}
      backgroundComponent={backgroundComponent}
      bottomInset={bottomInset ?? 0}
      detached={detached}
      enableContentPanningGesture={enableContentPanningGesture}
      enableDynamicSizing={enableDynamicSizing}
      enableOverDrag={enableOverDrag && !reduceMotion}
      enablePanDownToClose={enablePanDownToClose}
      footerComponent={footer ? footerComponent : undefined}
      handleComponent={handleComponent}
      index={sheetIndex}
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior="restore"
      maxDynamicContentSize={maxDynamicContentSize}
      onAnimate={onAnimate}
      onChange={handleSheetChange}
      overDragResistanceFactor={overDragResistanceFactor}
      activeOffsetY={activeOffsetY}
      ref={bottomSheetRef}
      snapPoints={normalizedSnapPoints}
      style={sheetSideMargins}
      topInset={topInset}
    >
      <SheetScrollSafeBottomContext.Provider value={footer ? 0 : bottom}>
        {sheetContent}
      </SheetScrollSafeBottomContext.Provider>
    </GorhomBottomSheet>
  );
};

export const BottomSheetScrollView = ({
  className,
  contentContainerClassName: _contentContainerClassName,
  contentContainerStyle,
  headerInset = 0,
  style,
  ...props
}: BottomSheetScrollViewProps & {
  contentContainerClassName?: string;
  headerInset?: number;
}) => {
  const safeBottom = useContext(SheetScrollSafeBottomContext);

  return (
    <SheetScrollView
      className={cn('min-h-0 flex-1', className)}
      contentContainerStyle={
        StyleSheet.flatten([
          { paddingHorizontal: 16, paddingBottom: 16 + safeBottom },
          headerInset > 0 ? { paddingTop: headerInset } : null,
          contentContainerStyle,
        ]) as BottomSheetScrollViewProps['contentContainerStyle']
      }
      enableFooterMarginAdjustment
      style={StyleSheet.flatten(style) as BottomSheetScrollViewProps['style']}
      {...props}
    />
  );
};

BottomSheetScrollView.displayName = 'BottomSheetScrollView';

export const BottomSheetBody = ({
  className,
  ...props
}: React.ComponentProps<typeof View>) => (
  <View className={cn('px-4', className)} {...props} />
);

export const BottomSheetHeader = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof View>) => (
  <View
    className={cn('flex flex-row items-center gap-2 bg-card-panel p-4', className)}
    {...props}
  >
    <View className="min-w-0 flex-1">{children}</View>
  </View>
);

BottomSheetHeader.displayName = 'BottomSheetHeader';

export const BottomSheetTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof Text>) => (
  <Text
    className={cn('font-semibold text-foreground text-xl leading-tight', className)}
    {...props}
  />
);

export const BottomSheetFooter = ({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<typeof View>) => {
  const { bottom } = useSafeAreaInsets();
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();
  const closedBottomPadding = Math.max(bottom, BOTTOM_SHEET_FOOTER_BASE_PADDING);

  const animatedStyle = useAnimatedStyle(
    () => ({
      paddingBottom: interpolate(
        keyboardProgress.value,
        [0, 1],
        [closedBottomPadding, BOTTOM_SHEET_FOOTER_BASE_PADDING],
        Extrapolation.CLAMP
      ),
    }),
    [closedBottomPadding]
  );

  return (
    <Animated.View
      className={cn(
        'flex w-full flex-col gap-2 border-border border-t bg-card-panel px-4 pt-4',
        className
      )}
      style={style}
      {...props}
    >
      {/* Safe-area on inner wrapper so `pb-*` on className cannot bury Done under the home indicator. */}
      <Animated.View className="w-full" style={animatedStyle}>
        {children}
      </Animated.View>
    </Animated.View>
  );
};

BottomSheetFooter.displayName = 'BottomSheetFooter';
