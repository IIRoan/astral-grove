import { View } from 'react-native';
import { MightIcon } from '@/components/riftbound/CardIcons';
import {
  CatalogDetailMetaPill,
  CatalogDetailStat,
} from '@/components/catalog/CatalogDetailMetaParts';
import { CatalogDetailPrintingRows } from '@/components/catalog/CatalogDetailPrintingRows';
import { CardTag } from '@/components/riftbound/CardDetailParts';
import { DomainIcon, RarityIcon } from '@/components/riftbound/CardIcons';
import { Text } from '@/components/ui/text';
import {
  DETAIL_META_VALUE_CLASS,
  DETAIL_STAT_VALUE_CLASS,
} from '@/constants/operateType';
import { formatStat } from '@/utils/cardFormat';
import type { CardListPrinting } from '@riftbound/contracts';
import type { CollectionOwnershipMap } from '@/utils/collectionOwnership';

interface CatalogDetailCollectionStatsProps {
  printings: CardListPrinting[];
  cardName: string;
  hideCollectionActions: boolean;
  collectionByVariant: CollectionOwnershipMap;
  energy: number | null | undefined;
  might: number | null | undefined;
  power: number | null | undefined;
  cardType: string;
  colors: { id: string; name: string; imageUrl?: string }[];
  activeRarity: string;
  tags: string[];
  onAddPrinting: (variantNumber: string, isFoil: boolean) => void;
  onRemovePrinting: (variantNumber: string, isFoil: boolean, qty: number) => void;
}

export function buildCatalogDetailCollectionSections({
  printings,
  cardName,
  hideCollectionActions,
  collectionByVariant,
  energy,
  might,
  power,
  cardType,
  colors,
  activeRarity,
  tags,
  onAddPrinting,
  onRemovePrinting,
}: CatalogDetailCollectionStatsProps) {
  const printingRows =
    printings.length > 0 ? (
      <CatalogDetailPrintingRows
        printings={printings}
        cardName={cardName}
        hideCollectionActions={hideCollectionActions}
        collectionByVariant={collectionByVariant}
        onAdd={onAddPrinting}
        onRemove={onRemovePrinting}
      />
    ) : null;

  const statsRow = (
    <View className="flex-row">
      <CatalogDetailStat label="Cost">
        <Text className={DETAIL_STAT_VALUE_CLASS}>{formatStat(energy ?? 0)}</Text>
      </CatalogDetailStat>
      <View className="w-hairline bg-border" />
      <CatalogDetailStat label="Might">
        <View className="flex-row items-center gap-1">
          <MightIcon size={14} />
          <Text className={DETAIL_STAT_VALUE_CLASS}>{formatStat(might ?? 0)}</Text>
        </View>
      </CatalogDetailStat>
      <View className="w-hairline bg-border" />
      <CatalogDetailStat label="Power">
        <Text className={DETAIL_STAT_VALUE_CLASS}>{formatStat(power ?? 0)}</Text>
      </CatalogDetailStat>
    </View>
  );

  const metaAttributes = (
    <View className="flex-row flex-wrap gap-x-4 gap-y-3">
      <CatalogDetailMetaPill label="Type">
        <Text className={DETAIL_META_VALUE_CLASS}>{cardType}</Text>
      </CatalogDetailMetaPill>
      <CatalogDetailMetaPill label="Domain">
        {colors.length > 0 ? (
          <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
            {colors.map((color) => (
              <View key={color.id} className="flex-row items-center gap-1">
                <DomainIcon name={color.name} imageUrl={color.imageUrl} size={16} />
                <Text className={DETAIL_META_VALUE_CLASS}>{color.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className={DETAIL_META_VALUE_CLASS}>—</Text>
        )}
      </CatalogDetailMetaPill>
      <CatalogDetailMetaPill label="Rarity">
        <View className="flex-row items-center gap-1">
          <RarityIcon rarity={activeRarity} size={16} />
          <Text className={DETAIL_META_VALUE_CLASS}>{activeRarity}</Text>
        </View>
      </CatalogDetailMetaPill>
      <CatalogDetailMetaPill label="Tags">
        {tags.length > 0 ? (
          <View className="flex-row flex-wrap gap-1">
            {tags.map((tag) => (
              <CardTag key={tag} label={tag} />
            ))}
          </View>
        ) : (
          <Text className={DETAIL_META_VALUE_CLASS}>—</Text>
        )}
      </CatalogDetailMetaPill>
    </View>
  );

  return { printingRows, statsRow, metaAttributes };
}
