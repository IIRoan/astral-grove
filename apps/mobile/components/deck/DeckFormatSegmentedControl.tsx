import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { DECK_FORMAT_OPTIONS, type DeckFormat } from '@riftbound/contracts';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface DeckFormatSegmentedControlProps {
  value: DeckFormat;
  onChange: (format: DeckFormat) => void;
  disabled?: boolean;
}

export function DeckFormatSegmentedControl({
  value,
  onChange,
  disabled = false,
}: DeckFormatSegmentedControlProps) {
  const active = DECK_FORMAT_OPTIONS.find((option) => option.value === value);

  return (
    <View className="gap-1.5">
      <View
        accessibilityRole="radiogroup"
        className="flex-row gap-1 rounded-[3px] border border-border bg-card-panel p-1"
      >
        {DECK_FORMAT_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              className={cn(
                'min-h-9 flex-1 items-center justify-center rounded-[3px] px-2 py-1.5',
                selected ? 'border border-border bg-card' : 'active:bg-card-panel/60',
                disabled && 'opacity-50'
              )}
              onPress={() => {
                if (disabled || selected) return;
                hapticPress();
                onChange(option.value);
              }}
            >
              <Text
                className={cn(
                  'text-[13px] font-normal',
                  selected ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {active ? (
        <Text className="text-[12px] leading-4 text-muted-foreground">
          {active.description}
        </Text>
      ) : null}
    </View>
  );
}
