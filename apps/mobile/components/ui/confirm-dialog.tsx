import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {
  AppSheet,
  AppSheetBody,
  AppSheetContent,
  AppSheetHeader,
  AppSheetOverlay,
  AppSheetPortal,
  AppSheetTitle,
} from '@/components/ui/app-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { hapticPress } from '@/utils/haptics';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'destructive';
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const close = useCallback(() => {
    if (busy) return;
    onOpenChange(false);
  }, [busy, onOpenChange]);

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    hapticPress();
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }, [busy, onConfirm, onOpenChange]);

  const destructive = tone === 'destructive';

  return (
    <AppSheet open={open} onOpenChange={onOpenChange} dismissible={!busy}>
      <AppSheetPortal name="confirm-dialog">
        <AppSheetOverlay />
        <AppSheetContent>
          <AppSheetHeader>
            <AppSheetTitle>{title}</AppSheetTitle>
          </AppSheetHeader>
          <AppSheetBody className="gap-3 pb-4">
            <Text className="text-sm leading-5 text-muted-foreground">
              {description}
            </Text>
            <View className="gap-2 pt-1">
              <Button
                variant={destructive ? 'destructive' : 'default'}
                disabled={busy}
                onPress={() => {
                  void handleConfirm();
                }}
              >
                {busy ? (
                  <ActivityIndicator
                    size="small"
                    className={destructive ? 'accent-white' : 'accent-cta-foreground'}
                  />
                ) : (
                  <ButtonText>{confirmLabel}</ButtonText>
                )}
              </Button>

              <Button
                variant="outline"
                disabled={busy}
                onPress={() => {
                  hapticPress();
                  close();
                }}
              >
                <ButtonText>{cancelLabel}</ButtonText>
              </Button>
            </View>
          </AppSheetBody>
        </AppSheetContent>
      </AppSheetPortal>
    </AppSheet>
  );
}
