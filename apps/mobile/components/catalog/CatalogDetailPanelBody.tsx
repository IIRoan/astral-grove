import { useCallback, useEffect, useMemo, useState } from 'react';
import { useValueChangeFlag } from '@/hooks/useValueChangeFlag';
import { BackHandler, Platform, ScrollView, View } from 'react-native';
import type { CardDetail } from '@riftbound/contracts';
import { CatalogCardFullscreen } from '@/components/catalog/CatalogCardFullscreen';
import { buildCatalogDetailCollectionSections } from '@/components/catalog/CatalogDetailCollectionStats';
import { CatalogDetailHeader } from '@/components/catalog/CatalogDetailHeader';
import { CollectionAddLog } from '@/components/collection/CollectionAddLog';
import {
  CatalogDetailDescriptionBlock,
  CatalogDetailScrollBody,
} from '@/components/catalog/CatalogDetailScrollBody';
import { VariantFamilySwitcher } from '@/components/catalog/VariantFamilySwitcher';
import { VariantPickerSheet } from '@/components/ui/VariantPickerSheet';
import type { useCardDetail } from '@/hooks/useCardDetail';
import { useCollectionMutations } from '@/hooks/useCollection';
import { useCollectionRecentAdds } from '@/hooks/useCollectionRecentAdds';
import { useWishlist } from '@/hooks/useWishlist';
import { useWishlistMutations } from '@/hooks/useWishlistMutations';
import type { WishlistPriceItem } from '@/hooks/useWishlistPrices';
import type { useVariantPriceHistory } from '@/hooks/useVariantPriceHistory';
import { buildCatalogDetailListItem } from '@/components/catalog/catalogDetailListItem';
import { FACTORY_RADIUS_PANEL_CLASS } from '@/constants/factoryShape';
import { isCardBannedAt, parseCollectionFinishKey } from '@riftbound/contracts';
import {
  formatMarketTrend,
  getCardPrintings,
  getSearchGroupVariants,
  getVariantFamiliesFromCardVariants,
  getVariantMarketPriceDisplays,
  pickVariantDisplayPrice,
  toPriceEurSummary,
} from '@/utils/variants';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';
import { resolveImageUrl } from '@/utils/resolveImageUrl';

type CardDetailState = ReturnType<typeof useCardDetail>;
type PriceHistoryState = ReturnType<typeof useVariantPriceHistory>;

interface CatalogDetailPanelBodyProps {
  card: CardDetail;
  activeVariant: CardDetail['variants'][number];
  detail: CardDetailState;
  collectionByVariant: ReadonlyMap<string, { quantity: number }>;
  embedded: 'panel' | 'drawer';
  hideCollectionActions: boolean;
  wishlistItem: WishlistPriceItem | null;
  hidePriceHistory: boolean;
  priceHistory: PriceHistoryState;
}

export function CatalogDetailPanelBody({
  card,
  activeVariant,
  detail,
  collectionByVariant,
  embedded,
  hideCollectionActions,
  wishlistItem,
  hidePriceHistory,
  priceHistory,
}: CatalogDetailPanelBodyProps) {
  const { adjustQuantity } = useCollectionMutations();
  const [fullscreen, setFullscreen] = useState(false);
  const [wishlistPickerVisible, setWishlistPickerVisible] = useState(false);
  const variantChanged = useValueChangeFlag(activeVariant.variantNumber);
  if (variantChanged) {
    if (fullscreen) setFullscreen(false);
    if (wishlistPickerVisible) setWishlistPickerVisible(false);
  }
  const [watchBusy, setWatchBusy] = useState(false);
  const { data: wishlist = [] } = useWishlist();
  const { add: addWishlist, remove: removeWishlist } = useWishlistMutations();
  const wishlistVariants = useMemo(
    () => new Set(wishlist.map((entry) => entry.variantNumber)),
    [wishlist]
  );

  useEffect(() => {
    if (!fullscreen || Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      return true;
    });
    return () => sub.remove();
  }, [fullscreen]);

  const openFullscreen = useCallback(() => {
    void hapticPress();
    setFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setFullscreen(false);
  }, []);

  const addVariantToWishlist = useCallback(
    async (targetVariantNumber: string) => {
      const variant =
        card.variants.find((item) => item.variantNumber === targetVariantNumber) ??
        activeVariant;

      await addWishlist.mutateAsync({
        variantNumber: variant.variantNumber,
        name: card.name,
        imageUrl: variant.imageUrl,
      });
    },
    [activeVariant, addWishlist, card.name, card.variants]
  );

  const removeVariantFromWishlist = useCallback(
    async (targetVariantNumber: string) => {
      await removeWishlist.mutateAsync(targetVariantNumber);
    },
    [removeWishlist]
  );

  const variantFamilies = getVariantFamiliesFromCardVariants(card.variants);
  const activeFamilyIndex = Math.max(
    0,
    variantFamilies.findIndex((family) =>
      family.variants.some(
        (variant) => variant.variantNumber === activeVariant.variantNumber
      )
    )
  );
  const activeFamily = variantFamilies[activeFamilyIndex] ?? variantFamilies[0];

  const switchFamily = (nextIndex: number) => {
    const family = variantFamilies[nextIndex];
    if (!family) return;
    void hapticPress();
    detail.onSelectPrinting(family.representativeVariantNumber);
  };

  const groupVariants = getSearchGroupVariants(card.variants, activeVariant);
  const listItem = buildCatalogDetailListItem(card, activeVariant, collectionByVariant);

  const printings = getCardPrintings(listItem);
  const marketPrices = getVariantMarketPriceDisplays(activeVariant);
  const singleMarketPrice = marketPrices[0] ?? null;
  const singlePriceTrend = formatMarketTrend(
    toPriceEurSummary(pickVariantDisplayPrice(activeVariant.prices, activeVariant))
  );
  const isWatchingActive = wishlistVariants.has(activeVariant.variantNumber);
  const watchedElsewhereCount = card.variants.filter(
    (variant) =>
      wishlistVariants.has(variant.variantNumber) &&
      !groupVariants.some(
        (groupVariant) => groupVariant.variantNumber === variant.variantNumber
      )
  ).length;

  const handleWatchPress = async () => {
    await hapticPress();
    if (isWatchingActive) {
      setWatchBusy(true);
      try {
        await removeVariantFromWishlist(activeVariant.variantNumber);
      } finally {
        setWatchBusy(false);
      }
      return;
    }

    if (groupVariants.length > 1) {
      setWishlistPickerVisible(true);
      return;
    }

    setWatchBusy(true);
    try {
      await addVariantToWishlist(activeVariant.variantNumber);
    } finally {
      setWatchBusy(false);
    }
  };

  const setCode = activeVariant.variantNumber.split('-')[0] ?? '';
  const detailImageUri = resolveImageUrl(activeVariant.imageUrl);
  const isDrawer = embedded === 'drawer';
  const isBanned = isCardBannedAt(card.banEffectiveDate);

  const showVariantSwitcher = variantFamilies.length > 1 && activeFamily;
  const variantFamilySwitcher = showVariantSwitcher ? (
    <VariantFamilySwitcher
      label={activeFamily.label}
      currentIndex={activeFamilyIndex}
      total={variantFamilies.length}
      prominent={isDrawer}
      onPrevious={() => {
        switchFamily(activeFamilyIndex - 1);
      }}
      onNext={() => {
        switchFamily(activeFamilyIndex + 1);
      }}
    />
  ) : null;

  const { printingRows, statsRow, metaAttributes } =
    buildCatalogDetailCollectionSections({
      printings,
      cardName: card.name,
      hideCollectionActions,
      collectionByVariant,
      energy: card.energy,
      might: card.might,
      power: card.power,
      cardType: card.type,
      colors: card.colors,
      activeRarity: activeVariant.rarity,
      tags: card.tags,
      onAddPrinting: (vn, isFoil) => {
        detail.onAddToCollection(vn, isFoil);
      },
      onRemovePrinting: (vn, isFoil, qty) => {
        if (qty <= 0) return;
        adjustQuantity.mutate({ variantNumber: vn, delta: -1, isFoil });
      },
    });

  const { events } = useCollectionRecentAdds(
    printings.map((printing) => printing.variantNumber),
    !hideCollectionActions
  );

  const descriptionBlock = (
    <CatalogDetailDescriptionBlock
      isPlaceholder={detail.isPlaceholderData}
      description={card.description}
    />
  );

  const detailBody = (
    <CatalogDetailScrollBody
      printingRows={printingRows}
      addedLog={
        hideCollectionActions ? null : (
          <CollectionAddLog events={events} className="px-3 py-2.5" />
        )
      }
      statsRow={statsRow}
      metaAttributes={metaAttributes}
      descriptionBlock={descriptionBlock}
      isWatchingActive={isWatchingActive}
      watchBusy={watchBusy}
      onWatchPress={() => {
        void handleWatchPress();
      }}
      singleMarketPrice={singleMarketPrice}
      singlePriceTrend={singlePriceTrend}
      hidePriceHistory={hidePriceHistory}
      variantFamilyCount={variantFamilies.length}
      wishlistItem={wishlistItem}
      activeVariantNumber={activeVariant.variantNumber}
      activeCardmarketId={activeVariant.cardmarketId ?? null}
      priceHistory={priceHistory}
    />
  );

  return (
    <View className={isDrawer ? undefined : 'min-h-0 h-full'}>
      {isDrawer ? (
        <View className="bg-card-panel">
          <CatalogDetailHeader
            cardName={card.name}
            isBanned={isBanned}
            setCode={setCode}
            isDrawer={isDrawer}
            detailImageUri={detailImageUri}
            activeVariantNumber={activeVariant.variantNumber}
            activeRarity={activeVariant.rarity}
            watchedElsewhereCount={watchedElsewhereCount}
            variantFamilySwitcher={variantFamilySwitcher}
            onOpenFullscreen={openFullscreen}
          />
          {detailBody}
        </View>
      ) : (
        <ScrollView
          className={cn(
            'min-h-0 flex-1 border border-border bg-card',
            FACTORY_RADIUS_PANEL_CLASS
          )}
          contentContainerClassName="grow-0"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          <CatalogDetailHeader
            cardName={card.name}
            isBanned={isBanned}
            setCode={setCode}
            isDrawer={isDrawer}
            detailImageUri={detailImageUri}
            activeVariantNumber={activeVariant.variantNumber}
            activeRarity={activeVariant.rarity}
            watchedElsewhereCount={watchedElsewhereCount}
            variantFamilySwitcher={variantFamilySwitcher}
            onOpenFullscreen={openFullscreen}
          />
          {detailBody}
        </ScrollView>
      )}

      <CatalogCardFullscreen
        visible={fullscreen}
        imageUrl={activeVariant.imageUrl}
        name={card.name}
        onClose={closeFullscreen}
      />
      <VariantPickerSheet
        visible={wishlistPickerVisible}
        title="Add which printing?"
        options={detail.pickerOptions}
        onClose={() => {
          setWishlistPickerVisible(false);
        }}
        onSelect={(id) => {
          setWishlistPickerVisible(false);
          void addVariantToWishlist(id);
        }}
      />
      <VariantPickerSheet
        visible={detail.pickerVisible}
        title="Which printing?"
        options={detail.pickerOptions}
        onClose={() => {
          detail.setPickerVisible(false);
        }}
        onSelect={(id) => {
          detail.setPickerVisible(false);
          const parsed = parseCollectionFinishKey(id);
          void detail.onAddToCollection(parsed?.variantNumber ?? id, parsed?.isFoil);
        }}
      />
    </View>
  );
}
