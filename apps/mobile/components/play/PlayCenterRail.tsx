import { ArrowClockwiseIcon, ChevronLeftIcon, SettingsIcon } from '@/components/icons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MOTION } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';

type PlayCenterRailProps = {
  formatLabel: string;
  formatDescription: string;
  showNextGame?: boolean;
  onLeave: () => void;
  onReset: () => void;
  onOpenSettings: () => void;
  onNextGame?: () => void;
};

function RailButton({
  label,
  onPress,
  children,
  className,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        void hapticPress();
        onPress();
      }}
      className={cn(
        'size-10 items-center justify-center rounded-[3px] border border-border bg-background',
        className
      )}
      contentClassName="items-center justify-center"
      depth={0.92}
    >
      {children}
    </PressableScale>
  );
}

export function PlayCenterRail({
  formatLabel,
  formatDescription,
  showNextGame = false,
  onLeave,
  onReset,
  onOpenSettings,
  onNextGame,
}: PlayCenterRailProps) {
  const reduceMotion = useReduceMotion();

  return (
    <View className="z-20 flex-row items-center gap-2 border-y border-border bg-card px-2 py-1.5">
      <View className="flex-row items-center gap-1.5">
        <RailButton label="Leave scoreboard" onPress={onLeave}>
          <ChevronLeftIcon size={18} className="text-foreground" />
        </RailButton>
        <RailButton label="Reset game points" onPress={onReset}>
          <ArrowClockwiseIcon size={18} className="text-foreground" />
        </RailButton>
        <RailButton label="Open play settings" onPress={onOpenSettings}>
          <SettingsIcon size={18} className="text-foreground" />
        </RailButton>
        {showNextGame && onNextGame ? (
          <Animated.View
            entering={
              reduceMotion
                ? FadeIn.duration(180)
                : FadeInRight.springify()
                    .damping(MOTION.snappy.damping)
                    .stiffness(MOTION.snappy.stiffness)
                    .mass(MOTION.snappy.mass)
            }
          >
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Start next game"
              onPress={() => {
                void hapticPress();
                onNextGame();
              }}
              className="rounded-[3px] border border-border bg-card-panel px-3 py-2"
              contentClassName="items-center justify-center"
            >
              <Text className="text-xs font-normal text-foreground">Next</Text>
            </PressableScale>
          </Animated.View>
        ) : null}
      </View>

      <View className="min-w-0 flex-1 items-end pr-1">
        <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
          {formatLabel}
        </Text>
        <Text className="font-mono text-[10px] text-muted-foreground" numberOfLines={1}>
          {formatDescription}
        </Text>
      </View>
    </View>
  );
}
