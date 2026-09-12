import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo } from 'react';
import { Keyboard, View, type ViewStyle } from 'react-native';
import type { CardListItem } from '@riftbound/contracts';
import { CardTileGridLayout } from '@/components/cards/CardTileGridLayout';
import { CardTileListLayout } from '@/components/cards/CardTileListLayout';
import { OwnershipStepper } from '@/components/catalog/OwnershipStepper';
import { GridCollectionControl } from '@/components/collection/GridCollectionControl';
import { useCollectionMutations } from '@/hooks/useCollection';
import { useOwnershipMap } from '@/hooks/useOwnershipMap';
import type { CollectionOwnershipMap } from '@/utils/collectionOwnership';
import { openCard } from '@/utils/cardNavigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  formatListPrice,
  hasMultiplePrintings,
  ownedQuantityForPrinting,
  printingSummary,
  totalOwnedForCard,
} from '@/utils/variants';
import {
  attachOwnedToPrintings,
  resolvePrintingSelection,
  resolveQuickAddPrintings,
  resolveQuickAddSelection,
  resolveQuickRemoveSelection,
} from '@/utils/collectionPrintingPicker';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { hapticPress } from '@/utils/haptics';
import { CARD_ART_RADIUS_CLASS } from '@/constants/CardArt';
import { resolveImageUrl } from '@/utils/resolveImageUrl';
import { cn } from '@/lib/utils';
import { logDrawer } from '@/lib/drawer-debug';
import { Skeleton } from '@/components/ui/skeleton';

const LIST_THUMB_W = 56;
const LIST_THUMB_H = 78;
const LIST_THUMB_W_MOBILE = 44;
const LIST_THUMB_H_MOBILE = 62;
export type CardTileMode = 'search' | 'collection';

interface Props {
  card: CardListItem;
  layout?: 'grid' | 'list';
  mode?: CardTileMode;
  style?: ViewStyle;
  compact?: boolean;
  enableQuickAdd?: boolean;
  /** Skip foil/standard picker on quick-add; inserts the default (non-foil) finish. */
  simpleAdd?: boolean;
  selected?: boolean;
  familyContextVariantNumber?: string | null;
  hidePrice?: boolean;
  /** Prefer this over `onPress` in virtualized lists — keeps memo() stable. */
  onSelectVariant?: (variantNumber: string) => void;
  onPress?: () => void;
  collectionByVariant?: CollectionOwnershipMap;
  /** Skip art fade/shimmer — pass from recycled list cells (search mode does this automatically). */
  instantArt?: boolean;
}

function CardTileInner({
  card,
  layout = 'grid',
  mode: _mode = 'search',
  style,
  compact = false,
  enableQuickAdd = false,
  simpleAdd = false,
  selected = false,
  familyContextVariantNumber,
  hidePrice = false,
  onSelectVariant,
  onPress,
  collectionByVariant: collectionByVariantProp,
  instantArt = false,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isMobile = useMobileLayout();
  const ownershipFromStore = useOwnershipMap({
    enabled: collectionByVariantProp == null,
  });
  const collectionByVariant = collectionByVariantProp ?? ownershipFromStore;
  const { addCard, adjustQuantity } = useCollectionMutations();
  const artInstant = instantArt || _mode === 'search';

  // Scope prices/quick-add to printing family (selected detail, else row variant for alt art).
  const stepperPrintings = useMemo(
    () =>
      resolveQuickAddPrintings(card, familyContextVariantNumber ?? card.variantNumber),
    [card, familyContextVariantNumber]
  );

  const pricePrintings = stepperPrintings;
  const printings = stepperPrintings;
  const multiplePricePrintings = hasMultiplePrintings(pricePrintings);
  const scopedCard = useMemo(
    () => ({ ...card, printings: pricePrintings }),
    [card, pricePrintings]
  );
  const printingsLabel = printingSummary(scopedCard);
  const primaryPrinting = printings[0];
  const owned = useMemo(
    () => totalOwnedForCard(scopedCard, collectionByVariant),
    [scopedCard, collectionByVariant]
  );
  // Qty from Query optimistic cache — no local prop-synced mirror.
  const priceLabel = formatListPrice(scopedCard);
  const showPrice = !hidePrice && (!isMobile || layout === 'grid');

  const printingsWithOwned = useMemo(
    () => attachOwnedToPrintings(printings, collectionByVariant),
    [printings, collectionByVariant]
  );

  const onOpenCard = useCallback(() => {
    Keyboard.dismiss();
    const path = onSelectVariant ? 'onSelectVariant' : onPress ? 'onPress' : 'openCard';
    logDrawer('tile.press', {
      variantNumber: card.variantNumber,
      path,
      selected,
      isMobile,
      mode: _mode,
      layout,
    });
    if (onSelectVariant) {
      void hapticPress();
      onSelectVariant(card.variantNumber);
      return;
    }
    if (onPress) {
      void hapticPress();
      onPress();
      return;
    }
    void hapticPress();
    openCard(router, card.variantNumber, 'modal', undefined, queryClient);
  }, [
    router,
    queryClient,
    card.variantNumber,
    onSelectVariant,
    onPress,
    selected,
    isMobile,
    _mode,
    layout,
  ]);

  const onAdd = useCallback(
    (selectionId?: string) => {
      void hapticPress();
      const selection = resolvePrintingSelection(selectionId, printings) ??
        resolveQuickAddSelection(printings) ?? {
          variantNumber: card.variantNumber,
          isFoil: false,
        };
      addCard.mutate({
        card,
        variantNumber: selection.variantNumber,
        isFoil: selection.isFoil,
      });
    },
    [addCard, card, printings]
  );

  const onRemove = useCallback(
    (selectionId?: string) => {
      void hapticPress();
      const selection =
        resolveQuickRemoveSelection(printingsWithOwned, selectionId) ??
        resolvePrintingSelection(selectionId, printings);
      if (!selection) return;
      const current = ownedQuantityForPrinting(collectionByVariant, selection);
      if (current <= 0) return;
      adjustQuantity.mutate({
        variantNumber: selection.variantNumber,
        delta: -1,
        isFoil: selection.isFoil,
      });
    },
    [collectionByVariant, printingsWithOwned, printings, adjustQuantity]
  );

  const listCompact = isMobile && layout === 'list';
  const listThumbW = listCompact ? LIST_THUMB_W_MOBILE : LIST_THUMB_W;
  const listThumbH = listCompact ? LIST_THUMB_H_MOBILE : LIST_THUMB_H;
  const gridQuickAdd = layout === 'grid' && enableQuickAdd;
  const stepperCompact = compact && !listCompact;
  const stepperRelaxed = listCompact && enableQuickAdd;

  const collectionCallbacks = {
    onAdd: (vn?: string) => {
      void onAdd(vn);
    },
    onRemove: (vn?: string) => {
      void onRemove(vn);
    },
  };

  const listStepper =
    enableQuickAdd && layout === 'list' ? (
      <OwnershipStepper
        owned={owned}
        name={card.name}
        compact={stepperCompact}
        relaxed={stepperRelaxed}
        printings={printingsWithOwned}
        simpleAdd={simpleAdd}
        {...collectionCallbacks}
      />
    ) : null;

  const gridControl = gridQuickAdd ? (
    <GridCollectionControl
      owned={owned}
      name={card.name}
      printings={printingsWithOwned}
      simpleAdd={simpleAdd}
      {...collectionCallbacks}
    />
  ) : null;

  const imageUri = resolveImageUrl(card.imageUrl);
  const banned = card.isBanned;

  if (layout === 'list') {
    return (
      <CardTileListLayout
        card={card}
        style={style}
        listCompact={listCompact}
        listThumbW={listThumbW}
        listThumbH={listThumbH}
        imageUri={imageUri}
        banned={banned}
        selected={selected}
        artInstant={artInstant}
        primaryPrinting={primaryPrinting}
        owned={owned}
        printingsLabel={printingsLabel}
        showPrice={showPrice}
        pricePrintings={pricePrintings}
        multiplePricePrintings={multiplePricePrintings}
        listStepper={listStepper}
        onOpenCard={onOpenCard}
      />
    );
  }

  return (
    <CardTileGridLayout
      card={card}
      style={style}
      imageUri={imageUri}
      banned={banned}
      selected={selected}
      artInstant={artInstant}
      isMobile={isMobile}
      primaryPrinting={primaryPrinting}
      showPrice={showPrice}
      priceLabel={priceLabel}
      gridControl={gridControl}
      onOpenCard={onOpenCard}
    />
  );
}

function ownedForTileMemo(
  card: CardListItem,
  familyContextVariantNumber: string | null | undefined,
  collectionByVariant: CollectionOwnershipMap | undefined
): number {
  const printings = resolveQuickAddPrintings(
    card,
    familyContextVariantNumber ?? card.variantNumber
  );
  return totalOwnedForCard({ ...card, printings }, collectionByVariant ?? new Map());
}

export const CardTile = memo(
  CardTileInner,
  (prev, next) =>
    prev.card.variantNumber === next.card.variantNumber &&
    prev.card.priceEur?.market === next.card.priceEur?.market &&
    prev.layout === next.layout &&
    prev.compact === next.compact &&
    prev.enableQuickAdd === next.enableQuickAdd &&
    prev.simpleAdd === next.simpleAdd &&
    prev.selected === next.selected &&
    prev.familyContextVariantNumber === next.familyContextVariantNumber &&
    prev.hidePrice === next.hidePrice &&
    prev.collectionByVariant === next.collectionByVariant &&
    ownedForTileMemo(prev.card, prev.familyContextVariantNumber, prev.collectionByVariant) ===
      ownedForTileMemo(next.card, next.familyContextVariantNumber, next.collectionByVariant) &&
    prev.onSelectVariant === next.onSelectVariant &&
    prev.onPress === next.onPress &&
    prev.mode === next.mode &&
    prev.instantArt === next.instantArt
);

export function CardTileSkeleton({
  layout = 'grid',
  compact: _compact = false,
}: {
  layout?: 'grid' | 'list';
  compact?: boolean;
}) {
  const isMobile = useMobileLayout();
  const listCompact = isMobile && layout === 'list';
  const listThumbW = listCompact ? LIST_THUMB_W_MOBILE : LIST_THUMB_W;
  const listThumbH = listCompact ? LIST_THUMB_H_MOBILE : LIST_THUMB_H;

  if (layout === 'list') {
    return (
      <View
        className={cn(
          'flex-row items-center',
          listCompact ? 'gap-3 px-3 py-2' : 'gap-4 px-4 py-3.5'
        )}
      >
        <Skeleton
          className={CARD_ART_RADIUS_CLASS}
          style={{ width: listThumbW, height: listThumbH }}
        />
        <View className="min-w-0 flex-1 gap-1.5">
          <Skeleton className="h-3 w-[65%] rounded" />
          <Skeleton className="h-2.5 w-[40%] rounded" />
          <Skeleton className="h-2 w-[30%] rounded" />
        </View>
      </View>
    );
  }

  return (
    <View
      className={cn(
        'overflow-hidden border border-border bg-card',
        CARD_ART_RADIUS_CLASS
      )}
    >
      <Skeleton className="w-full rounded-none" style={{ aspectRatio: 5 / 7 }} />
      <View className="gap-1.5 border-t border-border bg-card-panel px-2 py-2">
        <Skeleton className="h-4 w-[80%] rounded" />
        <Skeleton className="h-3 w-[70%] rounded" />
        <Skeleton className="h-9 w-full rounded-[3px]" />
      </View>
    </View>
  );
}
