import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, type ListRenderItem } from 'react-native';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { DeckBrowseCard } from '@/components/deck/DeckBrowseCard';
import { DeckImportExportSheet } from '@/components/deck/DeckImportExportSheet';
import { DeckImportLoadingOverlay } from '@/components/deck/DeckImportLoadingOverlay';
import { DeckListCard } from '@/components/deck/DeckListCard';
import { DECKS_SUB_NAV_CLEARANCE, DecksSubNav } from '@/components/deck/DecksSubNav';
import {
  DecksListContent,
  DecksListLoadingFooter,
} from '@/components/deck/DecksListContent';
import { DecksListHeader } from '@/components/deck/DecksListHeader';
import { ScreenLayout, ScreenLayoutBody } from '@/components/shell/ScreenLayout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DeckFormatPickerSheet } from '@/components/deck/DeckFormatPickerSheet';
import { useDeckMutations } from '@/hooks/useDecks';
import { createEmptyDeck } from '@/lib/deck-card';
import { enterCreatedDeckEditor } from '@/lib/deck-navigation';
import type { DeckState } from '@/lib/deck-types';
import type { DeckFormat } from '@riftbound/contracts';
import { hapticPress } from '@/utils/haptics';

type DeckListQuery = {
  data?: DeckState[];
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  refetch: () => void;
};

type DeckInfiniteScroll = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

interface DecksListScreenProps {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  decksQuery: DeckListQuery;
  emptyTitle: string;
  emptyDescription: string;
  showCreate?: boolean;
  showImport?: boolean;
  showSubNav?: boolean;
  browseToolbar?: ReactNode;
  infiniteScroll?: DeckInfiniteScroll;
  variant?: 'default' | 'browse';
}

export function DecksListScreen({
  title,
  subtitle,
  searchPlaceholder,
  query,
  onQueryChange,
  decksQuery,
  emptyTitle,
  emptyDescription,
  showCreate = false,
  showImport = false,
  showSubNav = true,
  browseToolbar,
  infiniteScroll,
  variant = 'default',
}: DecksListScreenProps) {
  const router = useRouter();
  const { removeDeck, importDeck, saveDeckNow, createNewDeck } = useDeckMutations();
  const {
    data: decks = [],
    isLoading,
    isFetching = false,
    isError,
    refetch,
  } = decksQuery;
  const [importOpen, setImportOpen] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DeckState | null>(null);
  const [pendingArchiveImport, setPendingArchiveImport] = useState<DeckState | null>(
    null
  );
  const importPlaceholderDeck = useMemo(() => createEmptyDeck(), []);

  const handleCreateDeck = async (format: DeckFormat) => {
    const deck = await createNewDeck.mutateAsync({ format });
    enterCreatedDeckEditor(router, deck.id);
  };

  const handleArchiveImport = (deck: DeckState) => {
    setPendingArchiveImport(deck);
  };

  const archiveImportBusy = importDeck.isPending;
  const showRefreshing = isFetching && decks.length > 0;
  const deckCountLabel =
    decks.length === 0
      ? subtitle
      : decks.length === 1
        ? '1 deck'
        : `${decks.length} decks`;

  const listFooter = useMemo(
    () => (
      <>
        <DecksListLoadingFooter
          isFetchingNextPage={Boolean(infiniteScroll?.isFetchingNextPage)}
          showRefreshing={showRefreshing}
        />
        <ListBottomSpacer height={8 + (showSubNav ? DECKS_SUB_NAV_CLEARANCE : 0)} />
      </>
    ),
    [infiniteScroll?.isFetchingNextPage, showRefreshing, showSubNav]
  );

  const renderDeckItem = useCallback<ListRenderItem<DeckState>>(
    ({ item: deck }) =>
      variant === 'browse' ? (
        <DeckBrowseCard
          deck={deck}
          onPress={() => router.push(`/decks/${deck.id}`)}
          onImport={() => handleArchiveImport(deck)}
          importBusy={
            importDeck.isPending && importDeck.variables?.sourceDeckId === deck.id
          }
        />
      ) : (
        <DeckListCard
          deck={deck}
          onPress={() => router.push(`/decks/${deck.id}`)}
          onDelete={
            deck.readOnly
              ? undefined
              : () => {
                  setPendingDelete(deck);
                }
          }
          onImport={
            deck.readOnly
              ? () => {
                  handleArchiveImport(deck);
                }
              : undefined
          }
          importBusy={
            importDeck.isPending && importDeck.variables?.sourceDeckId === deck.id
          }
        />
      ),
    [variant, router, importDeck.isPending, importDeck.variables?.sourceDeckId]
  );

  return (
    <View className="relative min-h-0 flex-1">
      <ScreenLayout
        mode={infiniteScroll ? 'flex' : 'scroll'}
        contentClassName={infiniteScroll ? 'min-h-0 flex-1' : undefined}
      >
        <DeckImportLoadingOverlay
          visible={importSaving || archiveImportBusy}
          message={
            archiveImportBusy
              ? 'Importing deck to your collection…'
              : 'Saving imported deck…'
          }
        />
        <ScreenLayoutBody
          className={infiniteScroll ? 'min-h-0 flex-1 flex-col' : undefined}
        >
          <DecksListHeader
            title={title}
            deckCountLabel={deckCountLabel}
            query={query}
            searchPlaceholder={searchPlaceholder}
            onQueryChange={onQueryChange}
            showCreate={showCreate}
            showImport={showImport}
            onImportPress={() => {
              hapticPress();
              setImportOpen(true);
            }}
            onCreateDeck={handleCreateDeck}
            browseToolbar={browseToolbar}
            shrinkHeader={Boolean(infiniteScroll)}
          />

          <DecksListContent
            variant={variant}
            decks={decks}
            query={query}
            queryStatus={{ isLoading, isFetching, isError }}
            emptyActions={{ showCreate, showImport, showSubNav }}
            refetch={refetch}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            infiniteScroll={infiniteScroll}
            onDeckPress={(deckId) => router.push(`/decks/${deckId}`)}
            onDeleteDeck={setPendingDelete}
            onArchiveImport={handleArchiveImport}
            importBusyDeckId={importDeck.variables?.sourceDeckId}
            importBusy={importDeck.isPending}
            onCreateDeck={handleCreateDeck}
            onImportPress={() => {
              hapticPress();
              setImportOpen(true);
            }}
            listFooter={listFooter}
            renderDeckItem={renderDeckItem}
          />
        </ScreenLayoutBody>

        {showImport ? (
          <DeckImportExportSheet
            open={importOpen}
            mode="import"
            deck={importPlaceholderDeck}
            asNewDeck
            onClose={() => setImportOpen(false)}
            onImport={async (imported) => {
              setImportSaving(true);
              try {
                const saved = await saveDeckNow.mutateAsync(imported);
                setImportOpen(false);
                router.push(`/decks/${saved.id}`);
              } finally {
                setImportSaving(false);
              }
            }}
          />
        ) : null}
      </ScreenLayout>

      {showSubNav ? <DecksSubNav /> : null}

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete deck"
        description={
          pendingDelete ? `Delete “${pendingDelete.name}”? This cannot be undone.` : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="destructive"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await removeDeck.mutateAsync(pendingDelete.id);
        }}
      />

      <DeckFormatPickerSheet
        open={pendingArchiveImport != null}
        onOpenChange={(open) => {
          if (!open) setPendingArchiveImport(null);
        }}
        title="Import deck"
        description={
          pendingArchiveImport
            ? `Choose a format for “${pendingArchiveImport.name}”.`
            : 'Choose a format for this deck.'
        }
        confirmLabel="Import deck"
        onConfirm={async (format) => {
          if (!pendingArchiveImport) return;
          const saved = await importDeck.mutateAsync({
            sourceDeckId: pendingArchiveImport.id,
            format,
          });
          router.push(`/decks/${saved.id}`);
        }}
      />
    </View>
  );
}
