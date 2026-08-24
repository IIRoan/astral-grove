import { ChevronLeftIcon, PlusIcon } from '@/components/icons';
import { ScrollView, View } from 'react-native';
import type { CardDetail, VariantDetail } from '@riftbound/contracts';
import { PrintingPreviewStrip } from '@/components/cards/PrintingPreviewStrip';
import { CollectionQtyControls } from '@/components/collection/CollectionQtyControls';
import { CollectionAddLog } from '@/components/collection/CollectionAddLog';
import { VariantPriceSummary } from '@/components/catalog/VariantPriceSummary';
import {
  CardAttributeRow,
  CardSectionLabel,
  CardStat,
  CardTag,
} from '@/components/riftbound/CardDetailParts';
import { CardRulesText } from '@/components/riftbound/CardRulesText';
import {
  DomainIcon,
  EnergyPip,
  MightIcon,
  TypeIcon,
} from '@/components/riftbound/CardIcons';
import { CardPreview } from '@/components/riftbound/CardPreview';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Separator } from '@/components/ui/separator';
import { Stack } from '@/components/ui/stack';
import { Text } from '@/components/ui/text';
import { formatStat } from '@/utils/cardFormat';
import {
  formatMarketTrend,
  getVariantMarketPriceDisplays,
  pickVariantDisplayPrice,
  toPriceEurSummary,
} from '@/utils/variants';
import { useIsDesktopLayout } from '@/hooks/useResponsiveColumns';
import { useCollectionRecentAdds } from '@/hooks/useCollectionRecentAdds';

const PAGE_CARD_WIDTH = 300;

interface Props {
  card: CardDetail;
  activeVariant: VariantDetail;
  collectionEntry: { quantity: number; isFoil: boolean } | null | undefined;
  printingPreviews: {
    id: string;
    variantNumber: string;
    variantLabel: string;
    variantType?: string;
    imageUrl: string;
    price?: string | null;
  }[];
  onClose: () => void;
  onAddToCollection: () => void;
  onQuantityChange: (delta: number) => void;
  onRemoveFromCollection: () => void;
  onSelectPrinting: (variantNumber: string) => void;
}

export function CardDetailPage({
  card,
  activeVariant,
  collectionEntry,
  printingPreviews,
  onClose,
  onAddToCollection,
  onQuantityChange,
  onRemoveFromCollection,
  onSelectPrinting,
}: Props) {
  const isDesktop = useIsDesktopLayout();
  const setCode = activeVariant.variantNumber.split('-')[0] ?? '';
  const marketPrices = getVariantMarketPriceDisplays(activeVariant);
  const singleMarketPrice = marketPrices[0] ?? null;
  const activePrice = pickVariantDisplayPrice(activeVariant.prices, activeVariant);
  const singlePriceTrend = formatMarketTrend(toPriceEurSummary(activePrice));
  const { events } = useCollectionRecentAdds(
    card.variants.map((variant) => variant.variantNumber)
  );

  const info = (
    <>
      <View className="relative px-8 pb-4 pt-4">
        <Button
          size="icon-sm"
          variant="secondary"
          className="mb-3 size-9 rounded-[3px]"
          onPress={onClose}
        >
          <ButtonIcon>
            <ChevronLeftIcon className="size-[22px] text-foreground" />
          </ButtonIcon>
        </Button>
        <Text className="mb-2 text-[11px] font-normal uppercase tracking-[0.18em] text-muted-foreground">
          {setCode} · {activeVariant.variantNumber}
        </Text>
        <Heading level="2" className="font-black leading-[1.1] tracking-tight">
          {card.name}
        </Heading>
        {singleMarketPrice ? (
          <VariantPriceSummary
            label={singleMarketPrice.label}
            price={singleMarketPrice.price}
            trend={singlePriceTrend}
            className="mt-3"
          />
        ) : null}
      </View>

      <CollectionAddLog events={events} className="mx-8 mb-2" />

      <View className="mx-8 mb-4 flex-row overflow-hidden rounded-[10px] bg-card">
        <CardStat label="Cost">
          <EnergyPip value={card.energy} size={32} />
        </CardStat>
        <Separator orientation="vertical" className="h-auto" />
        <CardStat label="Might">
          <Stack direction="row" className="items-center gap-1.5">
            <MightIcon size={20} />
            <Text className="text-xl font-black text-foreground">
              {formatStat(card.might)}
            </Text>
          </Stack>
        </CardStat>
        <Separator orientation="vertical" className="h-auto" />
        <CardStat label="Power">
          <Text className="text-xl font-black text-foreground">
            {formatStat(card.power)}
          </Text>
        </CardStat>
      </View>

      <View className="px-8">
        <CardAttributeRow label="Type">
          <TypeIcon type={card.type} />
          <Text className="text-[13px] font-medium text-muted-foreground">
            {card.type}
          </Text>
        </CardAttributeRow>
        {card.colors.length > 0 ? (
          <CardAttributeRow label="Color">
            {card.colors.map((c) => (
              <Stack key={c.id} direction="row" className="items-center gap-1.5">
                <DomainIcon name={c.name} imageUrl={c.imageUrl} />
                <Text className="text-[13px] font-medium text-muted-foreground">
                  {c.name}
                </Text>
              </Stack>
            ))}
          </CardAttributeRow>
        ) : null}
        {card.tags.length > 0 ? (
          <CardAttributeRow label="Tags">
            {card.tags.map((tag) => (
              <CardTag key={tag} label={tag} />
            ))}
          </CardAttributeRow>
        ) : null}
      </View>

      {card.description ? (
        <View className="mx-8 my-2 rounded-[10px] border border-border bg-secondary p-4">
          <CardSectionLabel>Ability</CardSectionLabel>
          <CardRulesText text={card.description} />
        </View>
      ) : null}

      {printingPreviews.length > 1 ? (
        <View className="px-8 pt-3">
          <PrintingPreviewStrip
            items={printingPreviews}
            selectedId={activeVariant.variantNumber}
            onSelect={onSelectPrinting}
          />
        </View>
      ) : null}

      <View className="mx-8 mt-4 border-t border-border pt-4">
        {collectionEntry ? (
          <CollectionQtyControls
            quantity={collectionEntry.quantity}
            isFoil={collectionEntry.isFoil}
            onIncrement={() => {
              onQuantityChange(1);
            }}
            onDecrement={() => {
              onQuantityChange(-1);
            }}
            onRemove={onRemoveFromCollection}
          />
        ) : (
          <Button onPress={onAddToCollection}>
            <ButtonIcon>
              <PlusIcon className="size-[18px] text-foreground" />
            </ButtonIcon>
            <ButtonText>Add to collection</ButtonText>
          </Button>
        )}
      </View>
    </>
  );

  return (
    <View className="flex-1 items-center bg-background">
      <View
        className={`w-full max-w-[860px] flex-1 bg-background ${isDesktop ? 'min-h-[520px] flex-row' : ''}`}
      >
        {isDesktop ? (
          <View
            className="min-h-[520px] bg-card-panel"
            style={{ width: PAGE_CARD_WIDTH }}
          >
            <CardPreview
              imageUrl={activeVariant.imageUrl}
              width={PAGE_CARD_WIDTH}
              minHeight={520}
            />
          </View>
        ) : null}
        <ScrollView
          className="min-w-0 flex-1"
          contentContainerClassName="pb-8"
          showsVerticalScrollIndicator={false}
        >
          {!isDesktop ? (
            <View className="h-[360px] bg-card-panel">
              <CardPreview imageUrl={activeVariant.imageUrl} minHeight={360} />
            </View>
          ) : null}
          <View className="pb-7">{info}</View>
        </ScrollView>
      </View>
    </View>
  );
}
