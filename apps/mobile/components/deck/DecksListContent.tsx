import { ThemedIcon, LayersIcon } from '@/components/icons';
import { FlatList, View, type ListRenderItem } from 'react-native';
import { AppLoader } from '@/components/ui/app-loader';
import { DeckListCard } from '@/components/deck/DeckListCard';
import { DeckBrowseCard } from '@/components/deck/DeckBrowseCard';
import { DeckCreateMenu } from '@/components/deck/DeckCreateMenu';
import { DECKS_SUB_NAV_CLEARANCE } from '@/components/deck/DecksSubNav';
import { DeckListSkeleton } from '@/components/deck/DecksListSkeleton';
import { Button, ButtonText } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
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
  showSubNav: boolean;
}

function DeckListItemSeparator() {
  return <View className="h-3" />;
}

interface DecksListContentProps {
  variant: 'default' | 'browse';
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
  onDeleteDeck: (deck: DeckState) => void;
  onArchiveImport: (deck: DeckState) => void;
  importBusyDeckId?: string;
  importBusy: boolean;
  onCreateDeck: (format: DeckFormat) => Promise<void>;
  onImportPress: () => void;
  listFooter: React.ReactElement;
  renderDeckItem: ListRenderItem<DeckState>;
}

export function DecksListContent({
  variant,
  decks,
  query,
  queryStatus,
  emptyActions,
  refetch,
  emptyTitle,
  emptyDescription,
  infiniteScroll,
  onDeckPress,
  onDeleteDeck,
  onArchiveImport,
  importBusyDeckId,
  importBusy,
  onCreateDeck,
  onImportPress,
  listFooter,
  renderDeckItem,
}: DecksListContentProps) {
  const { isLoading, isFetching: _isFetching, isError } = queryStatus;
  const { showCreate, showImport, showSubNav } = emptyActions;
  const showBlockingLoader = isLoading && decks.length === 0;
  const subNavSpacer = showSubNav ? (
    <View style={{ height: DECKS_SUB_NAV_CLEARANCE }} />
  ) : null;

  if (showBlockingLoader) {
    return (
      <>
        <DeckListSkeleton />
        {subNavSpacer}
      </>
    );
  }

  if (isError) {
    return (
      <>
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
        {subNavSpacer}
      </>
    );
  }

  if (decks.length === 0) {
    return (
      <>
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
        {subNavSpacer}
      </>
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
    <View className="gap-3">
      {decks.map((deck) =>
        variant === 'browse' ? (
          <DeckBrowseCard
            key={deck.id}
            deck={deck}
            onPress={() => onDeckPress(deck.id)}
            onImport={() => onArchiveImport(deck)}
            importBusy={importBusy && importBusyDeckId === deck.id}
          />
        ) : (
          <DeckListCard
            key={deck.id}
            deck={deck}
            onPress={() => onDeckPress(deck.id)}
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
            importBusy={importBusy && importBusyDeckId === deck.id}
          />
        )
      )}
      {listFooter}
      {subNavSpacer}
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
