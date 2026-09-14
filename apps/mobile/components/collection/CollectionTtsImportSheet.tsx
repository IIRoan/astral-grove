import { useState } from 'react';
import { View } from 'react-native';
import type { CollectionImportPreviewResponse } from '@riftbound/contracts';
import { CardArtImage } from '@/components/cards/CardArtImage';
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
import { TextareaInput } from '@/components/ui/textarea-input';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/toast.api';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { cn } from '@/lib/utils';
import { resolveImageUrl } from '@/utils/resolveImageUrl';

type PreviewData = CollectionImportPreviewResponse['data'];

type Step = 'paste' | 'preview';

const PREVIEW_THUMB_WIDTH = 48;

function formatQtyChange(change: PreviewData['changes'][number]): string {
  if (change.status === 'new') {
    return `0 → ${String(change.quantityAfter)}`;
  }
  return `${String(change.quantityBefore)} → ${String(change.quantityAfter)}`;
}

function statusLabel(status: PreviewData['changes'][number]['status']): string {
  switch (status) {
    case 'new':
      return 'New';
    case 'increase':
      return 'Add';
    case 'decrease':
      return 'Reduce';
    case 'unchanged':
      return 'Same';
  }
}

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
                  Paste a Tabletop Simulator export from Piltover Archive. Each
                  code is one physical copy — for example{' '}
                  <Text className="font-mono text-[12px] text-foreground">
                    OGN-166-2
                  </Text>{' '}
                  is Chaos Rune alternate art. The trailing digit is art variant
                  (1 = base, 2 = a, 3 = b). Nothing is written until you confirm
                  the preview; quantities are added on top of what you already
                  own.
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
              <PreviewBody preview={preview} />
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

function PreviewBody({ preview }: { preview: PreviewData }) {
  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <Text className="text-sm leading-snug text-muted-foreground">
          Adding {preview.totalCopies.toLocaleString()} copies across{' '}
          {preview.uniquePrintings.toLocaleString()} printings
          {preview.unresolvedCount > 0
            ? ` · ${preview.unresolvedCount.toLocaleString()} could not be matched`
            : ''}
          .
        </Text>
        <Text className="font-mono text-[11px] text-muted-foreground">
          {preview.newCount.toLocaleString()} new printings ·{' '}
          {preview.increasedCount.toLocaleString()} already owned ·{' '}
          {preview.totalTokens.toLocaleString()} total cards in the paste
        </Text>
      </View>

      {preview.changes.length > 0 ? (
        <View className="overflow-hidden rounded-[3px] border border-border">
          {preview.changes.map((change, index) => (
            <View
              key={change.variantNumber}
              className={cn(
                'flex-row items-center gap-3 px-3 py-2',
                index > 0 && 'border-t border-border'
              )}
            >
              <PreviewThumb change={change} />
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                  {change.name ?? change.variantNumber}
                </Text>
                <Text className="font-mono text-[11px] text-muted-foreground">
                  {change.setCode ? `${change.setCode} · ` : ''}
                  {change.variantNumber}
                </Text>
              </View>
              <View className="items-end gap-0.5">
                <Text className="font-mono text-[12px] tabular-nums text-foreground">
                  {formatQtyChange(change)}
                </Text>
                <Text className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {statusLabel(change.status)} · +{String(change.quantityDelta)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {preview.unresolved.length > 0 ? (
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Unresolved</Text>
          {preview.unresolved.map((row) => (
            <Text
              key={`${row.token}-${row.message}`}
              className="font-mono text-[11px] leading-relaxed text-destructive"
            >
              {row.token}: {row.message}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PreviewThumb({ change }: { change: PreviewData['changes'][number] }) {
  const uri = change.imageUrl ? resolveImageUrl(change.imageUrl) : '';
  return (
    <View
      className={cn(
        'h-14 w-10 shrink-0 overflow-hidden border border-border bg-card-panel',
        CARD_ART_RADIUS_CLASS
      )}
    >
      {uri ? (
        <CardArtImage
          uri={uri}
          recyclingKey={change.variantNumber}
          className="h-full w-full"
          contentFit="cover"
          contentPosition="top"
          transition={0}
          priority="low"
          instant
          thumbWidth={PREVIEW_THUMB_WIDTH}
        />
      ) : null}
    </View>
  );
}
