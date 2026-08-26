import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { EASE_OUT_EXPO } from '@/lib/motion';
import { decksPaneEnterDirection, type DecksListPane } from '@/lib/deck-list-motion';

const SLIDE_X = 28;
const SLIDE_MS = 200;

export function DecksPaneTransition({
  pane,
  fill = false,
  children,
}: {
  pane: DecksListPane;
  fill?: boolean;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const [direction] = useState(() => decksPaneEnterDirection(pane));
  const translateX = useSharedValue(
    reduceMotion || direction === 0 ? 0 : direction * SLIDE_X
  );

  useEffect(() => {
    if (reduceMotion || direction === 0) {
      translateX.value = 0;
      return;
    }
    translateX.value = withTiming(0, { duration: SLIDE_MS, easing: EASE_OUT_EXPO });
  }, [direction, reduceMotion, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View className={fill ? 'min-h-0 flex-1 overflow-hidden' : 'overflow-hidden'}>
      <Animated.View
        className={fill ? 'min-h-0 flex-1' : undefined}
        style={animatedStyle}
      >
        {children}
      </Animated.View>
    </View>
  );
}
