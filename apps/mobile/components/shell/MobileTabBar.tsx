import {
  BookmarkIcon,
  CardsThreeIcon,
  CompassIcon,
  LayersIcon,
  LayoutGridIcon,
  SettingsIcon,
  type LucideIcon,
} from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Layout } from '@/constants/Layout';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MOTION, TAB_SCENE } from '@/lib/motion';
import { tabIdFromPathname, type AppTabId } from '@/lib/tab-route';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

type TabRoute = {
  key: string;
  name: string;
  params?: object;
};

export type MobileTabBarProps = {
  state: {
    index: number;
    routes: TabRoute[];
  };
  descriptors: Record<
    string,
    {
      options: { title?: string };
    }
  >;
  navigation: {
    emit: (event: {
      type: 'tabPress' | 'tabLongPress';
      target: string;
      canPreventDefault?: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const TAB_ITEMS: {
  routeName: AppTabId;
  label: string;
  icon: LucideIcon;
}[] = [
  { routeName: 'search', label: 'Cards', icon: LayoutGridIcon },
  { routeName: 'collection', label: 'Collection', icon: CardsThreeIcon },
  { routeName: 'wishlist', label: 'Wishlist', icon: BookmarkIcon },
  { routeName: 'decks', label: 'Decks', icon: LayersIcon },
  { routeName: 'play', label: 'Play', icon: CompassIcon },
  { routeName: 'settings', label: 'Settings', icon: SettingsIcon },
];

const INDICATOR_EASE = Easing.out(Easing.cubic);

function TabGlyph({
  focused,
  color,
  Icon,
  label,
}: {
  focused: boolean;
  color: string;
  Icon: LucideIcon;
  label: string;
}) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = focused ? 1 : 0;
      return;
    }
    progress.value = focused
      ? withSpring(1, MOTION.snappy)
      : withTiming(0, { duration: TAB_SCENE.durationMs, easing: INDICATOR_EASE });
  }, [focused, progress, reduceMotion]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.92, 1]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.72, 1]),
  }));

  return (
    <>
      <Animated.View style={iconStyle}>
        <Icon size={20} color={color} />
      </Animated.View>
      <Animated.View style={labelStyle}>
        <Text
          className={cn(
            'text-[10px] font-normal',
            focused ? 'text-foreground' : 'text-muted-foreground'
          )}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </>
  );
}

export function MobileTabBar({ state, descriptors, navigation }: MobileTabBarProps) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const tabBarWidth = Math.min(
    width - Layout.tabBarHorizontalInset * 2,
    Layout.tabBarMaxWidth
  );

  const [foregroundRaw, cardRaw, borderRaw, mutedForegroundRaw] = useCSSVariable([
    '--color-foreground',
    '--color-card',
    '--color-border',
    '--color-muted-foreground',
  ]);
  const foreground = String(foregroundRaw ?? '#f0f0f4');
  const card = String(cardRaw ?? '#15151e');
  const border = String(borderRaw ?? '#404059');
  const mutedForeground = String(mutedForegroundRaw ?? '#a6a6bf');

  const bottomOffset = Math.max(insets.bottom, Layout.tabBarBottomMargin);

  const visibleItems = TAB_ITEMS.filter((item) =>
    state.routes.some((route) => route.name === item.routeName)
  );
  // Pathname is the source of truth — state.index can lag during tab fade transitions.
  const activeRoute = tabIdFromPathname(pathname);
  const activeVisibleIndex = Math.max(
    0,
    visibleItems.findIndex((item) => item.routeName === activeRoute)
  );

  const indicatorX = useSharedValue(0);
  const segmentWidth = useSharedValue(0);
  const nextSegmentWidth =
    visibleItems.length > 0 ? tabBarWidth / visibleItems.length : 0;

  useEffect(() => {
    segmentWidth.value = nextSegmentWidth;
    const nextX = nextSegmentWidth * activeVisibleIndex;
    if (reduceMotion) {
      indicatorX.value = nextX;
      return;
    }
    indicatorX.value = withTiming(nextX, {
      duration: TAB_SCENE.durationMs,
      easing: INDICATOR_EASE,
    });
  }, [activeVisibleIndex, indicatorX, nextSegmentWidth, reduceMotion, segmentWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth.value,
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <View
      className="absolute left-0 right-0 items-center"
      style={{ bottom: bottomOffset }}
      pointerEvents="box-none"
    >
      <View
        accessibilityRole="tablist"
        className="relative flex-row items-stretch overflow-hidden rounded-[3px] border border-border bg-card"
        style={{
          width: tabBarWidth,
          height: Layout.tabBarHeight,
          marginHorizontal: (width - tabBarWidth) / 2,
          borderColor: border,
          backgroundColor: card,
        }}
      >
        {nextSegmentWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            className="absolute bottom-1 top-1 rounded-[3px] bg-card-panel"
            style={indicatorStyle}
          />
        ) : null}
        {visibleItems.map((item) => {
          const routeIndex = state.routes.findIndex(
            (route) => route.name === item.routeName
          );
          const route = state.routes[routeIndex]!;
          const isFocused = item.routeName === activeRoute;
          const { options } = descriptors[route.key]!;
          const label = options.title ?? item.label;

          const onPress = () => {
            void hapticPress();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const color = isFocused ? foreground : mutedForeground;
          const Icon = item.icon;

          return (
            <PressableScale
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={onLongPress}
              className="min-h-11 flex-1 items-center justify-center"
              contentClassName="items-center justify-center gap-0.5"
              depth={0.94}
            >
              <TabGlyph focused={isFocused} color={color} Icon={Icon} label={label} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
