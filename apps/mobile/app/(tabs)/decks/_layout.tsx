import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export default function DecksLayout() {
  const reduceMotion = useReduceMotion();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Platform default = native push/pop (iOS edge swipe, Android material).
        animation: reduceMotion ? 'fade' : 'default',
        gestureEnabled: true,
        fullScreenGestureEnabled: Platform.OS === 'ios',
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="browse" options={{ animation: 'none' }} />
      <Stack.Screen name="create" />
      {/* Edge-swipe only — full-screen back fights vertical deck scrolling. */}
      <Stack.Screen name="[id]" options={{ fullScreenGestureEnabled: false }} />
      <Stack.Screen name="[id]/add" options={{ fullScreenGestureEnabled: false }} />
    </Stack>
  );
}
