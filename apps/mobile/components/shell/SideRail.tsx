import {
  BookmarkIcon,
  CardsThreeIcon,
  CompassIcon,
  LayersIcon,
  LayoutGridIcon,
  LogOutIcon,
  type LucideIcon,
} from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { HoverTooltip } from '@/components/ui/hover-tooltip';
import { Text } from '@/components/ui/text';
import { UserBlobatar } from '@/components/ui/user-blobatar';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import { runeIcon } from '@/constants/gameAssets';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { TAB_SCENE } from '@/lib/motion';
import { tabIdFromPathname, type AppTabId } from '@/lib/tab-route';
import { cn } from '@/lib/utils';
import { authClient } from '@/src/lib/auth-client';
import { useQueryClient } from '@tanstack/react-query';
import { removeUserDataQueries } from '@/src/api/queryClient';
import { clearPersistedQueryClient } from '@/src/api/queryPersist';
import { clearPersistedCollection } from '@/services/collectionCacheService';
import { clearPersistedOwnedDecks } from '@/services/deckCacheService';
import { clearPersistedWishlist } from '@/services/wishlistCacheService';
import { clearPersistedCatalogIndex } from '@/services/catalogIndexService';
import { clearLastCachedUserId } from '@/services/userCacheScope';
import { hapticPress } from '@/utils/haptics';
import { Image } from 'expo-image';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavId = Exclude<AppTabId, 'settings'>;

const NAV_ITEMS: {
  id: NavId;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: 'search',
    href: '/(tabs)/search',
    label: 'Cards',
    description: 'Browse and search the card catalog',
    icon: LayoutGridIcon,
  },
  {
    id: 'collection',
    href: '/(tabs)/collection',
    label: 'Collection',
    description: 'View and update cards you own',
    icon: CardsThreeIcon,
  },
  {
    id: 'wishlist',
    href: '/(tabs)/wishlist',
    label: 'Wishlist',
    description: 'Track cards you want and price changes',
    icon: BookmarkIcon,
  },
  {
    id: 'decks',
    href: '/(tabs)/decks',
    label: 'Decks',
    description: 'Build decks and browse community lists',
    icon: LayersIcon,
  },
  {
    id: 'play',
    href: '/(tabs)/play',
    label: 'Play',
    description: 'Table scoreboard for victory points and XP',
    icon: CompassIcon,
  },
];

/** size-9 (36) + gap-0.5 (2) — deterministic so HoverTooltip wrappers cannot skew measure. */
const RAIL_ITEM_STRIDE = 38;
const RAIL_ITEM_HEIGHT = 36;
const INDICATOR_EASE = Easing.out(Easing.cubic);

export function SideRail() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const active = tabIdFromPathname(pathname);
  const sessionQuery = authClient.useSession();
  const { data: session } = sessionQuery;
  const queryClient = useQueryClient();
  const reduceMotion = useReduceMotion();

  const activeNavIndex = NAV_ITEMS.findIndex((item) => item.id === active);
  const showNavIndicator = activeNavIndex >= 0;

  const hasPositioned = useRef(false);
  const indicatorY = useSharedValue(0);

  useEffect(() => {
    if (!showNavIndicator) return;
    const nextY = activeNavIndex * RAIL_ITEM_STRIDE;
    if (reduceMotion || !hasPositioned.current) {
      indicatorY.value = nextY;
      hasPositioned.current = true;
      return;
    }
    indicatorY.value = withTiming(nextY, {
      duration: TAB_SCENE.durationMs,
      easing: INDICATOR_EASE,
    });
  }, [activeNavIndex, indicatorY, reduceMotion, showNavIndicator]);

  const indicatorStyle = useAnimatedStyle(() => ({
    height: RAIL_ITEM_HEIGHT,
    transform: [{ translateY: indicatorY.value }],
  }));

  const handleSignOut = async () => {
    await authClient.signOut();
    await sessionQuery.refetch();
    await clearPersistedCollection();
    await clearPersistedOwnedDecks();
    await clearPersistedWishlist();
    await clearPersistedCatalogIndex();
    await clearPersistedQueryClient();
    await clearLastCachedUserId();
    removeUserDataQueries(queryClient);
  };

  const userName = session?.user?.name ?? '';
  const userId = session?.user?.id;

  return (
    <View
      className="shrink-0 self-stretch items-end py-3 pl-4 pr-0"
      style={{ paddingTop: insets.top + 12 }}
    >
      <View
        className={cn(
          'h-full w-12 items-center gap-1 overflow-visible border border-border bg-card py-3',
          FACTORY_RADIUS_CONTROL_CLASS
        )}
      >
        <HoverTooltip label="Home" description="Open the card catalog" side="right">
          <PressableScale
            accessibilityLabel="The Astral Grove home"
            className={cn(
              'mb-2 size-8 items-center justify-center border border-border bg-card-panel',
              FACTORY_RADIUS_CONTROL_CLASS
            )}
            contentClassName="items-center justify-center"
            onPress={() => {
              void hapticPress();
              router.push('/(tabs)/search');
            }}
          >
            <Image
              source={runeIcon}
              style={{ width: 20, height: 20 }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          </PressableScale>
        </HoverTooltip>

        <View className="h-px w-6 bg-border" />

        <View className="relative mt-1 gap-0.5" accessibilityRole="tablist">
          {showNavIndicator ? (
            <Animated.View
              pointerEvents="none"
              className={cn(
                'absolute top-0 left-0 right-0 bg-card-panel',
                FACTORY_RADIUS_CONTROL_CLASS
              )}
              style={indicatorStyle}
            />
          ) : null}
          {NAV_ITEMS.map(({ id, href, label, description, icon: Icon }) => {
            const isActive = active === id;
            return (
              <HoverTooltip
                key={id}
                label={label}
                description={description}
                side="right"
              >
                <PressableScale
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${label}. ${description}`}
                  onPress={() => {
                    void hapticPress();
                    router.push(href as '/(tabs)/search');
                  }}
                  className={cn(
                    'size-9 items-center justify-center',
                    FACTORY_RADIUS_CONTROL_CLASS
                  )}
                  contentClassName="items-center justify-center"
                  depth={0.92}
                >
                  <Icon
                    className={cn(
                      'size-4',
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  />
                </PressableScale>
              </HoverTooltip>
            );
          })}
        </View>

        <View className="flex-1" />

        <View className="gap-0.5">
          <HoverTooltip
            label="Settings"
            description="Account, appearance, and app preferences"
            side="right"
          >
            <PressableScale
              accessibilityLabel={`Account: ${userName}. Open settings`}
              className={cn(
                'size-9 items-center justify-center overflow-hidden',
                FACTORY_RADIUS_CONTROL_CLASS,
                active === 'settings' && 'border border-border'
              )}
              contentClassName="items-center justify-center"
              onPress={() => {
                void hapticPress();
                router.push('/(tabs)/settings');
              }}
            >
              {userId ? (
                <UserBlobatar userId={userId} title={userName || 'Account'} size={36} />
              ) : (
                <Text className="font-mono text-xs font-normal text-muted-foreground">
                  ?
                </Text>
              )}
            </PressableScale>
          </HoverTooltip>
          <HoverTooltip
            label="Sign out"
            description="Sign out of The Astral Grove"
            side="right"
          >
            <PressableScale
              accessibilityLabel="Sign out"
              className={cn(
                'size-9 items-center justify-center',
                FACTORY_RADIUS_CONTROL_CLASS
              )}
              contentClassName="items-center justify-center"
              onPress={() => {
                void hapticPress();
                void handleSignOut();
              }}
            >
              <LogOutIcon className="size-4 text-muted-foreground" />
            </PressableScale>
          </HoverTooltip>
        </View>
      </View>
    </View>
  );
}
