import { Platform, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import {
  KeyboardAwareScrollView,
  useReanimatedKeyboardAnimation,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthDomainStrip, AuthSlabCorners } from '@/components/auth/AuthArtifacts';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { useAuthWideLayout } from '@/components/auth/useAuthWideLayout';
import type { Mode } from '@/components/auth/auth-types';

/** Mobile: hero art + floating form slab. Whole playmat scrolls with the keyboard. */
function AuthMobilePlaymat({
  mode,
  children,
  insets,
}: {
  mode: Mode;
  children: React.ReactNode;
  insets: { top: number; bottom: number };
}) {
  const { height: windowHeight } = useWindowDimensions();
  const artHeight = Math.round(windowHeight * 0.38);
  const { progress } = useReanimatedKeyboardAnimation();

  const artStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [artHeight, 64], Extrapolation.CLAMP),
  }));

  return (
    <View className="flex-1 bg-background">
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        bottomOffset={48}
        extraKeyboardSpace={Platform.OS === 'ios' ? 16 : 28}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View className="relative overflow-hidden" style={artStyle}>
          <AuthBackdrop mode={mode} variant="hero" />
          <View className="absolute inset-x-5 bottom-8" pointerEvents="none">
            <AuthDomainStrip size={26} />
          </View>
        </Animated.View>

        <View
          className="relative z-10 -mt-4 flex-1 rounded-t-2xl border-t border-border bg-background px-6 pt-6"
          style={{ paddingBottom: Math.max(insets.bottom, 16) + 28 }}
        >
          <View className="pointer-events-none absolute inset-0 overflow-hidden rounded-t-2xl">
            <AuthSlabCorners />
          </View>
          {/* Native iPad (and wide Android) keep this slab; cap the form column so fields don't stretch edge to edge. */}
          <View className="w-full max-w-md self-center">{children}</View>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

function AuthWidePlaymat({
  mode,
  children,
  insets,
}: {
  mode: Mode;
  children: React.ReactNode;
  insets: { top: number; bottom: number };
}) {
  const { width } = useWindowDimensions();
  const slabWidth = Math.min(420, Math.max(360, width * 0.36));

  return (
    <View className="relative min-h-0 flex-1 overflow-hidden bg-background web:min-h-dvh web:w-full">
      <AuthBackdrop mode={mode} variant="contained" />

      <View
        className="absolute inset-y-0 left-0 w-[52%] max-w-[640px] bg-background/80"
        pointerEvents="none"
      />

      <View
        className="absolute inset-y-0 justify-center"
        style={{
          left: Math.max(32, width * 0.06),
          width: slabWidth,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bottomOffset={32}
          extraKeyboardSpace={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        >
          <View className="relative rounded-[10px] border border-border bg-background/95 px-8 py-9 shadow-lg shadow-black/40">
            <AuthSlabCorners />
            <AuthDomainStrip size={24} />
            <View className="mt-8">{children}</View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

export function AuthPlaymat({
  children,
  mode = 'sign-in',
}: {
  children: React.ReactNode;
  mode?: Mode;
}) {
  const insets = useSafeAreaInsets();
  const wide = useAuthWideLayout();

  if (wide) {
    return (
      <AuthWidePlaymat mode={mode} insets={insets}>
        {children}
      </AuthWidePlaymat>
    );
  }

  return (
    <AuthMobilePlaymat mode={mode} insets={insets}>
      {children}
    </AuthMobilePlaymat>
  );
}
