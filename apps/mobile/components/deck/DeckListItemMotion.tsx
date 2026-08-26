import type { ReactNode } from 'react';
import Animated, {
  FadeIn,
  FadeInDown,
  LinearTransition,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MOTION } from '@/lib/motion';
import { deckListItemStaggerMs } from '@/lib/deck-list-motion';

function deckListItemEntering(index: number, reduceMotion: boolean) {
  const delay = deckListItemStaggerMs(index);
  if (reduceMotion) return FadeIn.duration(180).delay(delay);
  return FadeInDown.springify()
    .damping(MOTION.snappy.damping)
    .stiffness(MOTION.snappy.stiffness)
    .mass(MOTION.snappy.mass)
    .delay(delay);
}

export function DeckListItemMotion({
  index = 0,
  children,
}: {
  index?: number;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();

  return (
    <Animated.View
      entering={deckListItemEntering(index, reduceMotion)}
      layout={
        reduceMotion
          ? undefined
          : LinearTransition.springify()
              .damping(MOTION.smooth.damping)
              .stiffness(MOTION.smooth.stiffness)
              .mass(MOTION.smooth.mass)
      }
    >
      {children}
    </Animated.View>
  );
}
