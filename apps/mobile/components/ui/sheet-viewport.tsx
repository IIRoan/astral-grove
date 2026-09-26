import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useBottomSheetInternal } from '@gorhom/bottom-sheet';
import { getBottomSheetViewportHeight } from '@/lib/bottom-sheet-layout';

const KEYBOARD_SHOWN = 1;

export function SheetViewport({ children }: { children: ReactNode }) {
  const {
    animatedLayoutState,
    animatedPosition,
    animatedSheetHeight,
    animatedKeyboardState,
  } = useBottomSheetInternal();
  const viewportStyle = useAnimatedStyle(() => {
    const layout = animatedLayoutState.get();
    const keyboard = animatedKeyboardState.get();
    return {
      height: getBottomSheetViewportHeight(
        layout.containerHeight,
        animatedPosition.get(),
        animatedSheetHeight.get(),
        layout.handleHeight,
        keyboard.status === KEYBOARD_SHOWN ? keyboard.heightWithinContainer : 0
      ),
    };
  });

  if (Platform.OS !== 'ios') return <>{children}</>;
  return (
    <Animated.View className="min-h-0 shrink-0 overflow-hidden" style={viewportStyle}>
      {children}
    </Animated.View>
  );
}
