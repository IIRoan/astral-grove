import { useState, type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import {
  ThemedIcon,
  CardsThreeIcon,
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  HashIcon,
  LinkIcon,
  TrashIcon,
} from '@/components/icons';
import { useDeckShareCopy } from '@/components/deck/DeckShareMenu';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import type { DeckState } from '@/lib/deck-types';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

interface DeckToolbarOverflowMenuProps {
  deck: DeckState;
  onImport?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  duplicateBusy?: boolean;
}

/**
 * Mobile deck-builder "more" menu: folds import, share (copy) and manage actions into one
 * 36pt trigger so the toolbar fits narrow phones and iPad Slide Over.
 */
export function DeckToolbarOverflowMenu({
  deck,
  onImport,
  onDuplicate,
  onDelete,
  duplicateBusy = false,
}: DeckToolbarOverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const copy = useDeckShareCopy(deck);

  return (
    <View className="relative shrink-0">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Deck options"
            accessibilityState={{ expanded: open }}
            className={cn(
              'size-9 shrink-0 items-center justify-center rounded-[3px] border border-border bg-card active:bg-card-panel',
              open && 'border-foreground'
            )}
            onPress={(event) => {
              event.stopPropagation?.();
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
            {onImport ? (
              <OverflowItem
                icon={DownloadIcon}
                label="Import deck list"
                onPress={() => {
                  hapticPress();
                  onImport();
                }}
              />
            ) : null}

            <Text className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Copy
            </Text>
            <OverflowItem
              icon={LinkIcon}
              label="The Astral Grove link"
              accessibilityLabel="Copy The Astral Grove link"
              onPress={() => copy('link')}
            />
            <OverflowItem
              icon={HashIcon}
              label="Deck code"
              accessibilityLabel="Copy deck code"
              onPress={() => copy('code')}
            />
            <OverflowItem
              icon={CardsThreeIcon}
              label="TTS"
              accessibilityLabel="Copy TTS list"
              onPress={() => copy('tts')}
            />

            {onDuplicate || onDelete ? (
              <Text className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Manage
              </Text>
            ) : null}
            {onDuplicate ? (
              <OverflowItem
                icon={CopyIcon}
                label={duplicateBusy ? 'Duplicating…' : 'Duplicate deck'}
                accessibilityLabel="Duplicate deck"
                disabled={duplicateBusy}
                onPress={() => {
                  hapticPress();
                  onDuplicate();
                }}
              />
            ) : null}
            {onDelete ? (
              <OverflowItem
                icon={TrashIcon}
                label="Delete deck"
                destructive
                onPress={() => {
                  hapticPress();
                  onDelete();
                }}
              />
            ) : null}
          </PopoverContent>
        </PopoverPortal>
      </Popover>
    </View>
  );
}

function OverflowItem({
  icon,
  label,
  accessibilityLabel,
  disabled = false,
  destructive = false,
  onPress,
}: {
  icon: ComponentProps<typeof ThemedIcon>['icon'];
  label: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <PopoverClose asChild>
      <Pressable
        accessibilityRole="menuitem"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        className={cn(
          'flex-row items-center gap-2 rounded-[3px] px-2 py-1.5',
          destructive ? 'active:bg-destructive/10' : 'active:bg-card-panel'
        )}
        onPress={onPress}
      >
        <ThemedIcon icon={icon} size={16} color="muted-foreground" />
        <Text
          className={cn(
            'text-sm',
            destructive ? 'text-destructive' : 'text-popover-foreground'
          )}
        >
          {label}
        </Text>
      </Pressable>
    </PopoverClose>
  );
}
