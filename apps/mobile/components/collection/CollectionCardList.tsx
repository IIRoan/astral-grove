import { memo, useCallback, useMemo, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { CardTile } from '@/components/cards/CardTile';
import { ListBottomSpacer } from '@/components/ui/list-bottom-spacer';
import { Text } from '@/components/ui/text';
import type { CollectionEntry } from '@/services/collectionService';
import { filterCollection, sortCollection } from '@/services/collectionService';
import {
  buildCollectionByVariant,
  collectionEntryToCardListItem,
  formatGroupedCollectionMeta,
  groupCollectionByVariant,
} from '@/utils/collectionDisplay';
import { useCardBanByVariant } from '@/hooks/useBanDatesByVariant';
import { cn } from '@/lib/utils';

type SortMode = 'recent' | 'name' | 'set';

type OwnershipMap = NonNullable<
  React.ComponentProps<typeof CardTile>['collectionByVariant']
>;

const CollectionRow = memo(function CollectionRow({
  item,
  meta,
  isBanned,
  collectionByVariant,
}: {
  item: CollectionEntry;
  meta: string;
  isBanned: boolean;
  collectionByVariant: OwnershipMap;
}) {
  const card = useMemo(
    () => collectionEntryToCardListItem(item, { isBanned }),
    [item, isBanned]
  );

  return (
    <View className="mb-3">
      <CardTile
        card={card}
        layout="list"
        mode="collection"
        compact
        instantArt
        collectionByVariant={collectionByVariant}
      />
      <Text className="mt-1 px-1 font-mono text-[11px] text-muted-foreground">
        {item.variantNumber} · Qty {item.quantity}
        {meta ? ` · ${meta}` : ''}
      </Text>
    </View>
  );
});

interface Props {
  entries: CollectionEntry[];
  query: string;
  isLoading?: boolean;
  contentWidth: number;
  paddingBottom: number;
  uniquePrintings: number;
  totalCopies: number;
  listHeader?: React.ReactElement | null;
}

export function CollectionCardList({
  entries,
  query,
  isLoading = false,
  contentWidth,
  paddingBottom,
  uniquePrintings,
  totalCopies,
  listHeader,
}: Props) {
  const [sortBy, setSortBy] = useState<SortMode>('recent');

  const groupedEntries = useMemo(() => groupCollectionByVariant(entries), [entries]);

  const rowsByVariant = useMemo(() => {
    const map = new Map<string, CollectionEntry[]>();
    for (const entry of entries) {
      const rows = map.get(entry.variantNumber) ?? [];
      rows.push(entry);
      map.set(entry.variantNumber, rows);
    }
    return map;
  }, [entries]);

  const filtered = useMemo(
    () => sortCollection(filterCollection(groupedEntries, query), sortBy),
    [groupedEntries, query, sortBy]
  );

  const collectionByVariant = useMemo(
    () => buildCollectionByVariant(entries),
    [entries]
  );

  const variantNumbers = useMemo(
    () => groupedEntries.map((entry) => entry.variantNumber),
    [groupedEntries]
  );
  const banByVariantQuery = useCardBanByVariant(variantNumbers);
  const banByVariant = banByVariantQuery.data;

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const renderItem = useCallback<ListRenderItem<CollectionEntry>>(
    ({ item }) => {
      const sourceRows = rowsByVariant.get(item.variantNumber) ?? [item];
      return (
        <CollectionRow
          item={item}
          meta={formatGroupedCollectionMeta(sourceRows)}
          isBanned={banByVariant?.get(item.variantNumber) ?? false}
          collectionByVariant={collectionByVariant}
        />
      );
    },
    [rowsByVariant, banByVariant, collectionByVariant]
  );

  const headerComponent = useMemo(
    () => (
      <>
        {listHeader}
        <View className="mb-4 gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-sm font-normal text-muted-foreground">
              Your cards ({uniquePrintings.toLocaleString()} printings ·{' '}
              {totalCopies.toLocaleString()} copies)
            </Text>
            <View className="flex-row gap-1">
              {(['recent', 'name', 'set'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => {
                    setSortBy(mode);
                  }}
                >
                  <Text
                    className={cn(
                      'rounded-[3px] px-2 py-1 text-[12px] capitalize',
                      sortBy === mode
                        ? 'bg-card-panel text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {mode}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </>
    ),
    [listHeader, uniquePrintings, totalCopies, sortBy]
  );

  return (
    <FlashList
      data={filtered}
      keyExtractor={(item) => item.variantNumber}
      ListHeaderComponent={headerComponent}
      renderItem={renderItem}
      extraData={banByVariant}
      ListEmptyComponent={
        !isLoading ? (
          <Text className="py-8 text-center text-sm text-muted-foreground">
            {query.trim()
              ? 'No cards match your search.'
              : 'No cards in your collection yet.'}
          </Text>
        ) : null
      }
      ListFooterComponent={<ListBottomSpacer height={paddingBottom} />}
      contentContainerStyle={{
        width: contentWidth,
        maxWidth: '100%',
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={dismissKeyboard}
      showsVerticalScrollIndicator={false}
    />
  );
}
