import '../global.css';
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavThemeProvider,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { AppBootstrap } from '@/components/AppBootstrap';
import { TetraProvider } from '@/components/TetraProvider';
import { AppUpdateScreen } from '@/components/settings/AppUpdateScreen';
import { AppLoadingScreen } from '@/components/ui/app-loader';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { AppUpdateProvider } from '@/hooks/useAppUpdate';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { useAppFonts } from '@/hooks/useAppFonts';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { initSentry, Sentry } from '@/lib/sentry';
import { createQueryClient } from '@/src/api/queryClient';
import {
  createQueryPersister,
  QUERY_PERSIST_MAX_AGE_MS,
  shouldPersistQuery,
} from '@/src/api/queryPersist';
import { hydrateSecureStorage } from '@/src/lib/secure-storage';

initSentry();
SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = createQueryClient();
const queryPersister = createQueryPersister();

function RootNav() {
  const { actualTheme } = useTheme();
  const fontsLoaded = useAppFonts();
  const reduceMotion = useReduceMotion();
  const { isLocalReady } = useAppBootstrap();
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await hydrateSecureStorage();
      } finally {
        if (mounted) {
          setStorageReady(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const bootReady = fontsLoaded && storageReady && isLocalReady;

  useEffect(() => {
    if (bootReady) {
      void SplashScreen.hideAsync();
    }
  }, [bootReady]);

  useEffect(() => {
    if (!bootReady || Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('sentry_test') !== '1') {
      return;
    }
    Sentry.captureException(
      new Error(`astral-grove errex test ${new Date().toISOString()}`)
    );
  }, [bootReady]);

  if (!bootReady) {
    return <AppLoadingScreen />;
  }

  return (
    <NavThemeProvider value={actualTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar translucent backgroundColor="transparent" />
      <Stack
        screenOptions={{
          animation: reduceMotion ? 'fade' : 'default',
          gestureEnabled: true,
          fullScreenGestureEnabled: Platform.OS === 'ios',
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false, animation: 'none' }}
        />
        <Stack.Screen
          name="loading"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="update"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="card/[variantNumber]"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen
          name="collection/invite/[token]"
          options={{
            title: 'Join collection',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="invite/[token]"
          options={{
            title: 'Open invite',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="verify-email"
          options={{
            title: 'Verify email',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="reset-password"
          options={{
            title: 'Reset password',
            headerShown: false,
          }}
        />
      </Stack>
    </NavThemeProvider>
  );
}

function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: queryPersister,
          maxAge: QUERY_PERSIST_MAX_AGE_MS,
          dehydrateOptions: {
            shouldDehydrateQuery: shouldPersistQuery,
          },
        }}
      >
        <AppBootstrap>
          <ThemeProvider>
            <TetraProvider>
              <AppUpdateProvider>
                <RootNav />
                <AppUpdateScreen />
              </AppUpdateProvider>
            </TetraProvider>
          </ThemeProvider>
        </AppBootstrap>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);
