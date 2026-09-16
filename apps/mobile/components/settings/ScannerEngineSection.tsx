import { Platform, Pressable, View } from 'react-native';
import { CheckIcon } from '@/components/icons';
import { Text } from '@/components/ui/text';
import {
  SCANNER_ENGINES,
  SCANNER_LEVELS,
  useScannerEngine,
} from '@/hooks/useScannerEngine';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

function OptionRow<T extends string>({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
  value?: T;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        void hapticPress();
        onPress();
      }}
      className={cn(
        'flex-row items-start gap-3 rounded-[3px] border px-3 py-2.5',
        selected ? 'border-foreground bg-card-panel' : 'border-border'
      )}
    >
      <View className="mt-0.5 h-4 w-4 items-center justify-center">
        {selected ? <CheckIcon size={14} className="text-foreground" /> : null}
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground">{label}</Text>
        <Text className="text-[12px] leading-snug text-muted-foreground">{detail}</Text>
      </View>
    </Pressable>
  );
}

/**
 * Lets the card scanner be A/B'd on real hardware. Both engines run Apple Vision; they
 * differ in how the image reaches it. Device-local, so it is not part of synced
 * settings — it exists to pick a winner, then the loser can be deleted.
 */
export function ScannerEngineSection() {
  const { engine, setEngine, level, setLevel } = useScannerEngine();

  if (Platform.OS !== 'ios') return null;

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-sm font-semibold text-foreground">Card scanner</Text>
        <Text className="text-[12px] leading-snug text-muted-foreground">
          Both options use Apple Vision on-device. Nothing is uploaded either way.
        </Text>
      </View>

      <View className="gap-2">
        <Text className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Engine
        </Text>
        {SCANNER_ENGINES.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            detail={option.detail}
            selected={engine === option.value}
            onPress={() => setEngine(option.value)}
          />
        ))}
      </View>

      <View className="gap-2">
        <Text className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          Recognition
        </Text>
        {SCANNER_LEVELS.map((option) => (
          <OptionRow
            key={option.value}
            label={option.label}
            detail={option.detail}
            selected={level === option.value}
            onPress={() => setLevel(option.value)}
          />
        ))}
      </View>
    </View>
  );
}
