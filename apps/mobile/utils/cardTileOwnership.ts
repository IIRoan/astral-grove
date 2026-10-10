import type { CardListItem } from '@riftbound/contracts';
import type { CollectionOwnershipMap } from '@/utils/collectionOwnership';
import { resolveQuickAddPrintings } from '@/utils/collectionPrintingPicker';
import { ownedQuantityForPrinting } from '@/utils/variants';

export function cardTileOwnershipEqual(
  card: CardListItem,
  familyContextVariantNumber: string | null | undefined,
  previous: CollectionOwnershipMap | undefined,
  next: CollectionOwnershipMap | undefined
): boolean {
  if (previous === next) return true;
  if (!previous || !next) return false;
  const printings = resolveQuickAddPrintings(
    card,
    familyContextVariantNumber ?? card.variantNumber
  );
  return printings.every(
    (printing) =>
      ownedQuantityForPrinting(previous, printing) ===
      ownedQuantityForPrinting(next, printing)
  );
}
