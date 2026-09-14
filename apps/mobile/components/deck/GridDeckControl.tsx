import { ThemedIcon, MinusIcon, PlusIcon } from '@/components/icons';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';
import {
  OPERATE_CTA_FILL_CLASS,
  OPERATE_CTA_ICON_CLASS,
  OPERATE_CTA_LABEL_CLASS,
  OPERATE_QTY_CLASS,
} from '@/constants/operateType';
import { hapticPress } from '@/utils/haptics';
import { cn } from '@/lib/utils';

/** Tray footer height — matches `GridCollectionControl`. */
const CONTROL_HEIGHT = 'h-9';
const ICON_SIZE = 14;

interface GridDeckControlProps {
  count: number;
  name: string;
  canAdd: boolean;
  canRemove: boolean;
  blocked?: boolean;
  blockedLabel?: string;
  readOnly?: boolean;
  /** Narrow tiles (< ~120pt): smaller steppers so "+" is not clipped by the tile edge. */
  compact?: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

export function GridDeckControl({
  count,
  name,
  canAdd,
  canRemove,
  blocked = false,
  blockedLabel = 'Unavailable',
  readOnly = false,
  compact = false,
  onAdd,
  onRemove,
}: GridDeckControlProps) {
  const stepperClass = compact ? 'size-7' : 'size-8';
  const handleAdd = () => {
    void hapticPress();
    onAdd();
  };

  const handleRemove = () => {
    void hapticPress();
    onRemove();
  };

  if (readOnly) {
    if (count === 0) return null;
    return (
      <View className={`${CONTROL_HEIGHT} w-full flex-row items-center justify-center`}>
        <Text className={cn(OPERATE_QTY_CLASS, 'min-w-0')}>×{count}</Text>
      </View>
    );
  }

  if (count === 0) {
    if (blocked) {
      return (
        <View
          className={cn(
            CONTROL_HEIGHT,
            'w-full items-center justify-center border border-border bg-card-panel px-2',
            FACTORY_RADIUS_CONTROL_CLASS
          )}
        >
          <Text
            className="text-center text-[11px] font-normal text-muted-foreground"
            numberOfLines={1}
          >
            {blockedLabel}
          </Text>
        </View>
      );
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${name} to deck`}
        accessibilityState={{ disabled: !canAdd }}
        className={cn(
          CONTROL_HEIGHT,
          'w-full flex-row items-center justify-center gap-1.5 active:opacity-80',
          OPERATE_CTA_FILL_CLASS,
          FACTORY_RADIUS_CONTROL_CLASS,
          !canAdd && 'opacity-45'
        )}
        disabled={!canAdd}
        onPress={handleAdd}
      >
        <PlusIcon className={cn('size-3.5', OPERATE_CTA_ICON_CLASS)} weight="bold" />
        <Text className={OPERATE_CTA_LABEL_CLASS}>Add</Text>
      </Pressable>
    );
  }

  return (
    <View
      className={cn(
        CONTROL_HEIGHT,
        'w-full flex-row items-center justify-between border border-border bg-card-panel',
        compact ? 'px-0' : 'px-0.5',
        FACTORY_RADIUS_CONTROL_CLASS
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove one ${name}`}
        hitSlop={6}
        className={cn(
          stepperClass,
          'items-center justify-center active:bg-foreground/10',
          FACTORY_RADIUS_CONTROL_CLASS,
          !canRemove && 'opacity-40'
        )}
        disabled={!canRemove}
        onPress={handleRemove}
      >
        <ThemedIcon icon={MinusIcon} size={ICON_SIZE} color="foreground" />
      </Pressable>
      <Text className={cn(OPERATE_QTY_CLASS, compact && 'min-w-5')}>{count}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add one ${name}`}
        hitSlop={6}
        className={cn(
          stepperClass,
          'items-center justify-center active:bg-foreground/10',
          FACTORY_RADIUS_CONTROL_CLASS,
          !canAdd && 'opacity-40'
        )}
        disabled={!canAdd}
        onPress={handleAdd}
      >
        <ThemedIcon
          icon={PlusIcon}
          size={ICON_SIZE}
          color={canAdd ? 'foreground' : 'muted-foreground'}
        />
      </Pressable>
    </View>
  );
}
