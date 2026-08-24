import {
  ThemedIcon,
  CircleCheckIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
} from '@/components/icons';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Badge, BadgeIcon, BadgeText } from '@/components/ui/badge';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Stack } from '@/components/ui/stack';
import { Text } from '@/components/ui/text';
import {
  OPERATE_CTA_FILL_CLASS,
  OPERATE_CTA_ICON_CLASS,
  OPERATE_CTA_LABEL_CLASS,
  OPERATE_CTA_SPINNER_CLASS,
} from '@/constants/operateType';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface Props {
  quantity: number;
  /** Kept for call-site compatibility; finish is shown via the printing label. */
  isFoil?: boolean;
  compact?: boolean;
  loading?: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

function CompactStepDivider() {
  return <View className="h-5 w-hairline self-center bg-border" />;
}

export function CollectionAddButton({
  onPress,
  disabled,
  loading,
  className,
}: {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  const isMobile = useMobileLayout();

  if (isMobile) {
    return (
      <Pressable
        accessibilityLabel="Add to collection"
        className={cn(
          'h-10 flex-row items-center justify-center gap-1.5 rounded-[3px] px-3.5 active:opacity-80',
          OPERATE_CTA_FILL_CLASS,
          className
        )}
        onPress={() => {
          void hapticPress();
          onPress();
        }}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator size="small" className={OPERATE_CTA_SPINNER_CLASS} />
        ) : (
          <>
            <PlusIcon
              className={cn('size-3.5', OPERATE_CTA_ICON_CLASS)}
              weight="bold"
            />
            <Text className={OPERATE_CTA_LABEL_CLASS}>Add</Text>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <Button
      size="sm"
      className={cn('h-8 w-auto shrink-0 px-2.5', className)}
      onPress={onPress}
      disabled={disabled}
      busy={loading}
      accessibilityLabel="Add to collection"
    >
      <ButtonText className="text-[13px] font-normal">Add</ButtonText>
    </Button>
  );
}

export function CollectionQtyControls({
  quantity,
  isFoil: _isFoil = false,
  compact = false,
  loading = false,
  onIncrement,
  onDecrement,
  onRemove,
}: Props) {
  const displayQuantity = Math.max(0, quantity);
  const isMobile = useMobileLayout();
  const touchFriendly = isMobile && compact;

  const handleDecrement = () => {
    void hapticPress();
    if (displayQuantity <= 1) {
      onRemove();
      return;
    }
    onDecrement();
  };

  const handleRemove = () => {
    void hapticPress();
    onRemove();
  };

  if (compact) {
    if (touchFriendly) {
      return (
        <View className="flex-row items-center overflow-hidden rounded-[3px] bg-popover">
          <Pressable
            accessibilityLabel="Decrease quantity"
            className="size-11 items-center justify-center active:bg-card-panel"
            onPress={handleDecrement}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" className="accent-foreground" />
            ) : (
              <ThemedIcon icon={MinusIcon} size={16} color="foreground" />
            )}
          </Pressable>
          <CompactStepDivider />
          <Text className="min-w-9 px-1.5 text-center font-mono text-sm font-normal tabular-nums text-foreground">
            {displayQuantity}
          </Text>
          <CompactStepDivider />
          <Pressable
            accessibilityLabel="Increase quantity"
            className="size-11 items-center justify-center active:bg-card-panel"
            onPress={() => {
              void hapticPress();
              onIncrement();
            }}
            disabled={loading}
          >
            <ThemedIcon icon={PlusIcon} size={16} color="foreground" />
          </Pressable>
        </View>
      );
    }

    return (
      <View className="flex-row items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-[3px] border-border bg-popover dark:border-border dark:bg-popover"
          onPress={handleDecrement}
          disabled={loading}
          accessibilityLabel="Decrease quantity"
        >
          <ButtonIcon className="size-3.5">
            <ThemedIcon icon={MinusIcon} size={14} color="foreground" />
          </ButtonIcon>
        </Button>
        <Text className="min-w-6 text-center text-[13px] font-normal tabular-nums text-foreground">
          {displayQuantity}
        </Text>
        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-[3px] border-border bg-popover dark:border-border dark:bg-popover"
          onPress={() => {
            void hapticPress();
            onIncrement();
          }}
          disabled={loading}
          accessibilityLabel="Increase quantity"
        >
          <ButtonIcon className="size-3.5">
            <ThemedIcon icon={PlusIcon} size={14} color="foreground" />
          </ButtonIcon>
        </Button>
      </View>
    );
  }

  return (
    <Stack className="gap-3.5 pt-1">
      <Stack direction="row" className="items-center justify-center gap-2.5">
        <Badge variant="outline" className="border-foreground/30 bg-foreground/5">
          <BadgeIcon>
            <ThemedIcon icon={CircleCheckIcon} size={14} color="ring" />
          </BadgeIcon>
          <BadgeText className="text-[11px] font-normal uppercase tracking-widest text-ring">
            In collection
          </BadgeText>
        </Badge>
      </Stack>

      <View className="flex-row items-center justify-center gap-4 py-1">
        <Button
          size="icon"
          variant="outline"
          className="size-11 rounded-[3px]"
          onPress={handleDecrement}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" className="accent-primary" />
          ) : (
            <ButtonIcon className="size-5">
              <ThemedIcon icon={MinusIcon} size={20} color="foreground" />
            </ButtonIcon>
          )}
        </Button>

        <Stack className="min-w-12 items-center">
          <Text className="text-[28px] font-extrabold tabular-nums text-foreground">
            {displayQuantity}
          </Text>
          <Text className="mt-0.5 text-[9px] font-normal uppercase tracking-widest text-muted-foreground">
            owned
          </Text>
        </Stack>

        <Button
          size="icon"
          variant="outline"
          className="size-11 rounded-[3px]"
          onPress={() => {
            void hapticPress();
            onIncrement();
          }}
          disabled={loading}
        >
          <ButtonIcon className="size-5">
            <ThemedIcon icon={PlusIcon} size={20} color="foreground" />
          </ButtonIcon>
        </Button>
      </View>

      <Separator />
      <Button variant="ghost" onPress={handleRemove} disabled={loading}>
        <ButtonIcon>
          <ThemedIcon icon={TrashIcon} size={15} color="muted-foreground" />
        </ButtonIcon>
        <ButtonText className="text-muted-foreground">
          Remove from collection
        </ButtonText>
      </Button>
    </Stack>
  );
}
