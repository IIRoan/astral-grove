import * as Clipboard from 'expo-clipboard';
import { Platform, Pressable, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ThemedIcon,
  CardsThreeIcon,
  HashIcon,
  LinkIcon,
  ShareIcon,
} from '@/components/icons';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast.api';
import { resolveDeckSharePayload, type DeckShareFormat } from '@/lib/deck-share';
import type { DeckState } from '@/lib/deck-types';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';
import { flushRemoteDeckSave } from '@/services/deckService';
import { updateDeckSharing } from '@/services/remoteDeckService';
import { deckQueryKeys } from '@/src/api/queryKeys';

function copiedToast(format: DeckShareFormat): string {
  if (format === 'link') return 'Deck link copied';
  if (format === 'tts') return 'TTS list copied';
  return 'Deck code copied';
}

async function copySharePayload(value: string, format: DeckShareFormat): Promise<void> {
  const copied = await Clipboard.setStringAsync(value);
  if (!copied) throw new Error('Clipboard copy failed');
  toast.success(copiedToast(format));
}

interface DeckShareMenuProps {
  deck: DeckState;
  className?: string;
  triggerClassName?: string;
}

/** Resolve + copy a share payload for `deck`; shared by the share menu and the mobile overflow menu. */
export function useDeckShareCopy(deck: DeckState) {
  const queryClient = useQueryClient();
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

  const sharing = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (enabled) await flushRemoteDeckSave(deck.id);
      return updateDeckSharing(deck.id, enabled);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<DeckState | null>(
        deckQueryKeys.detail(deck.id),
        (current) =>
          current ? { ...current, shareToken: saved.shareToken ?? null } : current
      );
    },
    onError: () => toast.error('Could not update deck access. Please try again.'),
  });

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

  return {
    copy: handleSelect,
    sharing,
    linkDisabled: !deck.readOnly && (!deck.shareToken || sharing.isPending),
  };
}

export function DeckLinkAccessOption({
  deck,
  busy,
  onToggle,
}: {
  deck: DeckState;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  if (deck.readOnly) return null;
  const enabled = Boolean(deck.shareToken);
  return (
    <View className="flex-row items-center gap-3 border-b border-border px-2 py-2">
      <View className="flex-1">
        <Text className="text-sm text-popover-foreground">Anyone with the link</Text>
        <Text className="text-xs text-muted-foreground">
          {busy
            ? 'Updating access…'
            : enabled
              ? 'View only · No sign-in needed'
              : 'Private · Only you can view'}
        </Text>
      </View>
      <Button
        accessibilityRole="switch"
        accessibilityLabel="Anyone with the link"
        aria-checked={enabled}
        accessibilityState={{ checked: enabled, disabled: busy, busy }}
        disabled={busy}
        variant={enabled ? 'default' : 'secondary'}
        size="icon-sm"
        hitSlop={12}
        className={cn(
          'h-6 min-h-0 w-11 rounded-full border px-1',
          enabled ? 'justify-end border-cta' : 'justify-start border-border'
        )}
        onPress={() => onToggle(!enabled)}
      >
        <View
          className={cn(
            'size-4 rounded-full',
            enabled ? 'bg-cta-foreground' : 'bg-muted-foreground'
          )}
        />
      </Button>
    </View>
  );
}

export function DeckShareMenu({
  deck,
  className,
  triggerClassName,
}: DeckShareMenuProps) {
  const [open, setOpen] = useState(false);
  const { copy: handleSelect, sharing, linkDisabled } = useDeckShareCopy(deck);

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
            width={256}
            className="z-50 min-w-[11rem] overflow-hidden rounded-[3px] border border-border bg-popover p-1 shadow-none"
          >
            <DeckLinkAccessOption
              deck={deck}
              busy={sharing.isPending}
              onToggle={sharing.mutate}
            />
            <Text className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Share
            </Text>

            <PopoverClose asChild>
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel="Copy The Astral Grove link"
                disabled={linkDisabled}
                accessibilityState={{ disabled: linkDisabled }}
                className={cn(
                  'flex-row items-center gap-2 rounded-[3px] px-2 py-1.5 active:bg-card-panel',
                  linkDisabled && 'opacity-50'
                )}
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
