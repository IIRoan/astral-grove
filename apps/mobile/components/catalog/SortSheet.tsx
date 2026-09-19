import { ThemedIcon, ArrowUpDownIcon, CheckIcon } from '@/components/icons';
import { Pressable } from 'react-native';
import {
  CatalogToolbarBadgeDot,
  CatalogToolbarButton,
} from '@/components/catalog/CatalogToolbarButton';
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
  CATALOG_SORT_OPTIONS,
  findSortOption,
  isDefaultCatalogSort,
  sortOptionKey,
  type CatalogSort,
} from '@/constants/catalogSort';
import { useReduceMotion } from '@/hooks/useReduceMotion';

interface SortSheetProps {
  visible: boolean;
  activeSort: CatalogSort;
  onClose: () => void;
  onSortChange: (sort: CatalogSort) => void;
}

export function SortSheet({
  visible,
  activeSort,
  onClose,
  onSortChange,
}: SortSheetProps) {
  const reduceMotion = useReduceMotion();

  return (
    <BottomSheet
      open={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheetPortal name="catalog-sort-sheet">
        <BottomSheetOverlay />
        <BottomSheetContent
          enableDynamicSizing
          enablePanDownToClose
          enableOverDrag={!reduceMotion}
        >
          <BottomSheetHeader>
            <BottomSheetTitle>Sort</BottomSheetTitle>
          </BottomSheetHeader>
          {/* BottomSheetScrollView owns horizontal + home-indicator bottom padding. */}
          <BottomSheetScrollView showsVerticalScrollIndicator={false}>
            {CATALOG_SORT_OPTIONS.map((option) => {
              const active = sortOptionKey(activeSort) === sortOptionKey(option);
              return (
                <Pressable
                  key={sortOptionKey(option)}
                  className="min-h-11 flex-row items-center justify-between rounded-[3px] px-3 py-2.5 active:bg-card-panel"
                  onPress={() => {
                    onClose();
                    onSortChange({ sortBy: option.sortBy, dir: option.dir });
                  }}
                >
                  <Text className="text-sm font-normal text-foreground">
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

export function SortTrigger({
  activeSort,
  onPress,
  compact = false,
  mobile = false,
  iconOnly = false,
  open = false,
}: {
  activeSort: CatalogSort;
  onPress: () => void;
  compact?: boolean;
  mobile?: boolean;
  open?: boolean;
  /** Desktop icon-only (narrow toolbar); mobile is always icon-only. */
  iconOnly?: boolean;
}) {
  const option = findSortOption(activeSort);
  const active = !isDefaultCatalogSort(activeSort);
  const hideLabel = mobile || iconOnly;
  // Mobile: icon-only (sort choice lives in the sheet). Desktop keeps the label unless narrow.
  const label = hideLabel ? undefined : compact ? option.shortLabel : option.label;

  return (
    <CatalogToolbarButton
      icon={ArrowUpDownIcon}
      onPress={onPress}
      accessibilityLabel={`Sort: ${option.label}`}
      active={active}
      label={label}
      mobile={mobile}
      open={open}
      className={iconOnly && !mobile ? 'size-10' : undefined}
      badge={hideLabel && active ? <CatalogToolbarBadgeDot /> : undefined}
    />
  );
}
