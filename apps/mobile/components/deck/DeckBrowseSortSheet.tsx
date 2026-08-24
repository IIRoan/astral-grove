import { ThemedIcon, ArrowUpDownIcon, CheckIcon } from '@/components/icons';
import { Pressable } from 'react-native';
import { CatalogToolbarButton } from '@/components/catalog/CatalogToolbarButton';
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetOverlay,
  BottomSheetPortal,
  BottomSheetScrollView,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet';
import { Text } from '@/components/ui/text';
import {
  DECK_BROWSE_SORT_OPTIONS,
  deckBrowseSortKey,
  findDeckBrowseSortOption,
  type DeckBrowseSort,
} from '@/constants/deckBrowse';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface DeckBrowseSortSheetProps {
  visible: boolean;
  activeSort: DeckBrowseSort;
  onClose: () => void;
  onSortChange: (sort: DeckBrowseSort) => void;
}

export function DeckBrowseSortSheet({
  visible,
  activeSort,
  onClose,
  onSortChange,
}: DeckBrowseSortSheetProps) {
  const reduceMotion = useReduceMotion();
  const snapPoints = reduceMotion ? ['92%'] : ['50%', '92%'];

  return (
    <BottomSheet
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheetPortal name="deck-browse-sort-sheet">
        <BottomSheetOverlay />
        <BottomSheetContent
          snapPoints={snapPoints}
          defaultSnapIndex={0}
          enablePanDownToClose
          enableOverDrag={!reduceMotion}
        >
          <BottomSheetHeader>
            <BottomSheetTitle>Sort decks</BottomSheetTitle>
          </BottomSheetHeader>
          <BottomSheetScrollView
            contentContainerClassName="px-4 pb-6"
            showsVerticalScrollIndicator={false}
          >
            {DECK_BROWSE_SORT_OPTIONS.map((option) => {
              const active =
                deckBrowseSortKey(activeSort) === deckBrowseSortKey(option);
              return (
                <Pressable
                  key={deckBrowseSortKey(option)}
                  className="min-h-11 flex-row items-center justify-between rounded-[3px] px-3 py-2.5 active:bg-card-panel"
                  onPress={() => {
                    onSortChange({ sort: option.sort, dir: option.dir });
                    onClose();
                  }}
                >
                  <Text className="text-sm font-medium text-foreground">
                    {option.label}
                  </Text>
                  {active ? (
                    <ThemedIcon icon={CheckIcon} size={18} color="foreground" />
                  ) : null}
                </Pressable>
              );
            })}
          </BottomSheetScrollView>
        </BottomSheetContent>
      </BottomSheetPortal>
    </BottomSheet>
  );
}

export function DeckBrowseSortTrigger({
  activeSort,
  onPress,
}: {
  activeSort: DeckBrowseSort;
  onPress: () => void;
}) {
  const label = findDeckBrowseSortOption(activeSort).label;

  return (
    <CatalogToolbarButton
      icon={ArrowUpDownIcon}
      onPress={onPress}
      accessibilityLabel="Open sort options"
      label={label}
      mobile
    />
  );
}
