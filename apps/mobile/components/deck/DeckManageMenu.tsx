import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ThemedIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  TrashIcon,
} from '@/components/icons';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface DeckManageMenuProps {
  onDuplicate?: () => void;
  onDelete?: () => void;
  duplicateBusy?: boolean;
  className?: string;
  triggerClassName?: string;
}

export function DeckManageMenu({
  onDuplicate,
  onDelete,
  duplicateBusy = false,
  className,
  triggerClassName,
}: DeckManageMenuProps) {
  const [open, setOpen] = useState(false);

  if (!onDuplicate && !onDelete) return null;

  return (
    <View className={cn('relative shrink-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deck options"
            accessibilityState={{ expanded: open, disabled: duplicateBusy }}
            disabled={duplicateBusy}
            className={cn(
              'size-9 shrink-0 items-center justify-center rounded-[3px] border border-border bg-card active:bg-card-panel',
              open && 'border-foreground',
              duplicateBusy && 'opacity-50',
              triggerClassName
            )}
            onPress={() => {
              hapticPress();
            }}
          >
            <ThemedIcon icon={EllipsisVerticalIcon} size={18} color="foreground" />
          </Pressable>
        </PopoverTrigger>

        <PopoverPortal>
          <PopoverOverlay className="bg-transparent" closeOnPress />
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={4}
            className="z-50 min-w-[11.5rem] overflow-hidden rounded-[3px] border border-border bg-popover p-1 shadow-none"
          >
            <Text className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Manage
            </Text>

            {onDuplicate ? (
              <PopoverClose asChild>
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityLabel="Duplicate deck"
                  accessibilityState={{ disabled: duplicateBusy, busy: duplicateBusy }}
                  disabled={duplicateBusy}
                  className="flex-row items-center gap-2 rounded-[3px] px-2 py-1.5 active:bg-card-panel"
                  onPress={() => {
                    hapticPress();
                    onDuplicate();
                  }}
                >
                  <ThemedIcon icon={CopyIcon} size={16} color="muted-foreground" />
                  <Text className="text-sm text-popover-foreground">
                    {duplicateBusy ? 'Duplicating…' : 'Duplicate deck'}
                  </Text>
                </Pressable>
              </PopoverClose>
            ) : null}

            {onDelete ? (
              <PopoverClose asChild>
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityLabel="Delete deck"
                  className="flex-row items-center gap-2 rounded-[3px] px-2 py-1.5 active:bg-destructive/10"
                  onPress={() => {
                    hapticPress();
                    onDelete();
                  }}
                >
                  <ThemedIcon icon={TrashIcon} size={16} color="muted-foreground" />
                  <Text className="text-sm text-destructive">Delete deck</Text>
                </Pressable>
              </PopoverClose>
            ) : null}
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </View>
  );
}
