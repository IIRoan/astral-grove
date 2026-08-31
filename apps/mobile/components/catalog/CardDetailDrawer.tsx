import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
} from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import GorhomBottomSheet, {
  BottomSheetScrollView as GorhomBottomSheetScrollView,
  type BottomSheetBackgroundProps,
} from '@gorhom/bottom-sheet';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal, PortalOverlay } from '@/components/ui/portal';
import { useTheme } from '@/context/ThemeContext';
import { useLatestRef } from '@/hooks/useLatestRef';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { isSheetHostCapturingTaps } from '@/lib/bottom-sheet-lifecycle';
import {
  isSheetDismissSuppressed,
  SHEET_CLOSE_FALLBACK_MS,
  shouldIgnoreSpuriousSheetDismiss,
} from '@/lib/sheet-dismiss-guard';
import { logDrawer, watchDrawerOpen } from '@/lib/drawer-debug';
import { OVERLAY, SHEET_REDUCED, SHEET_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

interface CardDetailDrawerProps {
  open?: boolean;
  onClose: () => void;
  onDismissed?: () => void;
  children: React.ReactNode;
}

export const CARD_DETAIL_SHEET_RADIUS = 20;
export const CARD_DETAIL_SNAP_RATIO = 0.94;

/** Activate vertical pan after a short drag — easier grab, not early dismiss. */
const PAN_ACTIVE_OFFSET_Y = Platform.OS === 'web' ? 3 : 4;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const BottomSheetScrollView = GorhomBottomSheetScrollView as ComponentType<
  ComponentProps<typeof GorhomBottomSheetScrollView> & { className?: string }
>;

/** Two-phase dismiss: clear selection at close-start for hit-testing; keep host for Gorhom close animation. */
export function CardDetailDrawer({
  open,
  onClose,
  onDismissed,
  children,
}: CardDetailDrawerProps) {
  const isControlled = open !== undefined;
  const isOpen = open ?? true;
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const dismissingRef = useRef(false);
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const onCloseRef = useLatestRef(onClose);
  const onDismissedRef = useLatestRef(onDismissed);
  const portalId = useId();
  const animatedIndex = useSharedValue(-1);
  const [sheetIndex, setSheetIndex] = useState(isOpen ? 0 : -1);
  const sheetIndexRef = useLatestRef(sheetIndex);
  const capturingTaps = isSheetHostCapturingTaps({ open: isOpen, sheetIndex });
  const wasOpenRef = useRef(isOpen);
  const source = isControlled ? 'catalog-session' : 'card-route';

  const liveDebug = useCallback(
    () => ({
      portalId,
      platform: Platform.OS,
      isOpen,
      isControlled,
      sheetIndex,
      capturingTaps,
      source,
      dismissing: dismissingRef.current,
    }),
    [capturingTaps, isControlled, isOpen, portalId, sheetIndex]
  );

  const snapPoints = useMemo(
    () => [`${Math.round(CARD_DETAIL_SNAP_RATIO * 100)}%`],
    []
  );
  const paddingBottom = Math.max(insets.bottom, 16) + 32;
  const topInset = Math.max(insets.top, 12) + 16;
  const sheetSurface = isDark ? 'bg-card-panel' : 'bg-card';
  const backdropOpacity = isDark ? OVERLAY.backdropCard : OVERLAY.backdropLight;
  const animationConfigs = reduceMotion ? SHEET_REDUCED : SHEET_SPRING;

  const commitDismiss = useCallback(
    (reason: string) => {
      logDrawer('sheet.dismiss.commit', {
        reason,
        alreadyDismissing: dismissingRef.current,
        ...liveDebug(),
      });
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      onCloseRef.current();
    },
    [liveDebug, onCloseRef]
  );

  const commitDismissRef = useLatestRef(commitDismiss);

  const restoreAfterSpuriousClose = useCallback(
    (reason: string): boolean => {
      if (
        !shouldIgnoreSpuriousSheetDismiss({
          suppressed: isSheetDismissSuppressed(),
          alreadyDismissing: dismissingRef.current,
        })
      ) {
        return false;
      }
      logDrawer('sheet.dismiss.ignored', { reason, ...liveDebug() });
      sheetRef.current?.snapToIndex(0);
      return true;
    },
    [liveDebug]
  );

  useEffect(() => {
    logDrawer('sheet.mount', {
      portalId,
      platform: Platform.OS,
      isControlled,
      source,
    });
    return () => {
      logDrawer('sheet.unmount', {
        portalId,
        platform: Platform.OS,
        dismissing: dismissingRef.current,
      });
    };
  }, [isControlled, portalId, source]);

  useEffect(() => {
    logDrawer('sheet.interactive', {
      pointerEvents: capturingTaps ? 'box-none' : 'none',
      backdropPointerEvents: capturingTaps ? 'auto' : 'none',
      ...liveDebug(),
    });
  }, [capturingTaps, liveDebug]);

  useEffect(() => {
    if (!isOpen) return;
    return watchDrawerOpen({ watch: 'sheet' }, liveDebug);
  }, [isOpen, liveDebug]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (!wasOpenRef.current) return;
    logDrawer('sheet.open.false', {
      portalId,
      platform: Platform.OS,
      dismissing: dismissingRef.current,
    });
    logDrawer('sheet.force-close', {
      portalId,
      platform: Platform.OS,
    });
    sheetRef.current?.close();
    const timeout = setTimeout(() => {
      logDrawer('sheet.close.timeout', {
        portalId,
        platform: Platform.OS,
        sheetIndex: sheetIndexRef.current,
      });
      if (sheetIndexRef.current < 0) return;
      onDismissedRef.current?.();
    }, SHEET_CLOSE_FALLBACK_MS);
    return () => clearTimeout(timeout);
  }, [isOpen, onDismissedRef, portalId, sheetIndexRef]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      commitDismissRef.current('hardware-back');
      return true;
    });
    return () => subscription.remove();
  }, [commitDismissRef, isOpen]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      animatedIndex.value,
      [-1, 0],
      [0, backdropOpacity],
      Extrapolation.CLAMP
    ),
  }));

  const handleSheetClosed = useCallback(() => {
    logDrawer('sheet.gorhom.close', liveDebug());
    if (restoreAfterSpuriousClose('gorhom-onClose')) return;
    commitDismiss('gorhom-onClose');
    logDrawer('sheet.dismissed.callback', {
      hasOnDismissed: onDismissed != null,
      ...liveDebug(),
    });
    onDismissedRef.current?.();
  }, [commitDismiss, liveDebug, onDismissed, onDismissedRef, restoreAfterSpuriousClose]);

  const renderBackground = useCallback(
    (props: BottomSheetBackgroundProps) => (
      <View
        {...props}
        className={cn('border-t border-border', sheetSurface)}
        style={[
          props.style,
          {
            borderTopLeftRadius: CARD_DETAIL_SHEET_RADIUS,
            borderTopRightRadius: CARD_DETAIL_SHEET_RADIUS,
          },
        ]}
      />
    ),
    [sheetSurface]
  );

  const renderHandle = useCallback(
    () => (
      <View
        className={cn(
          'items-center justify-center border-b border-border',
          sheetSurface
        )}
        style={{ paddingTop: 12, paddingBottom: 14 }}
      >
        <View
          className={cn(
            'h-1.5 w-14 rounded-[3px]',
            isDark ? 'bg-foreground/45' : 'bg-muted-foreground/70'
          )}
        />
      </View>
    ),
    [isDark, sheetSurface]
  );

  const sheet = (
    <View className="flex-1" style={{ height: windowHeight }} pointerEvents="box-none">
      <AnimatedPressable
        accessibilityLabel="Close card detail"
        accessibilityRole="button"
        className="absolute inset-0 bg-black"
        disabled={!capturingTaps}
        onPress={() => {
          if (
            shouldIgnoreSpuriousSheetDismiss({
              suppressed: isSheetDismissSuppressed(),
              alreadyDismissing: dismissingRef.current,
            })
          ) {
            logDrawer('sheet.backdrop.ignored', liveDebug());
            return;
          }
          commitDismiss('backdrop');
        }}
        pointerEvents={capturingTaps ? 'auto' : 'none'}
        style={backdropStyle}
      />
      <GorhomBottomSheet
        ref={sheetRef}
        index={isControlled ? (isOpen ? 0 : -1) : 0}
        snapPoints={snapPoints}
        topInset={topInset}
        animatedIndex={animatedIndex}
        enablePanDownToClose
        enableOverDrag={!reduceMotion}
        enableContentPanningGesture
        enableDynamicSizing={false}
        animateOnMount
        animationConfigs={animationConfigs}
        overDragResistanceFactor={0.7}
        activeOffsetY={PAN_ACTIVE_OFFSET_Y}
        backgroundComponent={renderBackground}
        handleComponent={renderHandle}
        onAnimate={(fromIndex, toIndex) => {
          logDrawer('sheet.animate', {
            fromIndex,
            toIndex,
            closingToHidden: toIndex === -1,
            ...liveDebug(),
          });
          if (toIndex !== -1) return;
          if (restoreAfterSpuriousClose('gorhom-onAnimate')) return;
          commitDismiss('gorhom-onAnimate');
        }}
        onChange={(index) => {
          logDrawer('sheet.change', { index, ...liveDebug() });
          setSheetIndex(index);
        }}
        onClose={handleSheetClosed}
      >
        <BottomSheetScrollView
          className={cn('min-h-0 flex-1', sheetSurface)}
          contentContainerStyle={{
            paddingHorizontal: 0,
            paddingBottom,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={!reduceMotion}
        >
          {children}
        </BottomSheetScrollView>
      </GorhomBottomSheet>
    </View>
  );

  return (
    <Portal name={`card-detail-drawer-${portalId}`}>
      <PortalOverlay>
        <View
          accessibilityViewIsModal={capturingTaps}
          className={
            Platform.OS === 'web' ? 'fixed inset-0 z-[200]' : 'absolute inset-0'
          }
          pointerEvents={capturingTaps ? 'box-none' : 'none'}
        >
          {sheet}
        </View>
      </PortalOverlay>
    </Portal>
  );
}
