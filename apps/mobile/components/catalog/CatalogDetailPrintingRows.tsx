import { View } from 'react-native';
import type { CardListPrinting } from '@riftbound/contracts';
import { CatalogDetailAddButton } from '@/components/catalog/CatalogDetailAddButton';
import { OwnershipStepper } from '@/components/catalog/OwnershipStepper';
import { TrendTag } from '@/components/catalog/TrendTag';
import { Text } from '@/components/ui/text';
import {
  DETAIL_PRINTING_ID_CLASS,
  DETAIL_PRINTING_LABEL_CLASS,
  DETAIL_PRINTING_PRICE_CLASS,
} from '@/constants/operateType';
import { collectionFinishKey } from '@riftbound/contracts';
import type { CollectionOwnershipMap } from '@/utils/collectionOwnership';
import {
  formatMarketTrend,
  formatPrintingPrice,
  ownedQuantityForPrinting,
} from '@/utils/variants';

interface CatalogDetailPrintingRowsProps {
  printings: CardListPrinting[];
  cardName: string;
  hideCollectionActions: boolean;
  collectionByVariant: CollectionOwnershipMap;
  onAdd: (variantNumber: string, isFoil: boolean) => void;
  onRemove: (variantNumber: string, isFoil: boolean, qty: number) => void;
}

export function CatalogDetailPrintingRows({
  printings,
  cardName,
  hideCollectionActions,
  collectionByVariant,
  onAdd,
  onRemove,
}: CatalogDetailPrintingRowsProps) {
  if (printings.length === 0) return null;

  return (
    <View>
      {printings.map((printing, index) => {
        const qty = ownedQuantityForPrinting(collectionByVariant, printing);
        const rowName = `${cardName} ${printing.variantLabel}`;
        return (
          <View key={collectionFinishKey(printing.variantNumber, printing.isFoil)}>
            {index > 0 ? <View className="h-hairline bg-border/60" /> : null}
            <View className="flex-row items-center justify-between gap-3 px-3 py-3">
              <View className="min-w-0 shrink flex-1" style={{ flexBasis: 0 }}>
                <Text className={DETAIL_PRINTING_LABEL_CLASS} numberOfLines={2}>
                  {printing.variantLabel}
                </Text>
                <Text className={DETAIL_PRINTING_ID_CLASS} numberOfLines={1}>
                  {printing.variantNumber}
                </Text>
                <View className="mt-0.5 flex-row flex-wrap items-center gap-2">
                  <Text className={DETAIL_PRINTING_PRICE_CLASS}>
                    {formatPrintingPrice(printing.priceEur) ?? '—'}
                  </Text>
                  <TrendTag trend={formatMarketTrend(printing.priceEur)} />
                </View>
              </View>
              <View className="shrink-0">
                {!hideCollectionActions ? (
                  qty > 0 ? (
                    <OwnershipStepper
                      owned={qty}
                      name={rowName}
                      compact
                      relaxed
                      printings={[printing]}
                      fixedVariantNumber={printing.variantNumber}
                      fixedIsFoil={printing.isFoil}
                      onAdd={() => {
                        onAdd(printing.variantNumber, printing.isFoil);
                      }}
                      onRemove={() => {
                        onRemove(printing.variantNumber, printing.isFoil, qty);
                      }}
                    />
                  ) : (
                    <CatalogDetailAddButton
                      name={rowName}
                      onPress={() => {
                        onAdd(printing.variantNumber, printing.isFoil);
                      }}
                      className="h-10 min-w-[7.25rem] px-3.5"
                    />
                  )
                ) : qty > 0 ? (
                  <Text className="font-mono text-xs tabular-nums text-muted-foreground">
                    Own {qty}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
