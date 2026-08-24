import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppLoadingScreen } from '@/components/ui/app-loader';
import { DeckBuilderCanvas } from '@/components/deck/DeckBuilderCanvas';
import { DeckFormatPickerSheet } from '@/components/deck/DeckFormatPickerSheet';
import { DeckImportLoadingOverlay } from '@/components/deck/DeckImportLoadingOverlay';
import { LegendPicker } from '@/components/deck/LegendPicker';
import {
  ScreenLayout,
  ScreenLayoutBody,
  useScreenLayout,
} from '@/components/shell/ScreenLayout';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDeckAutoSave } from '@/hooks/useDeckAutoSave';
import { useDeckDetail } from '@/hooks/useDeckDetail';
import { useDeckMutations } from '@/hooks/useDecks';
import { addCardToDeck } from '@/lib/deck-card';
import {
  deckEditHref,
  deckViewHref,
  isDeckEditMode,
  leaveDeckEditMode,
  leaveDeckEditor,
} from '@/lib/deck-navigation';
import type { DeckCard } from '@/lib/deck-types';
import { hapticPress } from '@/utils/haptics';

type IoMode = 'import';

export default function DeckEditorScreen() {
  const router = useRouter();
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const { deck, isLoading, persist, flushSave } = useDeckDetail(id);
  const { importDeck, duplicateOwnedDeck, removeDeck } = useDeckMutations();
  const permanentReadOnly = deck?.readOnly === true;
  const editing = !permanentReadOnly && isDeckEditMode(mode);
  const [ioMode, setIoMode] = useState<IoMode | null>(null);
  const [pickingLegend, setPickingLegend] = useState(false);
  const [archiveImportOpen, setArchiveImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  useDeckAutoSave(editing ? deck : null);

  const handleLegendSelect = useCallback(
    (legend: DeckCard) => {
      if (!deck) return;
      const base =
        deck.format === 'pre-rift'
          ? deck
          : { ...deck, legend: null, champion: null, runes: new Map() };
      const next = addCardToDeck(base, legend, { section: 'legend' });
      setPickingLegend(false);
      persist(next);
      if (!isDeckEditMode(mode)) {
        router.push(deckEditHref(deck.id));
      }
    },
    [deck, mode, persist, router]
  );

  const handleImport = useCallback(() => {
    if (!deck?.id) return;
    setArchiveImportOpen(true);
  }, [deck?.id]);

  const handleDuplicate = useCallback(() => {
    if (!deck) return;
    void duplicateOwnedDeck.mutateAsync(deck).then((saved) => {
      router.replace(deckViewHref(saved.id));
    });
  }, [deck, duplicateOwnedDeck, router]);

  const handleDelete = useCallback(() => {
    setDeleteOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (!deck?.id) return;
    hapticPress();
    router.push(deckEditHref(deck.id));
  }, [deck?.id, router]);

  const handleBack = useCallback(() => {
    if (editing) {
      void flushSave();
      if (deck?.id) {
        leaveDeckEditMode(router, deck.id);
        return;
      }
    }
    leaveDeckEditor(router);
  }, [deck?.id, editing, flushSave, router]);

  if (isLoading) {
    return (
      <ScreenLayout mode="flex">
        <AppLoadingScreen size="md" className="bg-transparent" />
      </ScreenLayout>
    );
  }

  if (!deck) {
    return (
      <ScreenLayout>
        <ScreenLayoutBody>
          <Text className="text-muted-foreground">Deck not found.</Text>
          <Button className="mt-4" onPress={() => router.replace('/decks')}>
            <ButtonText>Back to decks</ButtonText>
          </Button>
        </ScreenLayoutBody>
      </ScreenLayout>
    );
  }

  const needsLegendSetup =
    !permanentReadOnly && !deck.legend && deck.format !== 'pre-rift';
  if (pickingLegend || needsLegendSetup) {
    return (
      <LegendPickerScreen
        onSelect={handleLegendSelect}
        onBack={() => {
          if (deck.legend) {
            setPickingLegend(false);
            return;
          }
          leaveDeckEditor(router);
        }}
      />
    );
  }

  return (
    <>
      <DeckImportLoadingOverlay
        visible={importDeck.isPending}
        message="Importing deck to your collection…"
      />
      <DeckFormatPickerSheet
        open={archiveImportOpen}
        onOpenChange={setArchiveImportOpen}
        title="Import deck"
        description={
          deck
            ? `Choose a format for “${deck.name}”.`
            : 'Choose a format for this deck.'
        }
        confirmLabel="Import deck"
        onConfirm={async (format) => {
          if (!deck?.id) return;
          const saved = await importDeck.mutateAsync({ sourceDeckId: deck.id, format });
          router.replace(deckViewHref(saved.id));
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete deck"
        description={deck ? `Delete “${deck.name}”? This cannot be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="destructive"
        onConfirm={async () => {
          if (!deck?.id) return;
          await removeDeck.mutateAsync(deck.id);
          leaveDeckEditor(router);
        }}
      />
      <ScreenLayout mode="flex" contentClassName="min-h-0 flex-1">
        <ScreenLayoutBody className="min-h-0 flex-1">
          <DeckBuilderCanvas
            deck={deck}
            permanentReadOnly={permanentReadOnly}
            editing={editing}
            ioMode={ioMode}
            onPersist={persist}
            onIoModeChange={setIoMode}
            onChangeLegend={() => setPickingLegend(true)}
            onEdit={permanentReadOnly || editing ? undefined : handleEdit}
            onDuplicate={permanentReadOnly ? undefined : handleDuplicate}
            onDelete={permanentReadOnly ? undefined : handleDelete}
            duplicateBusy={duplicateOwnedDeck.isPending}
            onImportToMyDecks={permanentReadOnly ? handleImport : undefined}
            importBusy={importDeck.isPending}
            onBack={handleBack}
          />
        </ScreenLayoutBody>
      </ScreenLayout>
    </>
  );
}

function LegendPickerScreen({
  onSelect,
  onBack,
}: {
  onSelect: (legend: DeckCard) => void;
  onBack: () => void;
}) {
  return (
    <ScreenLayout mode="flex" contentClassName="min-h-0 flex-1">
      <LegendPickerScreenBody onSelect={onSelect} onBack={onBack} />
    </ScreenLayout>
  );
}

function LegendPickerScreenBody({
  onSelect,
  onBack,
}: {
  onSelect: (legend: DeckCard) => void;
  onBack: () => void;
}) {
  const { paddingBottomInline } = useScreenLayout();

  return (
    <ScreenLayoutBody className="min-h-0 flex-1">
      <LegendPicker
        onSelect={onSelect}
        onBack={onBack}
        paddingBottom={paddingBottomInline}
      />
    </ScreenLayoutBody>
  );
}
