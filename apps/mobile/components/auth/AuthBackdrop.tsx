import { Image } from 'expo-image';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { Mode } from '@/components/auth/auth-types';
import { AUTH_WALLPAPERS } from '@/components/auth/authBackdrop.constants';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const TRANSITION_MS = 320;

type AuthBackdropProps = {
  mode: Mode;
  variant?: 'hero' | 'contained';
};

export function AuthBackdrop({ mode, variant = 'hero' }: AuthBackdropProps) {
  const reduceMotion = useReduceMotion();
  const signInOpacity = useSharedValue(mode === 'sign-in' ? 1 : 0);
  const signUpOpacity = useSharedValue(mode === 'sign-up' ? 1 : 0);
  const isHero = variant === 'hero';

  useEffect(() => {
    const duration = reduceMotion ? 0 : TRANSITION_MS;
    const easing = Easing.out(Easing.cubic);
    signInOpacity.value = withTiming(mode === 'sign-in' ? 1 : 0, { duration, easing });
    signUpOpacity.value = withTiming(mode === 'sign-up' ? 1 : 0, { duration, easing });
  }, [mode, reduceMotion, signInOpacity, signUpOpacity]);

  const signInStyle = useAnimatedStyle(() => ({
    opacity: signInOpacity.value,
  }));

  const signUpStyle = useAnimatedStyle(() => ({
    opacity: signUpOpacity.value,
  }));

  return (
    <View
      className="absolute inset-0 overflow-hidden"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        className="absolute inset-0"
        style={signInStyle}
        pointerEvents="none"
      >
        <Image
          source={AUTH_WALLPAPERS['sign-in']}
          contentFit="cover"
          contentPosition={isHero ? 'top center' : 'center'}
          className="h-full w-full"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      <Animated.View
        className="absolute inset-0"
        style={signUpStyle}
        pointerEvents="none"
      >
        <Image
          source={AUTH_WALLPAPERS['sign-up']}
          contentFit="cover"
          contentPosition={isHero ? 'top center' : 'center'}
          className="h-full w-full"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      {isHero ? (
        <Svg
          pointerEvents="none"
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <Defs>
            <LinearGradient id="auth-hero-scrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0.15" />
              <Stop offset="0.45" stopColor="#000000" stopOpacity="0.35" />
              <Stop offset="1" stopColor="#0a0a0a" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" fill="url(#auth-hero-scrim)" />
        </Svg>
      ) : (
        <View className="absolute inset-0 bg-black/40" pointerEvents="none" />
      )}
    </View>
  );
}
