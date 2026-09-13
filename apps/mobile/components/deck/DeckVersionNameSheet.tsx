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
import { TextInput } from '@/components/ui/text-input';
import { Text } from '@/components/ui/text';
import { hapticPress } from '@/utils/haptics';

interface DeckVersionNameSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  initialName?: string;
  onConfirm: (name: string) => void | Promise<void>;
}

export function DeckVersionNameSheet({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  initialName = '',
  onConfirm,
}: DeckVersionNameSheetProps) {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName(initialName);
  }, [initialName, open]);

  const close = useCallback(() => {
    if (!busy) onOpenChange(false);
  }, [busy, onOpenChange]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 60 && !busy;

  const handleConfirm = useCallback(async () => {
    if (!canSubmit) return;
    hapticPress();
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }, [canSubmit, onConfirm, onOpenChange, trimmed]);

  return (
    <AppSheet
      open={open}
      onOpenChange={(next) => (!next ? close() : onOpenChange(next))}
      dismissible={!busy}
    >
      <AppSheetPortal name="deck-version-name">
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
              <Text className="text-sm font-normal text-foreground">Version name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Post-ban"
                autoFocus
                maxLength={60}
                disabled={busy}
                onSubmitEditing={() => void handleConfirm()}
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
                disabled={!canSubmit}
                onPress={() => void handleConfirm()}
              >
                <ButtonText>{busy ? 'Saving…' : confirmLabel}</ButtonText>
              </Button>
            </View>
          </AppSheetFooter>
        </AppSheetContent>
      </AppSheetPortal>
    </AppSheet>
  );
}
