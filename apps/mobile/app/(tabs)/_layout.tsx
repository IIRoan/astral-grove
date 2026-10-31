import { usePathname } from 'expo-router';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';
import { AppShell } from '@/components/shell/AppShell';
import { MobileTabBar, type MobileTabBarProps } from '@/components/shell/MobileTabBar';
import { AuthGate } from '@/components/auth/AuthGate';
import { useShowSideRail } from '@/hooks/useBreakpoint';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { mobileTabBarVisible } from '@/lib/mobile-chrome';
import { TAB_SCENE } from '@/lib/motion';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  const pathname = usePathname();
  const showRail = useShowSideRail();
  const showTabBar = mobileTabBarVisible(pathname, showRail);
  const reduceMotion = useReduceMotion();
  const [backgroundRaw] = useCSSVariable(['--color-background']);
  const background = String(backgroundRaw ?? 'oklch(0.130 0 0)');

  return (
    <AuthGate>
      <AppShell>
        <View className="min-h-0 min-w-0 flex-1 bg-background">
          <Tabs
            // Avoid intermittent blank scenes with animated bottom tabs (RN Screens).
            detachInactiveScreens={false}
            tabBar={
              showTabBar
                ? (props) => (
                    <MobileTabBar {...(props as unknown as MobileTabBarProps)} />
                  )
                : () => null
            }
            screenOptions={{
              headerShown: false,
              animation: reduceMotion ? 'none' : 'fade',
              transitionSpec: {
                animation: 'timing',
                config: {
                  duration: TAB_SCENE.durationMs,
                  easing: TAB_SCENE.easing,
                },
              },
              sceneStyle: { backgroundColor: background, flex: 1 },
            }}
          >
            <Tabs.Screen name="index" options={{ href: null }} />
            <Tabs.Screen name="search" options={{ title: 'Cards' }} />
            <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
            <Tabs.Screen name="wishlist" options={{ title: 'Wishlist' }} />
            <Tabs.Screen name="decks" options={{ title: 'Decks' }} />
            <Tabs.Screen name="play" options={{ title: 'Play' }} />
            <Tabs.Screen name="fun" options={{ title: 'Fun' }} />
            <Tabs.Screen
              name="settings"
              options={{
                title: 'Settings',
                ...(showRail ? { href: null } : {}),
              }}
            />
          </Tabs>
        </View>
      </AppShell>
    </AuthGate>
  );
}
