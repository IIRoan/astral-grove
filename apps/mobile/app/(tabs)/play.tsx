import { PlayCenterRail } from '@/components/play/PlayCenterRail';
import { PlayScoreboard } from '@/components/play/PlayScoreboard';
import { PlaySetupSheet } from '@/components/play/PlaySetupSheet';
import {
  adjustPoints,
  adjustXp,
  advanceMatchGame,
  createScoreTrackerState,
  getPlayFormat,
  resetGame,
  setPlayFormat,
  setSeatLegend,
  type PlayFormatId,
  type ScoreTrackerState,
  type SeatLegend,
} from '@/lib/score-tracker';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [state, setState] = useState<ScoreTrackerState>(() =>
    createScoreTrackerState('duel')
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legendSeatId, setLegendSeatId] = useState<string | null>(null);

  const format = useMemo(() => getPlayFormat(state.format), [state.format]);

  const onAdjustPoints = useCallback((seatId: string, delta: number) => {
    setState((prev) => adjustPoints(prev, seatId, delta));
  }, []);

  const onAdjustXp = useCallback((seatId: string, delta: number) => {
    setState((prev) => adjustXp(prev, seatId, delta));
  }, []);

  const onSelectFormat = useCallback((formatId: PlayFormatId) => {
    setState((prev) => setPlayFormat(prev, formatId));
  }, []);

  const onSetLegend = useCallback((seatId: string, legend: SeatLegend | null) => {
    setState((prev) => setSeatLegend(prev, seatId, legend));
  }, []);

  const openSettings = useCallback((seatId: string | null = null) => {
    setLegendSeatId(seatId);
    setSettingsOpen(true);
  }, []);

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <PlayScoreboard
        state={state}
        onAdjustPoints={onAdjustPoints}
        onAdjustXp={onAdjustXp}
        onPressLegend={(seatId) => openSettings(seatId)}
        rail={
          <PlayCenterRail
            formatLabel={format.label}
            formatDescription={format.description}
            showNextGame={Boolean(format.trackMatchWins && state.winnerSeatId)}
            onLeave={() => router.push('/(tabs)/search')}
            onReset={() => setState((prev) => resetGame(prev))}
            onOpenSettings={() => openSettings(null)}
            onNextGame={() => setState((prev) => advanceMatchGame(prev))}
          />
        }
      />

      <PlaySetupSheet
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setLegendSeatId(null);
        }}
        initialSeatId={legendSeatId}
        state={state}
        onSelectFormat={onSelectFormat}
        onSetLegend={onSetLegend}
        onAdvanceMatch={() => setState((prev) => advanceMatchGame(prev))}
      />
    </View>
  );
}
