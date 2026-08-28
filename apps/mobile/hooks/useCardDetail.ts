import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useValueChangeFlag } from '@/hooks/useValueChangeFlag';
import type { CardListItem } from '@riftbound/contracts';
import {
  useCollection,
  useCollectionMutations,
  useCollectionOwnership,
} from '@/hooks/useCollection';
import {
  collectVariantNumbers,
  ownershipMapFromCollection,
  preferCollectionOwnership,
} from '@/utils/collectionOwnership';
import { useCollectionRemove } from '@/hooks/useCollectionRemove';
import { cardListItemToDetailResponse } from '@/lib/cardDetailPlaceholder';
import { formatCardPrice } from '@/utils/cardFormat';
import {
  formatPrintingLabel,
  findVariantByNumber,
  getSearchGroupVariants,
  isFoilVariant,
  cardListItemMatchesVariant,
  pickVariantDisplayPrice,
  expandVariantFinishPrintings,
  ownedQuantityForPrinting,
} from '@/utils/variants';
import { getCollectedPrintingsForDetailCard } from '@/utils/collectionRemove';
import { hapticPress } from '@/utils/haptics';
import { closeCard } from '@/utils/cardNavigation';
import {
  flushCardDetailPrefetch,
  fetchCardDetailNow,
  findCachedCardListItem,
  isHydratedDetail,
} from '@/lib/prefetchCardDetail';
import { api } from '@/src/api/client';
import { cardQueryKeys } from '@/src/api/queryKeys';
import { collectionFinishKey, parseCollectionFinishKey } from '@riftbound/contracts';
import { resolveUnambiguousQuantitySelection } from '@/utils/collectionPrintingPicker';

export function useCardDetail(
  variantNumber: string,
  options?: { listItem?: CardListItem | null }
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pickedVariant, setPickedVariant] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const routeChanged = useValueChangeFlag(variantNumber);
  if (routeChanged && pickedVariant !== null) {
    setPickedVariant(null);
  }
  const selectedVariant = pickedVariant ?? variantNumber;
  const { listItem: listItemOption } = options ?? {};

  const listItem = useMemo(() => {
    if (listItemOption && cardListItemMatchesVariant(listItemOption, variantNumber)) {
      return listItemOption;
    }
    return findCachedCardListItem(queryClient, variantNumber) ?? null;
  }, [listItemOption, queryClient, variantNumber]);

  const listPlaceholder = useMemo(() => {
    if (!listItem) return undefined;
    return cardListItemToDetailResponse(listItem);
  }, [listItem]);

  const { data, isLoading, isError, isPlaceholderData } = useQuery({
    queryKey: cardQueryKeys.detail(variantNumber),
    queryFn: async () => {
      // Prefer an already-warmed detail (from scroll prefetch or press ensure).
      const cached = queryClient.getQueryData(cardQueryKeys.detail(variantNumber)) as
        Awaited<ReturnType<typeof api.getCard>> | undefined;
      if (isHydratedDetail(cached)) return cached;

      // Flush batch prefetch without awaiting — waiting delayed rules text behind unrelated work.
      void flushCardDetailPrefetch();
      return fetchCardDetailNow(queryClient, variantNumber);
    },
    enabled: Boolean(variantNumber),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: listPlaceholder,
  });

  const card = data?.data;
  const activeVariant =
    (card ? findVariantByNumber(card.variants, selectedVariant) : undefined) ??
    (card ? findVariantByNumber(card.variants, variantNumber) : undefined) ??
    card?.variants[0];

  const detailVariants = useMemo(() => {
    if (card) return card.variants.map((variant) => variant.variantNumber);
    if (listItem) return collectVariantNumbers([listItem], [variantNumber]);
    return variantNumber ? [variantNumber] : [];
  }, [card, listItem, variantNumber]);

  const { collectionByVariant: fetchedOwnership } =
    useCollectionOwnership(detailVariants);
  const { data: collectionEntries = [] } = useCollection();
  const collectionByVariant = useMemo(
    () =>
      preferCollectionOwnership(
        fetchedOwnership,
        ownershipMapFromCollection(collectionEntries)
      ),
    [fetchedOwnership, collectionEntries]
  );

  const collectedForCard = useMemo(() => {
    if (!card || !activeVariant) return [];
    return getCollectedPrintingsForDetailCard(card, collectionByVariant, {
      variantNumber: activeVariant.variantNumber,
      variantLabel: activeVariant.variantLabel,
      variantType: activeVariant.variantType,
      foilMode: activeVariant.foilMode,
    });
  }, [card, activeVariant, collectionByVariant]);

  const finishPrintingsForActive = useMemo(() => {
    if (!card || !activeVariant) return [];
    return expandVariantFinishPrintings(
      getSearchGroupVariants(card.variants, activeVariant)
    );
  }, [card, activeVariant]);

  const ownedQuantity = useMemo(() => {
    if (!activeVariant) return 0;
    return finishPrintingsForActive.reduce(
      (sum, printing) => sum + ownedQuantityForPrinting(collectionByVariant, printing),
      0
    );
  }, [activeVariant, finishPrintingsForActive, collectionByVariant]);

  const collectionEntry = useMemo(() => {
    if (!activeVariant || ownedQuantity <= 0) return null;
    const ownedFinish =
      finishPrintingsForActive.find(
        (printing) => ownedQuantityForPrinting(collectionByVariant, printing) > 0
      ) ?? finishPrintingsForActive[0];
    return {
      quantity: ownedQuantity,
      isFoil: ownedFinish?.isFoil ?? false,
    };
  }, [activeVariant, ownedQuantity, finishPrintingsForActive, collectionByVariant]);
  const { addFromDetail, adjustQuantity } = useCollectionMutations();
  const { sheet, closeSheet, promptRemove, onSheetRemovePrinting, onSheetRemoveAll } =
    useCollectionRemove();

  const handleClose = useCallback(() => {
    closeCard(router);
  }, [router]);

  const groupVariants = useMemo(() => {
    if (!card || !activeVariant) return [];
    return getSearchGroupVariants(card.variants, activeVariant);
  }, [card, activeVariant]);

  const finishPrintings = finishPrintingsForActive;

  const needsPrintingPicker = finishPrintings.length > 1;

  const pickerOptions = useMemo(() => {
    return finishPrintings.map((printing) => {
      const source =
        groupVariants.find(
          (variant) => variant.variantNumber === printing.variantNumber
        ) ?? groupVariants[0];
      const price = source
        ? (source.prices.find((row) => row.isFoil === printing.isFoil) ??
          pickVariantDisplayPrice(source.prices, {
            ...source,
            foilMode: printing.isFoil ? 'foil_only' : source.foilMode,
          }))
        : null;
      const amount = price?.market ?? null;
      return {
        id: collectionFinishKey(printing.variantNumber, printing.isFoil),
        label: formatPrintingLabel(
          printing.variantLabel,
          printing.isFoil,
          printing.variantNumber
        ),
        subtitle: printing.variantNumber,
        price: amount != null ? `€${amount.toFixed(2)}` : undefined,
      };
    });
  }, [finishPrintings, groupVariants]);

  const printingPreviews = useMemo(() => {
    return groupVariants.map((variant) => {
      return {
        id: variant.id,
        variantNumber: variant.variantNumber,
        variantLabel: variant.variantLabel,
        variantType: variant.variantType,
        imageUrl: variant.imageUrl,
        price: formatCardPrice(variant.prices, variant),
      };
    });
  }, [groupVariants]);

  const onAddToCollection = useCallback(
    (targetVariantNumber: string, isFoil?: boolean) => {
      if (!card) return;
      void hapticPress();
      // Optimistic cache updates in onMutate — never await the network here.
      addFromDetail.mutate({ card, variantNumber: targetVariantNumber, isFoil });
      setPickedVariant(targetVariantNumber);
    },
    [card, addFromDetail]
  );

  const onAddPress = useCallback(() => {
    if (!card || !activeVariant) return;
    void hapticPress();
    if (needsPrintingPicker) {
      setPickerVisible(true);
      return;
    }
    const finish = finishPrintings[0];
    onAddToCollection(activeVariant.variantNumber, finish?.isFoil);
  }, [card, activeVariant, needsPrintingPicker, onAddToCollection, finishPrintings]);

  const onRemovePress = useCallback(() => {
    if (!card) return;
    void promptRemove(card.name, collectedForCard);
  }, [card, collectedForCard, promptRemove]);

  const onQuantityChange = useCallback(
    (delta: number) => {
      if (!activeVariant || ownedQuantity <= 0) return;
      const next = ownedQuantity + delta;
      if (next <= 0) {
        if (!card) return;
        void promptRemove(card.name, collectedForCard);
        return;
      }
      void hapticPress();
      const target = resolveUnambiguousQuantitySelection(
        finishPrintings.map((printing) => ({
          ...printing,
          owned: ownedQuantityForPrinting(collectionByVariant, printing),
        })),
        delta
      );
      if (!target && delta < 0) {
        if (!card) return;
        void promptRemove(card.name, collectedForCard);
        return;
      }
      if (!target && delta > 0) {
        setPickerVisible(true);
        return;
      }
      if (!target) return;
      adjustQuantity.mutate({
        variantNumber: target.variantNumber,
        delta,
        isFoil: target.isFoil,
      });
    },
    [
      activeVariant,
      ownedQuantity,
      adjustQuantity,
      card,
      collectedForCard,
      promptRemove,
      finishPrintings,
      collectionByVariant,
    ]
  );

  const onSelectPrinting = useCallback((id: string) => {
    void hapticPress();
    const parsed = parseCollectionFinishKey(id);
    setPickedVariant(parsed?.variantNumber ?? id);
  }, []);

  return {
    card,
    activeVariant,
    isLoading,
    isError,
    isPlaceholderData,
    collectionEntry,
    collectedForCard,
    pickerVisible,
    setPickerVisible,
    pickerOptions,
    printingPreviews,
    handleClose,
    onAddPress,
    onRemovePress,
    onQuantityChange,
    onAddToCollection,
    onSelectPrinting,
    removeSheet: sheet,
    closeRemoveSheet: closeSheet,
    onRemoveSheetPrinting: onSheetRemovePrinting,
    onRemoveSheetAll: onSheetRemoveAll,
    collectionByVariant,
  };
}
