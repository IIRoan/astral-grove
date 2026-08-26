import { useEffect, useRef, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';

const HANDOFF_MS = 180;
const EASE_OUT = Easing.out(Easing.cubic);

interface CatalogResultsTransitionProps {
  transitionKey: string;
  className?: string;
  style?: StyleProp<ViewStyle>;
  fill?: boolean;
  children: ReactNode;
}

export function CatalogResultsTransition({
  transitionKey,
  className,
  style,
  fill = true,
  children,
}: CatalogResultsTransitionProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const isFirstKey = useRef(true);

  useEffect(() => {
    if (isFirstKey.current) {
      isFirstKey.current = false;
      return;
    }
    if (reduceMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    opacity.value = 0.82;
    translateY.value = 10;
    opacity.value = withTiming(1, { duration: HANDOFF_MS, easing: EASE_OUT });
    translateY.value = withSpring(0, MOTION.snappy);
  }, [opacity, reduceMotion, transitionKey, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View
      className={cn(fill && 'min-h-0 flex-1 overflow-hidden', className)}
      style={style}
    >
      <Animated.View
        className={fill ? 'min-h-0 flex-1' : undefined}
        style={animatedStyle}
      >
        {children}
      </Animated.View>
    </View>
  );
}
