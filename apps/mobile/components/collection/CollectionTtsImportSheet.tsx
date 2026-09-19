import { useState } from 'react';
import { View } from 'react-native';
import type { CollectionImportPreviewResponse } from '@riftbound/contracts';
import {
  AppSheet,
  AppSheetContent,
  AppSheetFooter,
  AppSheetHeader,
  AppSheetOverlay,
  AppSheetPortal,
  AppSheetScrollView,
  AppSheetTitle,
} from '@/components/ui/app-sheet';
import { Button, ButtonText } from '@/components/ui/button';
import { ImportPreviewBody } from '@/components/collection/ImportPreviewBody';
import { TextareaInput } from '@/components/ui/textarea-input';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast.api';

type PreviewData = CollectionImportPreviewResponse['data'];

type Step = 'paste' | 'preview';

export function CollectionTtsImportSheet({
  open,
  onClose,
  previewPending,
  acceptPending,
  onPreview,
  onAccept,
}: {
  open: boolean;
  onClose: () => void;
  previewPending: boolean;
  acceptPending: boolean;
  onPreview: (tts: string) => Promise<PreviewData>;
  onAccept: (items: PreviewData['items']) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>('paste');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('paste');
      setText('');
      setPreview(null);
    }
  }

  const busy = previewPending || acceptPending;
  const canPreview = text.trim().length > 0 && !busy;
  const canAccept = Boolean(preview && preview.items.length > 0 && !busy);

  const handlePreview = async () => {
    if (!text.trim()) {
      toast.error('Paste a TTS card list to preview.');
      return;
    }
    try {
      const result = await onPreview(text);
      setPreview(result);
      setStep('preview');
      if (result.items.length === 0) {
        toast.warning('No resolvable cards in that list.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not preview import.');
    }
  };

  const handleAccept = async () => {
    if (!preview || preview.items.length === 0) return;
    try {
      await onAccept(preview.items);
      toast.success(
        `Added ${preview.totalCopies.toLocaleString()} copies across ${preview.uniquePrintings.toLocaleString()} printings.`
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not import cards.');
    }
  };

  return (
    <AppSheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      dismissible={!busy}
    >
      <AppSheetPortal name="collection-tts-import">
        <AppSheetOverlay />
        <AppSheetContent snapPoints={['90%']}>
          <AppSheetHeader>
            <AppSheetTitle>
              {step === 'paste' ? 'Import TTS list' : 'Review import'}
            </AppSheetTitle>
          </AppSheetHeader>

          <AppSheetScrollView
            contentContainerStyle={{ gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {step === 'paste' ? (
              <>
                <Text className="text-sm leading-snug text-muted-foreground">
                  Paste a Tabletop Simulator export from Piltover Archive. Each code is
                  one physical copy — for example{' '}
                  <Text className="font-mono text-[12px] text-foreground">
                    OGN-166-2
                  </Text>{' '}
                  is Chaos Rune alternate art. The trailing digit is art variant (1 =
                  base, 2 = a, 3 = b). Nothing is written until you confirm the preview;
                  quantities are added on top of what you already own.
                </Text>
                <TextareaInput
                  value={text}
                  onChangeText={setText}
                  disabled={busy}
                  multiline
                  numberOfLines={12}
                  className="min-h-56 font-mono text-xs leading-5"
                  placeholder="OGN-166-2 OGN-166-2 OGS-017-1 …"
                />
              </>
            ) : preview ? (
              <ImportPreviewBody preview={preview} />
            ) : null}
          </AppSheetScrollView>

          <AppSheetFooter>
            {step === 'paste' ? (
              <View className="w-full flex-row items-center gap-2">
                <Button
                  variant="outline"
                  className="w-auto flex-1"
                  onPress={onClose}
                  disabled={busy}
                >
                  <ButtonText>Cancel</ButtonText>
                </Button>
                <Button
                  className="w-auto flex-[1.4]"
                  busy={previewPending}
                  disabled={!canPreview}
                  onPress={() => void handlePreview()}
                >
                  <ButtonText>{previewPending ? 'Previewing…' : 'Preview'}</ButtonText>
                </Button>
              </View>
            ) : (
              <View className="w-full flex-row items-center gap-2">
                <Button
                  variant="outline"
                  className="w-auto flex-1"
                  onPress={() => setStep('paste')}
                  disabled={busy}
                >
                  <ButtonText>Back</ButtonText>
                </Button>
                <Button
                  className="w-auto flex-[1.4]"
                  busy={acceptPending}
                  disabled={!canAccept}
                  onPress={() => void handleAccept()}
                >
                  <ButtonText>
                    {acceptPending ? 'Importing…' : 'Confirm import'}
                  </ButtonText>
                </Button>
              </View>
            )}
          </AppSheetFooter>
        </AppSheetContent>
      </AppSheetPortal>
    </AppSheet>
  );
}
