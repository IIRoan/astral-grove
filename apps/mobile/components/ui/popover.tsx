import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type DimensionValue,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type LayoutRectangle,
  Platform,
  Pressable,
  type View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Uniwind } from 'uniwind';
import { useRelativePosition } from '@/hooks/use-relative-position';
import { cn, mergeRefs } from '@/lib/utils';
import { Portal, PortalOverlay } from './portal';
import { Slot } from './slot';

const ANIMATION_DURATION = 160;
const SWITCH_CONTENT_DURATION = 120;
const ANIMATION_EASING = Easing.out(Easing.quad);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type LayoutPosition = {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

type PopoverContextProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visibilityProgress: SharedValue<number>;
  switchKey?: string | null;
  triggerPosition?: LayoutPosition;
  setTriggerPosition: (position?: LayoutPosition) => void;
  contentLayout?: LayoutRectangle;
  setContentLayout: (position?: LayoutRectangle) => void;
};

type PopoverProps = Partial<PopoverContextProps> & {
  children: React.ReactNode;
  triggerPosition?: LayoutPosition;
  onTriggerPositionChange?: (position?: LayoutPosition) => void;
  /** Changes while open trigger a content crossfade + anchor slide (filter bar menus). */
  switchKey?: string | null;
};

type PopoverPortalProps = Partial<React.ComponentProps<typeof Portal>>;

type PopoverOverlayProps = {
  closeOnPress?: boolean;
  className?: string;
};

type PopoverContentProps = React.ComponentProps<typeof View> & {
  avoidCollisions?: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
  sideOffset?: number;
  align?: 'start' | 'center' | 'end';
  alignOffset?: number;
  width?: 'full' | 'fit' | 'auto' | 'trigger' | number | `${number}%`;
  disablePositioningStyle?: boolean;
};

type PopoverTriggerProps = React.ComponentPropsWithRef<typeof Pressable> & {
  asChild?: boolean;
};

type PopoverCloseProps = React.ComponentPropsWithRef<typeof Pressable> & {
  asChild?: boolean;
};

const PopoverContext = createContext<PopoverContextProps | null>(null);

export const usePopover = () => {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error('usePopover must be used within a Popover');
  }
  return context;
};

export const Popover = ({
  open: openProp,
  onOpenChange: onOpenChangeProp,
  triggerPosition: triggerPositionProp,
  onTriggerPositionChange,
  switchKey = null,
  children,
}: PopoverProps) => {
  const [internalOpen, setInternalOpen] = useState(openProp ?? false);
  const [contentLayout, setContentLayout] = useState<LayoutRectangle>();
  const [internalTriggerPosition, setInternalTriggerPosition] =
    useState<LayoutPosition>();

  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const isTriggerControlled = onTriggerPositionChange !== undefined;
  const triggerPosition = isTriggerControlled
    ? triggerPositionProp
    : internalTriggerPosition;

  const visibilityProgress = useSharedValue(open ? 1 : 0);

  const setTriggerPosition = useCallback(
    (position?: LayoutPosition) => {
      if (!isTriggerControlled) {
        setInternalTriggerPosition(position);
      }
      onTriggerPositionChange?.(position);
    },
    [isTriggerControlled, onTriggerPositionChange]
  );

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setContentLayout(undefined);
      }
      setInternalOpen(nextOpen);
      onOpenChangeProp?.(nextOpen);
    },
    [onOpenChangeProp]
  );

  useEffect(() => {
    visibilityProgress.value = withTiming(open ? 1 : 0, {
      duration: ANIMATION_DURATION,
      easing: ANIMATION_EASING,
    });
  }, [open, visibilityProgress]);

  const ctx = useMemo(
    () => ({
      open,
      onOpenChange,
      visibilityProgress,
      switchKey,
      contentLayout,
      setContentLayout,
      triggerPosition,
      setTriggerPosition,
    }),
    [
      open,
      switchKey,
      triggerPosition,
      contentLayout,
      visibilityProgress,
      onOpenChange,
      setTriggerPosition,
    ]
  );

  return <PopoverContext.Provider value={ctx}>{children}</PopoverContext.Provider>;
};

export const PopoverTrigger = ({
  asChild,
  onLayout: _onLayoutProp,
  ref: refProp,
  onPress: onPressProp,
  ...props
}: PopoverTriggerProps) => {
  const { onOpenChange, setTriggerPosition, open } = usePopover();
  const ref = useRef<React.ComponentRef<typeof Pressable>>(null);

  const mergedRefs = mergeRefs(ref, refProp);

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      onPressProp?.(e);

      ref.current?.measure((_x, _y, width, height, pageX, pageY) => {
        setTriggerPosition({
          pageX,
          pageY,
          width,
          height,
        });

        onOpenChange(!open);
      });
    },
    [onOpenChange, onPressProp, open, setTriggerPosition]
  );

  const Comp = asChild ? Slot.Pressable : Pressable;

  return <Comp {...props} onPress={handlePress} ref={mergedRefs} />;
};

export const PopoverClose = ({ asChild, ...props }: PopoverCloseProps) => {
  const { onOpenChange, setTriggerPosition } = usePopover();

  const Comp = asChild ? Slot.Pressable : Pressable;

  return (
    <Comp
      {...props}
      onPress={() => {
        onOpenChange(false);
        setTriggerPosition(undefined);
      }}
    />
  );
};

export const PopoverPortal = ({
  children,
  name = 'popover-portal',
  ...portalProps
}: PopoverPortalProps) => {
  const ctx = usePopover();

  if (!ctx.open) {
    return null;
  }

  return (
    <Portal name={name} {...portalProps}>
      <PopoverContext.Provider value={ctx}>
        <PortalOverlay>{children}</PortalOverlay>
      </PopoverContext.Provider>
    </Portal>
  );
};

export const PopoverOverlay = ({
  closeOnPress = true,
  className,
}: PopoverOverlayProps) => {
  const { onOpenChange, visibilityProgress } = usePopover();

  const isDark = Uniwind.currentTheme === 'dark';

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      visibilityProgress.value,
      [0, 1],
      [0, isDark ? 0.35 : 0.18],
      Extrapolation.CLAMP
    );

    return {
      opacity,
    };
  });

  return (
    <AnimatedPressable
      className={cn('absolute inset-0 z-40 bg-black', className)}
      disabled={!closeOnPress}
      onPress={() => onOpenChange(false)}
      style={animatedStyle}
    />
  );
};

export const PopoverContent = ({
  children,
  className,
  onLayout: onLayoutProp,
  style,
  width = 'fit',
  avoidCollisions = true,
  side = 'bottom',
  sideOffset = 8,
  align = 'start',
  alignOffset = 0,
  ...props
}: PopoverContentProps) => {
  const {
    open,
    visibilityProgress,
    switchKey,
    triggerPosition,
    setContentLayout,
    contentLayout,
  } = usePopover();

  const insets = useSafeAreaInsets();
  const anchorTop = useSharedValue(-9999);
  const anchorLeft = useSharedValue(-9999);
  const contentSwap = useSharedValue(1);
  const didAnchorInit = useRef(false);
  const previousSwitchKey = useRef<string | null>(null);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setContentLayout(event.nativeEvent.layout);
      onLayoutProp?.(event);
    },
    [setContentLayout, onLayoutProp]
  );

  const positionStyle = useRelativePosition({
    align,
    avoidCollisions,
    triggerPosition: triggerPosition ?? null,
    contentLayout: contentLayout ?? null,
    alignOffset,
    insets,
    side,
    sideOffset,
  });

  const resolvedTop =
    typeof positionStyle.top === 'number' ? positionStyle.top : undefined;
  const resolvedLeft =
    typeof positionStyle.left === 'number' ? positionStyle.left : undefined;

  useEffect(() => {
    if (!open) {
      didAnchorInit.current = false;
      return;
    }
    if (resolvedTop === undefined || resolvedLeft === undefined) return;

    if (!didAnchorInit.current) {
      anchorTop.value = resolvedTop;
      anchorLeft.value = resolvedLeft;
      didAnchorInit.current = true;
      return;
    }

    anchorTop.value = withTiming(resolvedTop, {
      duration: ANIMATION_DURATION,
      easing: ANIMATION_EASING,
    });
    anchorLeft.value = withTiming(resolvedLeft, {
      duration: ANIMATION_DURATION,
      easing: ANIMATION_EASING,
    });
  }, [resolvedTop, resolvedLeft, open, anchorTop, anchorLeft]);

  useEffect(() => {
    if (!open) {
      previousSwitchKey.current = null;
      contentSwap.value = 1;
      return;
    }

    if (
      previousSwitchKey.current !== null &&
      switchKey !== null &&
      previousSwitchKey.current !== switchKey
    ) {
      contentSwap.value = 0.45;
      contentSwap.value = withTiming(1, {
        duration: SWITCH_CONTENT_DURATION,
        easing: ANIMATION_EASING,
      });
    }

    previousSwitchKey.current = switchKey ?? null;
  }, [switchKey, open, contentSwap]);

  const animatedStyle = useAnimatedStyle(() => {
    const visibilityOpacity = interpolate(
      visibilityProgress.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );

    const scale = interpolate(
      visibilityProgress.value,
      [0, 1],
      [0.98, 1],
      Extrapolation.CLAMP
    );

    return {
      opacity: visibilityOpacity * contentSwap.value,
      transform: [{ scale }],
      top: anchorTop.value,
      left: anchorLeft.value,
    };
  });

  const widthStyle = useMemo(() => {
    const _widthStyle: ViewStyle = {};
    if (width === 'full') {
      _widthStyle.width = '100%';
    }
    if (typeof width === 'number' || width === 'auto' || width.endsWith('%')) {
      _widthStyle.width = width as DimensionValue;
    }
    if (width === 'trigger') {
      _widthStyle.width = triggerPosition?.width as DimensionValue;
    }
    return _widthStyle;
  }, [width, triggerPosition]);

  const staticPositionStyle = useMemo(() => {
    const { top: _top, left: _left, opacity: _opacity, ...rest } = positionStyle;
    return rest;
  }, [positionStyle]);

  const platformStyle = useMemo(
    () => (Platform.OS === 'web' ? ({ position: 'fixed' } as const) : null),
    []
  );

  if (!open) {
    return null;
  }

  if (!triggerPosition) {
    return null;
  }

  return (
    <Animated.View
      {...props}
      className={cn('z-50 rounded-lg bg-background p-4 shadow-lg', className)}
      onLayout={onLayout}
      style={[platformStyle, staticPositionStyle, widthStyle, animatedStyle, style]}
    >
      {children}
    </Animated.View>
  );
};
