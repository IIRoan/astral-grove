import { Modal, useWindowDimensions, View } from 'react-native';
import {
  RuneChargeLoader,
  type RuneChargeSize,
} from '@/components/riftbound/RuneChargeLoader';
import { Text } from '@/components/ui/text';
import { runeSizeForWindow } from '@/lib/rune-size';
import { cn } from '@/lib/utils';

type AppLoaderProps = {
  size?: RuneChargeSize;
  label?: string;
  detail?: string;
  className?: string;
  accessibilityLabel?: string;
};

export function AppLoader({
  size = 'md',
  label,
  detail,
  className,
  accessibilityLabel,
}: AppLoaderProps) {
  return (
    <View className={cn('items-center justify-center gap-3', className)}>
      <RuneChargeLoader
        size={size}
        accessibilityLabel={accessibilityLabel ?? label ?? 'Loading'}
      />
      {label ? (
        <View className="items-center gap-1 px-4">
          <Text className="text-center text-base font-semibold text-foreground">
            {label}
          </Text>
          {detail ? (
            <Text className="text-center text-sm text-muted-foreground">{detail}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function AppLoadingScreen({ size, label, detail, className }: AppLoaderProps) {
  const { width, height } = useWindowDimensions();
  const stageSize = size ?? runeSizeForWindow(width, height);

  return (
    <View
      className={cn(
        'min-h-0 w-full flex-1 items-center justify-center bg-background px-6',
        className
      )}
      style={{ flex: 1 }}
    >
      <AppLoader size={stageSize} label={label} detail={detail} />
    </View>
  );
}

type AppLoadingOverlayProps = {
  visible: boolean;
  message?: string;
  detail?: string;
  onRequestClose?: () => void;
};

export function AppLoadingOverlay({
  visible,
  message,
  detail,
  onRequestClose,
}: AppLoadingOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View className="flex-1 bg-background">
        <AppLoadingScreen label={message} detail={detail} />
      </View>
    </Modal>
  );
}
