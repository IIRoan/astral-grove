import { TypeIcon } from '@/components/riftbound/CardIcons';
import { CardArtImage } from '@/components/cards/CardArtImage';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/ThemeContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { playScoreHintClasses } from '@/lib/legend-catalog';
import { MOTION, PRESS, PULSE_MS } from '@/lib/motion';
import {
  getPlayFormat,
  isOneAwayFromVictory,
  seatDisplayName,
  type PlayFormatId,
  type SeatState,
} from '@/lib/score-tracker';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { hapticPress } from '@/utils/haptics';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SEAT_SURFACE = ['bg-card', 'bg-card-panel', 'bg-background', 'bg-card'] as const;

type PlayerScoreSeatProps = {
  seat: SeatState;
  seatIndex: number;
  formatId: PlayFormatId;
  isWinner: boolean;
  compact?: boolean;
  onAdjustPoints: (delta: number) => void;
  onAdjustXp: (delta: number) => void;
  onPressLegend: () => void;
};

function XpStepper({
  label,
  onPress,
}: {
  label: 'plus' | 'minus';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'plus' ? 'Increase XP' : 'Decrease XP'}
      onPress={() => {
        void hapticPress();
        onPress();
      }}
      hitSlop={8}
      className="min-w-8 items-center justify-center px-1 py-1 active:opacity-60"
    >
      <Text className="font-mono text-lg font-medium tabular-nums text-muted-foreground">
        {label === 'plus' ? '+' : '−'}
      </Text>
    </Pressable>
  );
}

function ScoreEtch({
  kind,
  compact,
  animatedStyle,
}: {
  kind: 'plus' | 'minus';
  compact: boolean;
  animatedStyle: object;
}) {
  const { actualTheme } = useTheme();
  const tone = playScoreHintClasses(actualTheme);
  return (
    <Animated.View style={animatedStyle}>
      <Text
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className={cn(
          'font-mono font-light tabular-nums',
          tone.textClassName,
          compact ? 'text-5xl' : 'text-6xl'
        )}
      >
        {kind === 'plus' ? '+' : '−'}
      </Text>
    </Animated.View>
  );
}

function useScoreTick(value: number, reduceMotion: boolean) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const prev = useRef(value);

  useEffect(() => {
    const delta = value - prev.current;
    if (delta === 0) return;
    prev.current = value;
    if (reduceMotion) {
      scale.value = 1;
      translateY.value = 0;
      return;
    }
    const dir = delta > 0 ? -1 : 1;
    translateY.value = dir * 8;
    scale.value = 1.035;
    translateY.value = withSpring(0, MOTION.snappy);
    scale.value = withSpring(1, MOTION.snappy);
  }, [reduceMotion, scale, translateY, value]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));
}

function ScoreHalf({
  kind,
  compact,
  label,
  onAdjust,
}: {
  kind: 'plus' | 'minus';
  compact: boolean;
  label: string;
  onAdjust: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const highlight = useSharedValue(0);
  const etchScale = useSharedValue(1);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: highlight.value,
  }));

  const etchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: etchScale.value }],
    opacity: 0.55 + etchScale.value * 0.45,
  }));

  const pressIn = useCallback(() => {
    if (reduceMotion) {
      highlight.value = withTiming(0.1, { duration: PRESS.inMs });
      return;
    }
    highlight.value = withTiming(0.12, { duration: PRESS.inMs });
    etchScale.value = withTiming(0.88, { duration: PRESS.inMs });
  }, [etchScale, highlight, reduceMotion]);

  const pressOut = useCallback(() => {
    highlight.value = withTiming(0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
    if (!reduceMotion) {
      etchScale.value = withSpring(1, MOTION.bouncy);
    }
  }, [etchScale, highlight, reduceMotion]);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          void hapticPress();
          onAdjust();
        }}
        onPressIn={pressIn}
        onPressOut={pressOut}
        className={cn(
          'absolute bottom-0 top-0 z-0 w-1/2',
          kind === 'minus' ? 'left-0' : 'right-0'
        )}
      />
      <Animated.View
        pointerEvents="none"
        className={cn(
          'absolute bottom-0 top-0 z-[1] w-1/2 bg-foreground',
          kind === 'minus' ? 'left-0' : 'right-0'
        )}
        style={highlightStyle}
      />
      <View
        pointerEvents="none"
        className={cn(
          'absolute bottom-0 top-0 z-[5] w-1/2 justify-center',
          kind === 'minus' ? 'left-0 items-start pl-4' : 'right-0 items-end pr-4'
        )}
      >
        <ScoreEtch kind={kind} compact={compact} animatedStyle={etchStyle} />
      </View>
    </>
  );
}

function FinalPointCue({ compact }: { compact: boolean }) {
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.72, {
          duration: PULSE_MS / 2,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(1, {
          duration: PULSE_MS / 2,
          easing: Easing.inOut(Easing.quad),
        })
      ),
      -1,
      false
    );
  }, [pulse, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      entering={
        reduceMotion
          ? FadeIn.duration(200)
          : FadeInDown.springify()
              .damping(MOTION.snappy.damping)
              .stiffness(MOTION.snappy.stiffness)
              .mass(MOTION.snappy.mass)
      }
      style={pulseStyle}
      pointerEvents="none"
    >
      <Text
        className={cn(
          'font-semibold uppercase tracking-wide text-foreground',
          compact ? 'text-[10px]' : 'text-[11px]'
        )}
      >
        Final point
      </Text>
    </Animated.View>
  );
}

function VictoryBanner({ compact }: { compact: boolean }) {
  const reduceMotion = useReduceMotion();

  return (
    <Animated.View
      entering={
        reduceMotion
          ? FadeIn.duration(200)
          : ZoomIn.springify()
              .damping(MOTION.smooth.damping)
              .stiffness(MOTION.smooth.stiffness)
              .mass(MOTION.smooth.mass)
      }
      pointerEvents="none"
    >
      <Text
        className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}
      >
        Victory
      </Text>
    </Animated.View>
  );
}

function VictoryFrame() {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withSpring(1, MOTION.smooth);
  }, [progress, reduceMotion]);

  const frameStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.96 + progress.value * 0.04 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="absolute inset-2 z-20 border-2 border-foreground"
      style={frameStyle}
    />
  );
}

export function PlayerScoreSeat({
  seat,
  seatIndex,
  formatId,
  isWinner,
  compact = false,
  onAdjustPoints,
  onAdjustXp,
  onPressLegend,
}: PlayerScoreSeatProps) {
  const reduceMotion = useReduceMotion();
  const format = getPlayFormat(formatId);
  const oneAway = isOneAwayFromVictory(seat.points, format.victoryScore);
  const surface = SEAT_SURFACE[seatIndex % SEAT_SURFACE.length] ?? 'bg-card';
  const name = seatDisplayName(seat);
  const legendUri = seat.legend?.imageUrl
    ? resolveImageUrl(seat.legend.imageUrl)
    : null;

  const pointsStyle = useScoreTick(seat.points, reduceMotion);
  const xpStyle = useScoreTick(seat.xp, reduceMotion);

  return (
    <View
      className={cn(
        'relative min-h-0 min-w-0 flex-1 overflow-hidden',
        surface,
        isWinner && 'bg-card-panel'
      )}
    >
      {legendUri && seat.legend ? (
        <View pointerEvents="none" className="absolute inset-0">
          <CardArtImage
            uri={legendUri}
            recyclingKey={`play-bg-${seat.legend.variantNumber}`}
            className="h-full w-full"
            contentFit="cover"
            contentPosition="top"
            transition={0}
            priority="normal"
          />
          <View className="absolute inset-0 bg-background/72" />
        </View>
      ) : null}

      <ScoreHalf
        kind="minus"
        compact={compact}
        label={`Decrease points for ${name}`}
        onAdjust={() => onAdjustPoints(-1)}
      />
      <ScoreHalf
        kind="plus"
        compact={compact}
        label={`Increase points for ${name}`}
        onAdjust={() => onAdjustPoints(1)}
      />

      {isWinner ? <VictoryFrame /> : null}

      {!seat.legend ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Set legend"
          onPress={() => {
            void hapticPress();
            onPressLegend();
          }}
          hitSlop={8}
          className="absolute right-2 top-2 z-30 size-12 items-center justify-center active:opacity-70"
        >
          <TypeIcon type="Legend" size={24} tone="default" />
        </Pressable>
      ) : null}

      <View
        pointerEvents="box-none"
        className={cn(
          'z-10 h-full w-full items-center justify-center gap-3 px-5',
          compact ? 'py-3' : 'py-5'
        )}
      >
        <View
          pointerEvents="box-none"
          className="flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2"
        >
          {seat.legend ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change legend, currently ${name}`}
              onPress={() => {
                void hapticPress();
                onPressLegend();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
              className="min-h-11 items-center justify-center px-3 py-2.5 active:opacity-70"
            >
              <Text
                className="text-base font-semibold text-foreground"
                numberOfLines={1}
              >
                {name}
              </Text>
            </Pressable>
          ) : null}
          {seat.team ? (
            <Text
              pointerEvents="none"
              className="font-mono text-[11px] font-medium text-muted-foreground"
            >
              Team {seat.team.toUpperCase()}
            </Text>
          ) : null}
          {format.trackMatchWins ? (
            <Text
              pointerEvents="none"
              accessibilityLabel={`${seat.matchWins} match wins`}
              className="font-mono text-[11px] font-medium text-muted-foreground"
            >
              Games {seat.matchWins}
            </Text>
          ) : null}
        </View>

        {oneAway && !isWinner ? <FinalPointCue compact={compact} /> : null}

        {isWinner ? <VictoryBanner compact={compact} /> : null}

        <Animated.View style={pointsStyle} pointerEvents="none">
          <Text
            accessibilityLabel={`${seat.points} victory points`}
            className={cn(
              'text-center font-mono font-bold tabular-nums text-foreground',
              compact ? 'text-6xl' : 'text-7xl'
            )}
          >
            {seat.points}
          </Text>
        </Animated.View>

        <View className="flex-row items-center gap-1">
          <Text
            pointerEvents="none"
            className="pr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            XP
          </Text>
          <XpStepper label="minus" onPress={() => onAdjustXp(-1)} />
          <Animated.View style={xpStyle} pointerEvents="none">
            <Text
              accessibilityLabel={`${seat.xp} XP`}
              className="min-w-7 text-center font-mono text-base font-semibold tabular-nums text-foreground"
            >
              {seat.xp}
            </Text>
          </Animated.View>
          <XpStepper label="plus" onPress={() => onAdjustXp(1)} />
        </View>
      </View>
    </View>
  );
}
