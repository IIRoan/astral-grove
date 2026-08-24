import type { ReactNode } from 'react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { CalendarPlusIcon } from '@/components/icons';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { DECK_FORMAT_OPTIONS, type DeckFormat } from '@riftbound/contracts';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface DeckCreateMenuProps {
  onCreate: (format: DeckFormat) => Promise<void>;
  children?: ReactNode;
  className?: string;
}

export function DeckCreateMenu({ onCreate, children, className }: DeckCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSelect = async (format: DeckFormat) => {
    if (busy) return;
    hapticPress();
    setBusy(true);
    try {
      await onCreate(format);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const trigger = children ?? (
    <Button className="w-auto" disabled={busy}>
      {busy ? (
        <ActivityIndicator />
      ) : (
        <>
          <ButtonIcon>
            <CalendarPlusIcon className="size-4 text-cta-foreground" />
          </ButtonIcon>
          <ButtonText>New</ButtonText>
        </>
      )}
    </Button>
  );

  return (
    <View className={cn('relative shrink-0', className)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <PopoverTrigger asChild disabled={busy}>
          {trigger}
        </PopoverTrigger>

        <PopoverPortal>
          <PopoverOverlay className="bg-transparent" closeOnPress />
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={4}
            width={288}
            className="z-50 overflow-hidden rounded-[3px] border border-border bg-popover p-1 shadow-none"
          >
            <Text className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Deck format
            </Text>

            {DECK_FORMAT_OPTIONS.map((option) => (
              <PopoverClose key={option.value} asChild>
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityLabel={`Create ${option.label} deck`}
                  className="rounded-[3px] px-2 py-1.5 active:bg-card-panel"
                  onPress={() => void handleSelect(option.value)}
                >
                  <Text className="text-sm text-popover-foreground">
                    {option.label}
                  </Text>
                  <Text
                    className="text-[11px] leading-4 text-muted-foreground"
                    numberOfLines={2}
                  >
                    {option.description}
                  </Text>
                </Pressable>
              </PopoverClose>
            ))}
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </View>
  );
}
