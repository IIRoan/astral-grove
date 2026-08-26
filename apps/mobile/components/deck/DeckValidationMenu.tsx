import { ChevronDownIcon, ChevronUpIcon, ThemedIcon } from '@/components/icons';
import { Pressable, View } from 'react-native';
import {
  Popover,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { deckValidationHeadline } from '@/components/deck/deckValidationMenu.utils';
import type { DeckValidationMessage } from '@/lib/deck-types';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

function messageTone(type: DeckValidationMessage['type']) {
  if (type === 'error') {
    return {
      dot: 'bg-destructive',
      text: 'text-foreground',
    };
  }
  if (type === 'warning') {
    return {
      dot: 'bg-warning',
      text: 'text-foreground',
    };
  }
  return {
    dot: 'bg-success',
    text: 'text-muted-foreground',
  };
}

function triggerTone(status: 'valid' | 'warning' | 'error') {
  if (status === 'error') {
    return {
      border: 'border-border',
      bg: 'bg-card',
      ink: 'text-destructive',
    };
  }
  if (status === 'warning') {
    return {
      border: 'border-border',
      bg: 'bg-card',
      ink: 'text-foreground',
    };
  }
  return {
    border: 'border-border',
    bg: 'bg-card',
    ink: 'text-foreground',
  };
}

interface DeckValidationMenuProps {
  messages: DeckValidationMessage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showLabel?: boolean;
  align?: 'start' | 'end' | 'stretch';
  className?: string;
}

export function DeckValidationMenu({
  messages,
  open,
  onOpenChange,
  showLabel = true,
  align = 'end',
  className,
}: DeckValidationMenuProps) {
  if (messages.length === 0) return null;

  const headline = deckValidationHeadline(messages);
  const tone = triggerTone(headline.status);
  const popoverAlign = align === 'start' ? 'start' : 'end';

  return (
    <View className={cn('relative shrink-0', className)}>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`Deck validation: ${headline.label}`}
            className={cn(
              'h-9 flex-row items-center rounded-[3px] border active:bg-card-panel',
              showLabel ? 'gap-1.5 px-2.5' : 'min-w-9 justify-center gap-1 px-1.5',
              tone.border,
              tone.bg,
              open && 'border-foreground'
            )}
            onPress={() => {
              hapticPress();
            }}
          >
            <View
              className={cn(
                'size-1.5 rounded-full',
                headline.status === 'error' && 'bg-destructive',
                headline.status === 'warning' && 'bg-warning',
                headline.status === 'valid' && 'bg-success'
              )}
            />
            {showLabel ? (
              <Text className={cn('text-[12px] font-normal', tone.ink)}>
                {headline.label}
              </Text>
            ) : (
              <Text
                className={cn(
                  'font-mono text-[12px] font-normal tabular-nums',
                  tone.ink
                )}
              >
                {messages.length}
              </Text>
            )}
            <ThemedIcon
              icon={open ? ChevronUpIcon : ChevronDownIcon}
              size={14}
              color="muted-foreground"
            />
          </Pressable>
        </PopoverTrigger>

        <PopoverPortal name="deck-validation-menu">
          <PopoverOverlay className="bg-transparent" closeOnPress />
          <PopoverContent
            side="bottom"
            align={popoverAlign}
            sideOffset={6}
            width={align === 'stretch' ? 'trigger' : 'fit'}
            className={cn(
              'z-50 overflow-hidden rounded-[10px] border border-border bg-popover p-0 shadow-none',
              align !== 'stretch' && 'w-[min(19rem,calc(100vw-2rem))]'
            )}
          >
            <View className="border-b border-border px-3 py-2.5">
              <Text className="text-[13px] font-normal text-foreground">
                {headline.label}
              </Text>
              <Text className="mt-0.5 text-[12px] text-muted-foreground">
                Fix these before the list is tournament-ready.
              </Text>
            </View>

            <View className="py-1">
              {messages.map((message, index) => {
                const row = messageTone(message.type);
                return (
                  <View
                    key={message.message}
                    className={cn(
                      'flex-row items-start gap-2.5 px-3 py-2.5',
                      index < messages.length - 1 && 'border-b border-border/60'
                    )}
                  >
                    <View
                      className={cn('mt-1.5 size-1.5 shrink-0 rounded-[3px]', row.dot)}
                    />
                    <Text
                      className={cn('min-w-0 flex-1 text-[13px] leading-snug', row.text)}
                    >
                      {message.message}
                    </Text>
                  </View>
                );
              })}
            </View>
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </View>
  );
}
