import * as Clipboard from 'expo-clipboard';
import { Platform, Pressable, View } from 'react-native';
import { useMemo, useState } from 'react';
import { ThemedIcon, CardsThreeIcon, HashIcon, LinkIcon, ShareIcon } from '@/components/icons';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast.api';
import {
  resolveDeckSharePayload,
  type DeckShareFormat,
} from '@/lib/deck-share';
import type { DeckState } from '@/lib/deck-types';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

function copiedToast(format: DeckShareFormat): string {
  if (format === 'link') return 'Deck link copied';
  if (format === 'tts') return 'TTS list copied';
  return 'Deck code copied';
}

async function copySharePayload(value: string, format: DeckShareFormat): Promise<void> {
  await Clipboard.setStringAsync(value);
  toast.success(copiedToast(format));
}

interface DeckShareMenuProps {
  deck: DeckState;
  className?: string;
  triggerClassName?: string;
}

export function DeckShareMenu({
  deck,
  className,
  triggerClassName,
}: DeckShareMenuProps) {
  const [open, setOpen] = useState(false);

  const webOrigin = useMemo(() => {
    if (
      Platform.OS === 'web' &&
      typeof globalThis !== 'undefined' &&
      'location' in globalThis
    ) {
      return (globalThis as { location?: { origin?: string } }).location?.origin;
    }
    return undefined;
  }, []);

  const handleSelect = (format: DeckShareFormat) => {
    hapticPress();
    const result = resolveDeckSharePayload(deck, format, webOrigin);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    void copySharePayload(result.value, format).catch(() => {
      toast.error('Could not copy to clipboard.');
    });
  };

  return (
    <View className={cn('relative shrink-0', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share deck"
            accessibilityState={{ expanded: open }}
            className={cn(
              'size-9 shrink-0 items-center justify-center rounded-[3px] border border-border bg-card active:bg-card-panel',
              open && 'border-foreground',
              triggerClassName
            )}
            onPress={() => {
              hapticPress();
            }}
          >
            <ThemedIcon icon={ShareIcon} size={18} color="foreground" />
          </Pressable>
        </PopoverTrigger>

        <PopoverPortal>
          <PopoverOverlay className="bg-transparent" closeOnPress />
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={4}
            className="z-50 min-w-[11rem] overflow-hidden rounded-[3px] border border-border bg-popover p-1 shadow-none"
          >
            <Text className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Copy
            </Text>

            <PopoverClose asChild>
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel="Copy The Astral Grove link"
                className="flex-row items-center gap-2 rounded-[3px] px-2 py-1.5 active:bg-card-panel"
                onPress={() => handleSelect('link')}
              >
                <ThemedIcon icon={LinkIcon} size={16} color="muted-foreground" />
                <Text className="text-sm text-popover-foreground">
                  The Astral Grove link
                </Text>
              </Pressable>
            </PopoverClose>

            <PopoverClose asChild>
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel="Copy deck code"
                className="flex-row items-center gap-2 rounded-[3px] px-2 py-1.5 active:bg-card-panel"
                onPress={() => handleSelect('code')}
              >
                <ThemedIcon icon={HashIcon} size={16} color="muted-foreground" />
                <Text className="text-sm text-popover-foreground">Deck code</Text>
              </Pressable>
            </PopoverClose>

            <PopoverClose asChild>
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel="Copy TTS list"
                className="flex-row items-center gap-2 rounded-[3px] px-2 py-1.5 active:bg-card-panel"
                onPress={() => handleSelect('tts')}
              >
                <ThemedIcon icon={CardsThreeIcon} size={16} color="muted-foreground" />
                <Text className="text-sm text-popover-foreground">TTS</Text>
              </Pressable>
            </PopoverClose>
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </View>
  );
}
