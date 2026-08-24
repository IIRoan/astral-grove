import { useMemo } from 'react';
import type { CardListItem } from '@riftbound/contracts';
import { CatalogDetailPanelBody } from '@/components/catalog/CatalogDetailPanelBody';
import { CatalogDetailPanelSkeleton } from '@/components/catalog/CatalogDetailPanelSkeleton';
import { useCardDetail } from '@/hooks/useCardDetail';
import { useCollection, useCollectionOwnership } from '@/hooks/useCollection';
import {
  collectVariantNumbers,
  ownershipMapFromCollection,
  preferCollectionOwnership,
} from '@/utils/collectionOwnership';
import type { WishlistPriceItem } from '@/hooks/useWishlistPrices';
import { useVariantPriceHistory } from '@/hooks/useVariantPriceHistory';
import { isFoilVariant } from '@/utils/variants';

interface CatalogDetailPanelProps {
  variantNumber: string;
  catalogListItem?: CardListItem | null;
  embedded?: 'panel' | 'drawer';
  hideCollectionActions?: boolean;
  wishlistItem?: WishlistPriceItem | null;
  hidePriceHistory?: boolean;
}

export function CatalogDetailPanel({
  variantNumber,
  catalogListItem = null,
  embedded = 'panel',
  hideCollectionActions = false,
  wishlistItem = null,
  hidePriceHistory = false,
}: CatalogDetailPanelProps) {
  const detail = useCardDetail(variantNumber, { listItem: catalogListItem });
  const { data: collectionEntries = [] } = useCollection();
  const detailVariants = useMemo(() => {
    if (detail.card) {
      return detail.card.variants.map((variant) => variant.variantNumber);
    }
    if (catalogListItem)
      return collectVariantNumbers([catalogListItem], [variantNumber]);
    return [variantNumber];
  }, [catalogListItem, detail.card, variantNumber]);
  const { collectionByVariant: fetchedOwnership } =
    useCollectionOwnership(detailVariants);
  const collectionByVariant = useMemo(() => {
    const fromCollection = ownershipMapFromCollection(collectionEntries);
    return preferCollectionOwnership(fetchedOwnership, fromCollection);
  }, [collectionEntries, fetchedOwnership]);

  const activeVariantNumber = detail.activeVariant?.variantNumber;
  const activeIsFoil = detail.activeVariant
    ? isFoilVariant(
        detail.activeVariant.variantNumber,
        detail.activeVariant.variantLabel,
        detail.activeVariant.variantType,
        detail.activeVariant.foilMode
      )
    : false;
  const priceHistory = useVariantPriceHistory(activeVariantNumber, {
    isFoil: activeIsFoil,
    enabled: !hidePriceHistory && Boolean(activeVariantNumber),
  });

  if (!detail.card || !detail.activeVariant) {
    if (detail.isLoading) {
      return <CatalogDetailPanelSkeleton />;
    }
    return null;
  }

  return (
    <CatalogDetailPanelBody
      card={detail.card}
      activeVariant={detail.activeVariant}
      detail={detail}
      collectionByVariant={collectionByVariant}
      embedded={embedded}
      hideCollectionActions={hideCollectionActions}
      wishlistItem={wishlistItem}
      hidePriceHistory={hidePriceHistory}
      priceHistory={priceHistory}
    />
  );
}
