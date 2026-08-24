import { ThemedIcon, UploadIcon } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
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
import { TextareaInput } from '@/components/ui/textarea-input';
import { Text } from '@/components/ui/text';
import type { DeckFormat } from '@riftbound/contracts';
import { DeckFormatSegmentedControl } from '@/components/deck/DeckFormatSegmentedControl';
import { importDeckText } from '@/lib/deck-io';
import { createDeckId } from '@/lib/deck-card';
import type { DeckState } from '@/lib/deck-types';
import {
  resolveDeckCardByName,
  resolveDeckCardByVariant,
} from '@/hooks/useDeckCardResolver';
import { toast } from '@/components/ui/toast.api';
import { DeckImportLoadingOverlay } from '@/components/deck/DeckImportLoadingOverlay';

interface DeckImportExportSheetProps {
  open: boolean;
  /** Kept for call-site compatibility; only import is supported. */
  mode?: 'import';
  deck: DeckState;
  onClose: () => void;
  onImport: (deck: DeckState) => void | Promise<void>;
  /** When true, import creates a new deck identity instead of merging into `deck`. */
  asNewDeck?: boolean;
}

function countDeckListLines(text: string): number {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function DeckImportExportSheet({
  open,
  deck,
  onClose,
  onImport,
  asNewDeck = false,
}: DeckImportExportSheetProps) {
  const [text, setText] = useState('');
  const [format, setFormat] = useState<DeckFormat>('constructed');
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText('');
      setFormat('constructed');
    }
  }

  const lineCount = useMemo(() => countDeckListLines(text), [text]);
  const canImport = text.trim().length > 0 && !busy;

  const handleImport = async () => {
    if (!text.trim()) {
      toast.error('Paste a deck list or deck code to import.');
      return;
    }

    setBusy(true);
    try {
      const { deck: imported, unresolved } = await importDeckText(
        text,
        resolveDeckCardByName,
        resolveDeckCardByVariant
      );
      const now = Date.now();
      const payload: DeckState = asNewDeck
        ? {
            ...imported,
            id: createDeckId(),
            format,
            name:
              imported.legend?.name != null && imported.legend.name.length > 0
                ? `${imported.legend.name} deck`
                : 'Imported deck',
            createdAt: now,
            updatedAt: now,
          }
        : {
            ...imported,
            id: deck.id,
            name: deck.name,
            createdAt: deck.createdAt,
            format,
          };

      await Promise.resolve(onImport(payload));

      if (unresolved.length > 0) {
        toast.warning(`Imported with ${unresolved.length} unresolved card(s).`);
      } else {
        toast.success('Deck imported.');
      }
      onClose();
    } catch {
      toast.error('Could not import deck list or code.');
    } finally {
      setBusy(false);
    }
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/plain', 'text/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const fileUri = result.assets[0].uri;
    const contents = await FileSystem.readAsStringAsync(fileUri);
    setText(contents);
  };

  return (
    <>
      <DeckImportLoadingOverlay visible={busy} message="Importing deck…" />
      <AppSheet
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
        dismissible={!busy}
      >
        <AppSheetPortal name="deck-import">
          <AppSheetOverlay />
          <AppSheetContent>
            <AppSheetHeader>
              <AppSheetTitle>Import deck</AppSheetTitle>
            </AppSheetHeader>
            <AppSheetBody className="gap-5 pb-2">
              <Text className="text-sm leading-snug text-muted-foreground">
                {asNewDeck
                  ? 'Paste a deck list or code to create a new deck in your collection.'
                  : `Replace cards in “${deck.name}” from a pasted list or deck code.`}
              </Text>

              <View className="gap-2">
                <Text className="text-sm font-normal text-foreground">Format</Text>
                <DeckFormatSegmentedControl
                  value={format}
                  onChange={setFormat}
                  disabled={busy}
                />
              </View>

              <View className="gap-2">
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="text-sm font-normal text-foreground">Deck list</Text>
                  {lineCount > 0 ? (
                    <Text className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {lineCount} line{lineCount === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </View>
                <TextareaInput
                  value={text}
                  onChangeText={setText}
                  disabled={busy}
                  multiline
                  numberOfLines={10}
                  className="min-h-48 font-mono text-xs leading-5"
                  placeholder={
                    'Deck code, or:\nLegend:\nIrelia, Blade Dancer\n\nMain Deck:\n3 En Garde (SFD-001)\n...'
                  }
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose text file"
                  disabled={busy}
                  className="self-start flex-row items-center gap-1.5 rounded-[3px] px-1 py-1 active:opacity-70"
                  onPress={() => void handlePickFile()}
                >
                  <ThemedIcon icon={UploadIcon} size={15} color="foreground" />
                  <Text className="text-[13px] font-medium text-foreground">
                    Choose text file
                  </Text>
                </Pressable>
              </View>

              <Text className="text-[12px] leading-4 text-muted-foreground">
                Supports Piltover Archive deck codes, section headers, or flat lines
                like{' '}
                <Text className="font-mono text-[11px] text-foreground">
                  3 Card Name (SET-123)
                </Text>
                .
              </Text>
            </AppSheetBody>
            <AppSheetFooter>
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
                  busy={busy}
                  disabled={!canImport}
                  onPress={() => void handleImport()}
                >
                  <ButtonText>{busy ? 'Importing…' : 'Import deck'}</ButtonText>
                </Button>
              </View>
            </AppSheetFooter>
          </AppSheetContent>
        </AppSheetPortal>
      </AppSheet>
    </>
  );
}
