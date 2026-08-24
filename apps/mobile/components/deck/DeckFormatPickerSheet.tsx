import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  AppSheet,
  AppSheetBody,
  AppSheetContent,
  AppSheetFooter,
  AppSheetHeader,
  AppSheetOverlay,
  AppSheetPortal,
  AppSheetTitle,
} from '@/components/ui/app-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DeckFormatSegmentedControl } from '@/components/deck/DeckFormatSegmentedControl';
import type { DeckFormat } from '@riftbound/contracts';
import { hapticPress } from '@/utils/haptics';

interface DeckFormatPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  defaultFormat?: DeckFormat;
  onConfirm: (format: DeckFormat) => void | Promise<void>;
}

export function DeckFormatPickerSheet({
  open,
  onOpenChange,
  title = 'Deck format',
  description = 'Choose which ruleset this deck should use.',
  confirmLabel = 'Continue',
  defaultFormat = 'constructed',
  onConfirm,
}: DeckFormatPickerSheetProps) {
  const [format, setFormat] = useState<DeckFormat>(defaultFormat);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setFormat(defaultFormat);
  }, [defaultFormat, open]);

  const close = useCallback(() => {
    if (!busy) onOpenChange(false);
  }, [busy, onOpenChange]);

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    hapticPress();
    setBusy(true);
    try {
      await onConfirm(format);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }, [busy, format, onConfirm, onOpenChange]);

  return (
    <AppSheet
      open={open}
      onOpenChange={(next) => (!next ? close() : onOpenChange(next))}
      dismissible={!busy}
    >
      <AppSheetPortal name="deck-format-picker">
        <AppSheetOverlay />
        <AppSheetContent>
          <AppSheetHeader>
            <AppSheetTitle>{title}</AppSheetTitle>
          </AppSheetHeader>
          <AppSheetBody className="gap-4 pb-2">
            <Text className="text-sm leading-snug text-muted-foreground">
              {description}
            </Text>
            <View className="gap-2">
              <Text className="text-sm font-normal text-foreground">Format</Text>
              <DeckFormatSegmentedControl
                value={format}
                onChange={setFormat}
                disabled={busy}
              />
            </View>
          </AppSheetBody>
          <AppSheetFooter>
            <View className="w-full flex-row items-center gap-2">
              <Button
                variant="outline"
                className="w-auto flex-1"
                onPress={close}
                disabled={busy}
              >
                <ButtonText>Cancel</ButtonText>
              </Button>
              <Button
                className="w-auto flex-[1.4]"
                busy={busy}
                disabled={busy}
                onPress={() => void handleConfirm()}
              >
                <ButtonText>{busy ? 'Working…' : confirmLabel}</ButtonText>
              </Button>
            </View>
          </AppSheetFooter>
        </AppSheetContent>
      </AppSheetPortal>
    </AppSheet>
  );
}
