import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast.api';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import {
  formatChannelLabel,
  formatUpdateId,
  toastCopyForUpdateCheck,
} from '@/lib/app-update';
import { getSentryOptions, Sentry } from '@/lib/sentry';
import * as Updates from 'expo-updates';

function formatUpdateStamp(value: Date | null | undefined): string {
  if (!value) return 'Embedded build';
  try {
    return value.toLocaleString();
  } catch {
    return value.toISOString();
  }
}

function actionLabel(
  enabled: boolean,
  phase: ReturnType<typeof useAppUpdate>['phase']
): string {
  if (!enabled) return 'Updates off in this build';
  if (phase === 'downloading' || phase === 'restarting') return 'Installing…';
  if (phase === 'ready') return 'Restart to apply';
  if (phase === 'available' || phase === 'error') return 'Install update';
  return 'Check for update';
}

function showUpdateCheckToast(
  result: Awaited<ReturnType<ReturnType<typeof useAppUpdate>['check']>>
): void {
  const copy = toastCopyForUpdateCheck(result);
  if (copy.type === 'success') {
    toast.success(copy.text);
    return;
  }
  if (copy.type === 'error') {
    toast.error(copy.text);
    return;
  }
  toast(copy.text);
}

export function UpdateChannelSection() {
  const { enabled, action, check, install, restart } = useAppUpdate();
  const updateId = formatUpdateId(Updates.updateId);
  const label = actionLabel(enabled, action);
  const busy = action === 'downloading' || action === 'restarting';

  const onAction = () => {
    if (busy) return;
    if (!enabled) {
      toast('Updates are off in this build');
      return;
    }
    if (action === 'ready') {
      void restart();
      return;
    }
    if (action === 'available' || action === 'error') {
      void install();
      return;
    }
    void (async () => {
      const result = await check();
      showUpdateCheckToast(result);
    })();
  };

  const onSendTestError = () => {
    if (!getSentryOptions()) {
      toast.error('Error reporting is not configured');
      return;
    }
    Sentry.captureException(
      new Error(`astral-grove settings test ${new Date().toISOString()}`)
    );
    toast.success('Test event sent');
  };

  return (
    <View className="overflow-hidden rounded-[10px] border border-border bg-card">
      <View className="flex-row items-stretch">
        <View className="min-w-0 flex-1 gap-1 px-4 py-4">
          <Text className="text-[10px] font-normal uppercase tracking-[1.4px] text-muted-foreground">
            Active
          </Text>
          <Text className="font-mono text-2xl font-normal tabular-nums leading-none text-foreground">
            {formatChannelLabel(Updates.channel)}
          </Text>
        </View>
        <View className="w-hairline self-stretch bg-archive-soft-line" />
        <View className="min-w-0 flex-1 gap-1 px-4 py-4">
          <Text className="text-[10px] font-normal uppercase tracking-[1.4px] text-muted-foreground">
            Update
          </Text>
          <Text
            className="font-mono text-base font-normal tabular-nums text-foreground"
            numberOfLines={1}
          >
            {updateId}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {formatUpdateStamp(Updates.createdAt)}
          </Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={onAction}
        className="h-11 flex-row items-center justify-between border-t border-border px-4 active:bg-card-panel sm:h-12"
      >
        <Text
          className="text-sm font-medium leading-5 text-foreground"
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text className="font-mono text-xs font-normal text-foreground">
          {action === 'ready' ? '↻' : '↓'}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send test error event"
        onPress={onSendTestError}
        className="h-11 flex-row items-center justify-between border-t border-border px-4 active:bg-card-panel sm:h-12"
      >
        <Text
          className="text-sm font-medium leading-5 text-foreground"
          numberOfLines={1}
        >
          Send test error
        </Text>
        <Text className="font-mono text-xs font-normal text-foreground">↗</Text>
      </Pressable>
    </View>
  );
}
