import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, type ListRenderItem } from 'react-native';
import { CatalogResultsTransition } from '@/components/catalog/CatalogResultsTransition';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { DeckBrowseCard } from '@/components/deck/DeckBrowseCard';
import { DeckImportExportSheet } from '@/components/deck/DeckImportExportSheet';
import { DeckImportLoadingOverlay } from '@/components/deck/DeckImportLoadingOverlay';
import { DeckListCard } from '@/components/deck/DeckListCard';
import { DecksListHeader } from '@/components/deck/DecksListHeader';
import { DecksListOwnedToolbar } from '@/components/deck/DecksListOwnedToolbar';
import { DecksSubNav } from '@/components/deck/DecksSubNav';
import {
  DecksListContent,
  DecksListLoadingFooter,
} from '@/components/deck/DecksListContent';
import { DecksPaneTransition } from '@/components/deck/DecksPaneTransition';
import { ScreenLayout, ScreenLayoutBody } from '@/components/shell/ScreenLayout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DeckFormatPickerSheet } from '@/components/deck/DeckFormatPickerSheet';
import { useCollection } from '@/hooks/useCollection';
import { useCollectionByCardName } from '@/hooks/useDeckCardResolver';
import { useDeckMutations } from '@/hooks/useDecks';
import { createEmptyDeck } from '@/lib/deck-card';
import { enterCreatedDeckEditor, deckEditHref } from '@/lib/deck-navigation';
import {
  countDecksByFormat,
  filterDecksByFormat,
  sortOwnedDecks,
  type DeckListLayout,
  type OwnedDeckFormatFilter,
  type OwnedDeckSort,
} from '@/lib/deck-list';
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
  const { removeDeck, importDeck, saveDeckNow, createNewDeck, duplicateOwnedDeck } =
    useDeckMutations();
  const collectionQuery = useCollection();
  const collectionByName = useCollectionByCardName(collectionQuery.data);
  const collectionReady = collectionQuery.isSuccess;
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
  const [formatFilter, setFormatFilter] = useState<OwnedDeckFormatFilter>('all');
  const [sort, setSort] = useState<OwnedDeckSort>('edited');
  const [layout, setLayout] = useState<DeckListLayout>('list');
  const importPlaceholderDeck = useMemo(() => createEmptyDeck(), []);
  const owned = variant === 'default';

  const handleCreateDeck = async (format: DeckFormat) => {
    const deck = await createNewDeck.mutateAsync({ format });
    enterCreatedDeckEditor(router, deck.id);
  };

  const handleArchiveImport = useCallback((deck: DeckState) => {
    setPendingArchiveImport(deck);
  }, []);

  const formatCounts = useMemo(() => countDecksByFormat(decks), [decks]);
  const visibleDecks = useMemo(() => {
    if (!owned) return decks;
    return sortOwnedDecks(filterDecksByFormat(decks, formatFilter), sort);
  }, [decks, formatFilter, owned, sort]);

  const archiveImportBusy = importDeck.isPending;
  const showRefreshing = isFetching && visibleDecks.length > 0;
  const formatFilteredEmpty =
    owned && formatFilter !== 'all' && decks.length > 0 && visibleDecks.length === 0;
  const formatFilterLabel = formatFilter === 'pre-rift' ? 'Pre-Rift' : 'Constructed';
  const listEmptyTitle = formatFilteredEmpty
    ? `No ${formatFilterLabel} decks`
    : emptyTitle;
  const listEmptyDescription = formatFilteredEmpty
    ? 'Switch format or create a new list in this ruleset.'
    : emptyDescription;
  const deckCountLabel =
    visibleDecks.length === 0
      ? subtitle
      : visibleDecks.length === 1
        ? '1 deck'
        : `${visibleDecks.length} decks`;

  const listFooter = useMemo(
    () => (
      <>
        <DecksListLoadingFooter
          isFetchingNextPage={Boolean(infiniteScroll?.isFetchingNextPage)}
          showRefreshing={showRefreshing}
        />
        <ListBottomSpacer height={8} />
      </>
    ),
    [infiniteScroll?.isFetchingNextPage, showRefreshing]
  );

  const renderDeckItem = useCallback<ListRenderItem<DeckState>>(
    ({ item: deck, index }) =>
      variant === 'browse' ? (
        <DeckBrowseCard
          deck={deck}
          motionIndex={index}
          onPress={() => router.push(`/decks/${deck.id}`)}
          onImport={() => handleArchiveImport(deck)}
          importBusy={
            importDeck.isPending && importDeck.variables?.sourceDeckId === deck.id
          }
        />
      ) : (
        <DeckListCard
          deck={deck}
          layout={layout}
          motionIndex={index}
          onPress={() => router.push(`/decks/${deck.id}`)}
          onEdit={
            deck.readOnly
              ? undefined
              : () => {
                  router.push(deckEditHref(deck.id));
                }
          }
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
          onDuplicate={
            deck.readOnly
              ? undefined
              : () => {
                  void duplicateOwnedDeck.mutateAsync(deck);
                }
          }
          importBusy={
            importDeck.isPending && importDeck.variables?.sourceDeckId === deck.id
          }
          duplicateBusy={
            duplicateOwnedDeck.isPending && duplicateOwnedDeck.variables?.id === deck.id
          }
          collectionByName={collectionByName}
          collectionReady={collectionReady}
        />
      ),
    [
      variant,
      layout,
      router,
      handleArchiveImport,
      importDeck.isPending,
      importDeck.variables?.sourceDeckId,
      duplicateOwnedDeck.mutateAsync,
      duplicateOwnedDeck.isPending,
      duplicateOwnedDeck.variables?.id,
      collectionByName,
      collectionReady,
    ]
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
            nav={showSubNav ? <DecksSubNav /> : null}
            ownedToolbar={
              owned ? (
                <DecksListOwnedToolbar
                  formatFilter={formatFilter}
                  onFormatFilterChange={setFormatFilter}
                  formatCounts={formatCounts}
                  sort={sort}
                  onSortChange={setSort}
                  layout={layout}
                  onLayoutChange={setLayout}
                />
              ) : null
            }
            browseToolbar={browseToolbar}
            shrinkHeader={Boolean(infiniteScroll)}
          />

          <DecksPaneTransition
            pane={owned ? 'mine' : 'browse'}
            fill={Boolean(infiniteScroll)}
          >
            <CatalogResultsTransition
              transitionKey={
                owned
                  ? `${formatFilter}:${sort}:${layout}:${query}`
                  : `${query}:${browseToolbar ? 'browse' : 'list'}`
              }
              fill={Boolean(infiniteScroll)}
            >
              <DecksListContent
                variant={variant}
                layout={owned ? layout : 'list'}
                decks={visibleDecks}
                query={query}
                queryStatus={{ isLoading, isFetching, isError }}
                emptyActions={{ showCreate, showImport }}
                refetch={refetch}
                emptyTitle={listEmptyTitle}
                emptyDescription={listEmptyDescription}
                infiniteScroll={infiniteScroll}
                onDeckPress={(deckId) => router.push(`/decks/${deckId}`)}
                onEditDeck={(deckId) => router.push(deckEditHref(deckId))}
                onDeleteDeck={setPendingDelete}
                onArchiveImport={handleArchiveImport}
                importBusyDeckId={importDeck.variables?.sourceDeckId}
                importBusy={importDeck.isPending}
                onDuplicateDeck={(deck) => {
                  void duplicateOwnedDeck.mutateAsync(deck);
                }}
                duplicateBusyDeckId={duplicateOwnedDeck.variables?.id}
                duplicateBusy={duplicateOwnedDeck.isPending}
                collectionByName={collectionByName}
                collectionReady={collectionReady}
                onCreateDeck={handleCreateDeck}
                onImportPress={() => {
                  hapticPress();
                  setImportOpen(true);
                }}
                listFooter={listFooter}
                renderDeckItem={renderDeckItem}
              />
            </CatalogResultsTransition>
          </DecksPaneTransition>
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
