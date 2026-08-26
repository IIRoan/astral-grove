import { ThemedIcon, LayersIcon } from '@/components/icons';
import { FlatList, useWindowDimensions, View, type ListRenderItem } from 'react-native';
import { AppLoader } from '@/components/ui/app-loader';
import { DeckListCard } from '@/components/deck/DeckListCard';
import { DeckBrowseCard } from '@/components/deck/DeckBrowseCard';
import { DeckCreateMenu } from '@/components/deck/DeckCreateMenu';
import { DecksListCreateRow } from '@/components/deck/DecksListCreateRow';
import { DeckListSkeleton } from '@/components/deck/DecksListSkeleton';
import { Button, ButtonText } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Layout } from '@/constants/Layout';
import { SIDE_RAIL_WIDTH, useShowSideRail } from '@/hooks/useBreakpoint';
import type { DeckListLayout } from '@/lib/deck-list';
import type { DeckState } from '@/lib/deck-types';
import type { DeckFormat } from '@riftbound/contracts';
import { hapticPress } from '@/utils/haptics';

export interface DecksListQueryStatus {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
}

export interface DecksListEmptyActions {
  showCreate: boolean;
  showImport: boolean;
}

function DeckListItemSeparator() {
  return <View className="h-3" />;
}

function useOwnedDeckTileWidth(layout: DeckListLayout): number | undefined {
  const { width } = useWindowDimensions();
  const showRail = useShowSideRail();
  if (layout !== 'grid') return undefined;
  const available =
    width - (showRail ? SIDE_RAIL_WIDTH : 0) - Layout.screenPaddingHorizontal * 2;
  const gap = 12;
  const minTile = 280;
  const columns = Math.max(
    1,
    Math.min(3, Math.floor((available + gap) / (minTile + gap)))
  );
  return (available - gap * (columns - 1)) / columns;
}

interface DecksListContentProps {
  variant: 'default' | 'browse';
  layout?: DeckListLayout;
  decks: DeckState[];
  query: string;
  queryStatus: DecksListQueryStatus;
  emptyActions: DecksListEmptyActions;
  refetch: () => void;
  emptyTitle: string;
  emptyDescription: string;
  infiniteScroll?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
  };
  onDeckPress: (deckId: string) => void;
  onEditDeck: (deckId: string) => void;
  onDeleteDeck: (deck: DeckState) => void;
  onArchiveImport: (deck: DeckState) => void;
  importBusyDeckId?: string;
  importBusy: boolean;
  onDuplicateDeck: (deck: DeckState) => void;
  duplicateBusyDeckId?: string;
  duplicateBusy: boolean;
  collectionByName: ReadonlyMap<string, number>;
  collectionReady: boolean;
  onCreateDeck: (format: DeckFormat) => Promise<void>;
  onImportPress: () => void;
  listFooter: React.ReactElement;
  renderDeckItem: ListRenderItem<DeckState>;
}

export function DecksListContent({
  variant,
  layout = 'list',
  decks,
  query,
  queryStatus,
  emptyActions,
  refetch,
  emptyTitle,
  emptyDescription,
  infiniteScroll,
  onDeckPress,
  onEditDeck,
  onDeleteDeck,
  onArchiveImport,
  importBusyDeckId,
  importBusy,
  onDuplicateDeck,
  duplicateBusyDeckId,
  duplicateBusy,
  collectionByName,
  collectionReady,
  onCreateDeck,
  onImportPress,
  listFooter,
  renderDeckItem,
}: DecksListContentProps) {
  const { isLoading, isFetching: _isFetching, isError } = queryStatus;
  const { showCreate, showImport } = emptyActions;
  const showBlockingLoader = isLoading && decks.length === 0;
  const tileWidth = useOwnedDeckTileWidth(layout);
  const grid = variant === 'default' && layout === 'grid';

  if (showBlockingLoader) {
    return <DeckListSkeleton />;
  }

  if (isError) {
    return (
      <Empty className="mt-8 border border-dashed border-border">
        <EmptyHeader>
          <EmptyTitle>Could not load decks</EmptyTitle>
          <EmptyDescription>
            The deck list timed out or the server returned an error. Try again in a
            moment.
          </EmptyDescription>
        </EmptyHeader>
        <Button onPress={() => void refetch()}>
          <ButtonText>Retry</ButtonText>
        </Button>
      </Empty>
    );
  }

  if (decks.length === 0) {
    return (
      <Empty className="mt-8 border border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="mb-1 size-16">
            <ThemedIcon icon={LayersIcon} size={32} color="ring" />
          </EmptyMedia>
          <EmptyTitle>{query.trim() ? 'No matching decks' : emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
        {showCreate && !query.trim() ? (
          <View className="gap-2">
            <DeckCreateMenu onCreate={onCreateDeck}>
              <Button>
                <ButtonText>Create your first deck</ButtonText>
              </Button>
            </DeckCreateMenu>
            {showImport ? (
              <Button
                variant="outline"
                onPress={() => {
                  hapticPress();
                  onImportPress();
                }}
              >
                <ButtonText>Import deck list</ButtonText>
              </Button>
            ) : null}
          </View>
        ) : null}
      </Empty>
    );
  }

  if (infiniteScroll) {
    return (
      <FlatList
        data={decks}
        keyExtractor={(deck) => deck.id}
        renderItem={renderDeckItem}
        ItemSeparatorComponent={DeckListItemSeparator}
        ListFooterComponent={listFooter}
        onEndReached={() => {
          if (infiniteScroll.hasNextPage && !infiniteScroll.isFetchingNextPage) {
            infiniteScroll.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.25}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        className="min-h-0 flex-1"
      />
    );
  }

  return (
    <View
      className={grid ? 'flex-row flex-wrap' : 'gap-3'}
      style={grid ? { gap: 12 } : undefined}
    >
      {decks.map((deck, index) =>
        variant === 'browse' ? (
          <DeckBrowseCard
            key={deck.id}
            deck={deck}
            motionIndex={index}
            onPress={() => onDeckPress(deck.id)}
            onImport={() => onArchiveImport(deck)}
            importBusy={importBusy && importBusyDeckId === deck.id}
          />
        ) : (
          <View
            key={deck.id}
            style={grid && tileWidth ? { width: tileWidth } : undefined}
          >
            <DeckListCard
              deck={deck}
              layout={layout}
              motionIndex={index}
              onPress={() => onDeckPress(deck.id)}
              onEdit={
                deck.readOnly
                  ? undefined
                  : () => {
                      onEditDeck(deck.id);
                    }
              }
              onDelete={
                deck.readOnly
                  ? undefined
                  : () => {
                      onDeleteDeck(deck);
                    }
              }
              onImport={
                deck.readOnly
                  ? () => {
                      onArchiveImport(deck);
                    }
                  : undefined
              }
              onDuplicate={
                deck.readOnly
                  ? undefined
                  : () => {
                      onDuplicateDeck(deck);
                    }
              }
              importBusy={importBusy && importBusyDeckId === deck.id}
              duplicateBusy={duplicateBusy && duplicateBusyDeckId === deck.id}
              collectionByName={collectionByName}
              collectionReady={collectionReady}
            />
          </View>
        )
      )}
      {showCreate ? (
        <View className={grid ? 'w-full' : undefined}>
          <DecksListCreateRow onCreateDeck={onCreateDeck} />
        </View>
      ) : null}
      {listFooter}
    </View>
  );
}

export function DecksListLoadingFooter({
  isFetchingNextPage,
  showRefreshing,
}: {
  isFetchingNextPage: boolean;
  showRefreshing: boolean;
}) {
  if (!isFetchingNextPage && !showRefreshing) return null;
  return (
    <View className="items-center py-4">
      <AppLoader size="sm" />
    </View>
  );
}
