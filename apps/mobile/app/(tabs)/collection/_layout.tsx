import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export default function CollectionLayout() {
  const reduceMotion = useReduceMotion();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'fade' : 'default',
        gestureEnabled: true,
        fullScreenGestureEnabled: Platform.OS === 'ios',
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="[setCode]" />
    </Stack>
  );
}
