import type { LucideIcon } from '@/components/icons';
import { ThemedIcon } from '@/components/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Layout } from '@/constants/Layout';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

export const FLOATING_PILL_NAV_CLEARANCE = 64;

const PILL_MOTION_MS = 220;
const PILL_EASING = Easing.out(Easing.cubic);

export type PillNavItem<T extends string> = {
  id: T;
  label: string;
  accessibilityLabel?: string;
  icon: LucideIcon;
  badge?: string;
};

export type FloatingPillNavItem<T extends string> = PillNavItem<T>;

interface PillNavProps<T extends string> {
  items: readonly PillNavItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  fill?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
}

export function PillNav<T extends string>({
  items,
  value,
  onChange,
  className,
  fill = false,
  compact = false,
  iconOnly = false,
}: PillNavProps<T>) {
  const reduceMotion = useReduceMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const hasPositioned = useRef(false);
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === value)
  );
  const segmentCount = Math.max(items.length, 1);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (trackWidth <= 0) return;
    const width = trackWidth / segmentCount;
    const nextX = width * activeIndex;
    indicatorWidth.value = width;
    if (reduceMotion || !hasPositioned.current) {
      indicatorX.value = nextX;
      hasPositioned.current = true;
      return;
    }
    indicatorX.value = withTiming(nextX, {
      duration: PILL_MOTION_MS,
      easing: PILL_EASING,
    });
  }, [activeIndex, indicatorWidth, indicatorX, reduceMotion, segmentCount, trackWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  const compactIconSize = iconOnly ? 18 : 15;

  return (
    <View
      accessibilityRole="tablist"
      onLayout={onTrackLayout}
      className={cn(
        'relative flex-row items-stretch overflow-hidden border border-border bg-card',
        compact
          ? iconOnly
            ? 'h-9 rounded-[3px] p-0'
            : 'h-9 rounded-[3px] p-1'
          : 'rounded-[3px] p-1',
        fill && 'w-full',
        className
      )}
    >
      <Animated.View
        pointerEvents="none"
        className={cn(
          'absolute bg-card-panel',
          compact
            ? iconOnly
              ? 'top-0 bottom-0 rounded-none'
              : 'top-1 bottom-1 rounded-[3px]'
            : 'top-1 bottom-1 rounded-[3px]'
        )}
        style={indicatorStyle}
      />
      {items.map((item) => {
        const active = value === item.id;
        const iconColor = active ? 'foreground' : 'muted-foreground';
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.accessibilityLabel ?? item.label}
            className={cn(
              'z-10 items-center justify-center',
              compact
                ? iconOnly
                  ? cn('h-full aspect-square', fill ? 'min-w-0 flex-1' : 'shrink-0')
                  : cn(
                      'h-full min-w-0 flex-row items-center gap-1.5 rounded-[3px] px-3',
                      fill ? 'flex-1' : 'shrink-0'
                    )
                : cn(
                    'gap-0.5 rounded-[3px] px-4 py-2',
                    fill ? 'min-w-0 flex-1' : 'min-w-[5.5rem]'
                  )
            )}
            onPress={() => {
              if (active) return;
              hapticPress();
              onChange(item.id);
            }}
          >
            {compact && iconOnly ? (
              <ThemedIcon icon={item.icon} size={compactIconSize} color={iconColor} />
            ) : compact ? (
              <>
                <ThemedIcon icon={item.icon} size={compactIconSize} color={iconColor} />
                <Text
                  className={cn(
                    'text-[11px] font-normal leading-none',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  <Text
                    className={cn(
                      'font-mono text-[10px] font-normal leading-none tabular-nums',
                      active ? 'text-muted-foreground' : 'text-muted-foreground'
                    )}
                    numberOfLines={1}
                  >
                    {item.badge}
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <ThemedIcon icon={item.icon} size={18} color={iconColor} />
                <Text
                  className={cn(
                    'text-[10px] font-normal leading-none',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {item.badge ? (
                  <Text
                    className={cn(
                      'font-mono text-[9px] font-normal leading-none tabular-nums',
                      active ? 'text-muted-foreground' : 'text-muted-foreground'
                    )}
                    numberOfLines={1}
                  >
                    {item.badge}
                  </Text>
                ) : null}
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

interface FloatingPillNavProps<T extends string> {
  items: readonly PillNavItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function FloatingPillNav<T extends string>({
  items,
  value,
  onChange,
  className,
}: FloatingPillNavProps<T>) {
  const insets = useSafeAreaInsets();
  const showRail = useShowSideRail();

  const bottom = showRail
    ? Math.max(insets.bottom, 12) + 10
    : Layout.tabBarHeight +
      Layout.tabBarBottomMargin +
      Math.max(insets.bottom, Layout.tabBarBottomMargin) +
      8;

  return (
    <View
      className={cn('absolute left-0 right-0 z-20 items-center', className)}
      style={{ bottom }}
      pointerEvents="box-none"
    >
      <PillNav items={items} value={value} onChange={onChange} />
    </View>
  );
}
