import { useEffect, useState } from 'react';
import { type LayoutChangeEvent, View, type ViewProps } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { EASE_OUT_EXPO } from '@/lib/motion';

/** Measured-height collapse via Reanimated (Moti/framer-motion break Expo web SSR). */
const OPEN_MS = 420;
const CLOSE_MS = 320;

type SmoothCollapseProps = {
  open: boolean;
  children: React.ReactNode;
  style?: ViewProps['style'];
};

/** Measured height+opacity collapse; content stays mounted for smooth form-step reflows. */
export function SmoothCollapse({ open, children, style }: SmoothCollapseProps) {
  const reduceMotion = useReduceMotion();
  const [measured, setMeasured] = useState(0);
  const height = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : open ? OPEN_MS : CLOSE_MS;
    const config = { duration, easing: EASE_OUT_EXPO };
    height.value = withTiming(open ? measured : 0, config);
    opacity.value = withTiming(open && measured > 0 ? 1 : 0, config);
  }, [height, measured, opacity, open, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.ceil(event.nativeEvent.layout.height);
    if (next > 0 && next !== measured) {
      setMeasured(next);
    }
  };

  return (
    <Animated.View
      style={[{ overflow: 'hidden', width: '100%' }, style, animatedStyle]}
      pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
    >
      <View
        style={{ position: 'absolute', top: 0, right: 0, left: 0, width: '100%' }}
        onLayout={onLayout}
      >
        {children}
      </View>
    </Animated.View>
  );
}

type SmoothChevronProps = {
  open: boolean;
  children: React.ReactNode;
};

export function SmoothChevron({ open, children }: SmoothChevronProps) {
  const reduceMotion = useReduceMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : open ? OPEN_MS : CLOSE_MS;
    rotation.value = withTiming(open ? 180 : 0, {
      duration,
      easing: EASE_OUT_EXPO,
    });
  }, [open, reduceMotion, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[{ flexShrink: 0 }, animatedStyle]}>{children}</Animated.View>
  );
}
