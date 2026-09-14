import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import {
  formatChannelLabel,
  formatDownloadPercent,
  type AppUpdatePhase,
} from '@/lib/app-update';
import { RuneChargeLoader } from '@/components/riftbound/RuneChargeLoader';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { runeSizeForWindow } from '@/lib/rune-size';

type PhaseCopy = {
  kicker: string;
  title: string;
  body: string;
  primary?: string;
  secondary?: string;
};

export function copyForPhase(
  phase: AppUpdatePhase,
  channelLabel: string,
  errorMessage: string | null
): PhaseCopy {
  switch (phase) {
    case 'available':
      return {
        kicker: `Channel ${channelLabel}`,
        title: 'Update available',
        body: 'A newer bundle is waiting on this channel. Install it, then restart to apply.',
        primary: 'Install update',
        secondary: 'Later',
      };
    case 'downloading':
      return {
        kicker: 'Receiving',
        title: 'Installing',
        body: 'Keep the app open until the rune fills.',
      };
    case 'ready':
      return {
        kicker: 'Ready',
        title: 'Restart to apply',
        body: 'The new bundle is on device. Restart loads it.',
        primary: 'Restart',
        secondary: 'Later',
      };
    case 'restarting':
      return {
        kicker: 'Applying',
        title: 'Restarting',
        body: 'Loading the new bundle.',
      };
    case 'error':
      return {
        kicker: 'Failed',
        title: 'Update did not land',
        body: errorMessage?.trim() || 'The download did not finish. Try again.',
        primary: 'Try again',
        secondary: 'Later',
      };
    default:
      return { kicker: '', title: '', body: '' };
  }
}

export type AppUpdateDispatchProps = {
  phase: AppUpdatePhase;
  channelLabel: string;
  downloadProgress?: number;
  errorMessage?: string | null;
  onPrimary?: () => void;
  onSecondary?: () => void;
  header?: React.ReactNode;
};

export function AppUpdateDispatch({
  phase,
  channelLabel,
  downloadProgress,
  errorMessage = null,
  onPrimary,
  onSecondary,
  header,
}: AppUpdateDispatchProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const copy = copyForPhase(phase, channelLabel, errorMessage);
  const percent = formatDownloadPercent(downloadProgress);
  const runeSize = runeSizeForWindow(width, height);
  const runeProgress =
    phase === 'downloading'
      ? (downloadProgress ?? 0)
      : phase === 'ready'
        ? 1
        : phase === 'restarting'
          ? undefined
          : 0;

  return (
    // Scrolls when rune + copy + CTAs outgrow short windows (landscape phones, large text).
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: Math.max(insets.top, 16),
        paddingBottom: Math.max(insets.bottom, 16),
        paddingHorizontal: 24,
      }}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {header}
      <View className="grow items-center justify-center gap-6 py-4">
        <RuneChargeLoader
          size={runeSize}
          progress={runeProgress}
          accessibilityLabel={
            phase === 'downloading'
              ? `Installing update, ${percent} percent`
              : phase === 'restarting'
                ? 'Restarting'
                : copy.title
          }
        />

        <View className="w-full max-w-[400px] items-center gap-3">
          {copy.kicker ? (
            <Text className="font-mono text-[12px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
              {copy.kicker}
            </Text>
          ) : null}
          <Text className="text-center text-[32px] font-semibold leading-[1.1] tracking-[-0.96px] text-foreground sm:text-[36px] sm:tracking-[-1.12px]">
            {copy.title}
          </Text>
          <Text className="text-center text-base font-normal leading-6 text-muted-foreground">
            {copy.body}
          </Text>
        </View>

        {phase === 'downloading' ? (
          <View className="w-full max-w-[400px] gap-2">
            <View className="h-px overflow-hidden bg-border">
              <View className="h-full bg-foreground" style={{ width: `${percent}%` }} />
            </View>
            <Text className="font-mono text-[12px] font-medium tabular-nums text-muted-foreground">
              {percent}%
            </Text>
          </View>
        ) : null}
      </View>

      <View className="w-full max-w-[400px] self-center gap-3">
        {copy.primary ? (
          <Button
            onPress={onPrimary}
            accessibilityLabel={copy.primary}
            disabled={phase === 'restarting' || !onPrimary}
          >
            <ButtonText>{copy.primary}</ButtonText>
          </Button>
        ) : null}
        {copy.secondary ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.secondary}
            onPress={onSecondary}
            className="items-center py-3 active:opacity-70"
          >
            <Text className="text-base font-medium text-foreground">
              {copy.secondary}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

export function AppUpdateScreen() {
  const { phase, channel, downloadProgress, errorMessage, install, restart, dismiss } =
    useAppUpdate();
  const visible = phase !== 'idle';

  const onPrimary = () => {
    if (phase === 'available' || phase === 'error') {
      void install();
      return;
    }
    if (phase === 'ready') {
      void restart();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={
        phase === 'downloading' || phase === 'restarting' ? undefined : dismiss
      }
    >
      <AppUpdateDispatch
        phase={phase}
        channelLabel={formatChannelLabel(channel)}
        downloadProgress={downloadProgress}
        errorMessage={errorMessage}
        onPrimary={onPrimary}
        onSecondary={dismiss}
      />
    </Modal>
  );
}
