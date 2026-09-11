import { memo, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { DeckFormatBadge } from '@/components/deck/DeckFormatBadge';
import { DeckLegalityBadge } from '@/components/deck/DeckLegalityBadge';
import { DeckListEnergyCurve } from '@/components/deck/DeckListEnergyCurve';
import { DeckListItemMotion } from '@/components/deck/DeckListItemMotion';
import {
  DeckLegendPortrait,
  LEGEND_RAIL_MIN_HEIGHT_WIDE,
  LEGEND_RAIL_NARROW,
  LEGEND_RAIL_WIDE,
} from '@/components/deck/DeckLegendRail';
import { DomainIcon } from '@/components/riftbound/CardIcons';
import { ContentKeywordBadge } from '@/components/riftbound/RiftboundBadges';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDeckLiveLegality } from '@/hooks/useBanDatesByVariant';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useDeckCardImages } from '@/hooks/useDeckCardImages';
import { formatDeckRelativeTime, formatDeckStatCount } from '@/lib/deck-browse';
import { resolveDeckCardImageUrl } from '@/lib/deck-card';
import { deckSectionProgress } from '@/lib/deck-display';
import { deckListStatus } from '@/lib/deck-list-status';
import { computeDeckStats } from '@/lib/deck-stats';
import type { DeckState } from '@/lib/deck-types';
import { legendFullCardHeight } from '@/lib/legend-list-art';
import { hapticPress } from '@/utils/haptics';
import { cn } from '@/lib/utils';

const DOMAIN_ICON_WIDE = 32;
const DOMAIN_ICON_NARROW = 24;

interface DeckBrowseCardProps {
  deck: DeckState;
  onPress: () => void;
  onImport?: () => void;
  importBusy?: boolean;
  motionIndex?: number;
}

function StatusMark({
  tone,
}: {
  tone: 'complete' | 'attention' | 'incomplete' | 'illegal';
}) {
  return (
    <View
      className={cn(
        'mt-1 size-1.5 rounded-full',
        tone === 'complete'
          ? 'bg-success'
          : tone === 'illegal'
            ? 'bg-destructive'
            : 'bg-warning'
      )}
    />
  );
}

function DeckBrowseCardInner({
  deck,
  onPress,
  onImport,
  importBusy = false,
  motionIndex = 0,
}: DeckBrowseCardProps) {
  const compact = useMobileLayout();
  const railWidth = compact ? LEGEND_RAIL_NARROW : LEGEND_RAIL_WIDE;
  const railHeight = compact
    ? legendFullCardHeight(railWidth)
    : LEGEND_RAIL_MIN_HEIGHT_WIDE;
  const { deck: liveDeck } = useDeckLiveLegality(deck);
  const displayDeck = liveDeck ?? deck;
  const imageVariants = displayDeck.legend?.variantNumber ?? '';
  const { data: imageByVariant = new Map<string, string>() } =
    useDeckCardImages(imageVariants);
  const legendUri = displayDeck.legend
    ? resolveDeckCardImageUrl(displayDeck.legend, imageByVariant)
    : '';
  const legendColors = displayDeck.legend?.colors ?? [];
  const main = deckSectionProgress(displayDeck, 'mainDeck');
  const stats = useMemo(() => computeDeckStats(displayDeck), [displayDeck]);
  const status = useMemo(
    () => deckListStatus(displayDeck, new Map(), false),
    [displayDeck]
  );
  const showIllegalBadge = status.tone === 'illegal';
  const viewsLabel =
    displayDeck.views !== undefined ? formatDeckStatCount(displayDeck.views) : '';
  const likesLabel =
    displayDeck.likes !== undefined ? formatDeckStatCount(displayDeck.likes) : '';
  const updatedLabel = formatDeckRelativeTime(displayDeck.updatedAt);
  const formatLabel = displayDeck.format === 'pre-rift' ? 'Pre-Rift' : 'Constructed';
  const identityLine = displayDeck.legend
    ? `${formatLabel} · ${displayDeck.legend.name}`
    : `${formatLabel} · No legend selected`;

  const openDeck = () => {
    hapticPress();
    onPress();
  };

  const listArt = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${displayDeck.name}`}
      onPress={openDeck}
      className={cn(
        'shrink-0 overflow-hidden',
        compact ? 'self-start' : 'self-stretch'
      )}
      style={
        compact
          ? { width: railWidth, height: railHeight }
          : { width: railWidth, minHeight: railHeight }
      }
    >
      <DeckLegendPortrait
        imageUri={legendUri}
        variantNumber={displayDeck.legend?.variantNumber}
        fallbackIcon
        width={railWidth}
        height={railHeight}
        fill
        crop={!compact}
        fade={compact ? 'none' : 'right'}
      />
    </Pressable>
  );

  const identity = (
    <View
      className={cn(
        'min-w-0',
        compact ? 'w-full flex-1 gap-2' : 'w-[17rem] shrink-0 gap-4'
      )}
    >
      <View className={compact ? 'gap-1.5' : 'gap-2'}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${displayDeck.name}. ${identityLine}. ${status.title}. ${status.caption}`}
          onPress={openDeck}
          className="min-w-0"
          depth={0.985}
        >
          <Text
            className={cn(
              'font-semibold text-foreground',
              compact ? 'text-[16px] leading-5' : 'text-[18px] leading-6'
            )}
            numberOfLines={1}
          >
            {displayDeck.name}
          </Text>
        </PressableScale>
        <View className="flex-row flex-wrap items-center gap-1.5">
          <DeckFormatBadge format={displayDeck.format} />
          <View className="rounded-[3px] border border-border bg-card-panel px-2 py-0.5">
            <Text className="font-mono text-[12px] font-medium tabular-nums text-foreground">
              {main.current}/{main.target}
            </Text>
          </View>
          {showIllegalBadge ? <DeckLegalityBadge isLegal={false} compact /> : null}
        </View>
      </View>
      {legendColors.length > 0 ? (
        <View className="flex-row flex-wrap items-center gap-2">
          {legendColors.map((color) => (
            <DomainIcon
              key={color}
              name={color}
              size={compact ? DOMAIN_ICON_NARROW : DOMAIN_ICON_WIDE}
            />
          ))}
        </View>
      ) : (
        <Text
          className="text-[12px] leading-4 text-muted-foreground"
          numberOfLines={1}
        >
          {displayDeck.legend ? 'No domain identity' : 'No legend selected'}
        </Text>
      )}
      <Text className="text-[12px] leading-4 text-muted-foreground" numberOfLines={1}>
        {displayDeck.authorName ? `by ${displayDeck.authorName}` : 'Public list'}
      </Text>
    </View>
  );

  const communityStats = compact ? null : (
    <View className="min-w-[11rem] flex-1 gap-3.5">
      {viewsLabel ? (
        <View className="gap-1">
          <Text className="font-mono text-[11px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
            Views
          </Text>
          <Text className="text-[16px] font-semibold leading-5 text-foreground">
            {viewsLabel}
          </Text>
        </View>
      ) : null}
      {likesLabel ? (
        <View className="gap-1">
          <Text className="font-mono text-[11px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
            Likes
          </Text>
          <Text className="text-[16px] font-semibold leading-5 text-foreground">
            {likesLabel}
          </Text>
        </View>
      ) : null}
      {updatedLabel ? (
        <View className="gap-1">
          <Text className="font-mono text-[11px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
            Updated
          </Text>
          <Text className="text-[16px] font-semibold leading-5 text-foreground">
            {updatedLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const readout = compact ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${status.title}. ${status.caption}`}
      onPress={openDeck}
      className="w-full"
      contentClassName="flex-row items-center gap-1.5"
      depth={0.985}
    >
      <StatusMark tone={status.tone} />
      <Text
        className={cn(
          'min-w-0 flex-1 text-[13px] font-semibold leading-4',
          status.tone === 'illegal' ? 'text-destructive' : 'text-foreground'
        )}
        numberOfLines={1}
      >
        {status.title}
      </Text>
    </PressableScale>
  ) : (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${status.title}. ${status.caption}`}
      onPress={openDeck}
      className="w-[11.5rem] shrink-0 gap-2"
      contentClassName="gap-2"
      depth={0.985}
    >
      <View className="flex-row items-start gap-1.5">
        <StatusMark tone={status.tone} />
        <View className="min-w-0 flex-1">
          <Text
            className={cn(
              'text-[13px] font-semibold leading-4',
              status.tone === 'illegal' ? 'text-destructive' : 'text-foreground'
            )}
          >
            {status.title}
          </Text>
          <Text className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            {status.caption}
          </Text>
        </View>
      </View>
      {stats.cardCount > 0 ? <DeckListEnergyCurve buckets={stats.energy} /> : null}
      <View className="flex-row flex-wrap items-center gap-1">
        {displayDeck.hasVideo ? <ContentKeywordBadge type="video" /> : null}
        {displayDeck.hasMatchups ? <ContentKeywordBadge type="matchups" /> : null}
        {displayDeck.hasGuide ? <ContentKeywordBadge type="guide" /> : null}
      </View>
    </PressableScale>
  );

  const actions = (
    <View
      className={cn(
        compact
          ? 'w-full flex-row flex-wrap items-center gap-1.5'
          : 'w-[7.75rem] shrink-0 gap-1.5'
      )}
    >
      <Button
        size="sm"
        className={compact ? 'min-w-[5.5rem] flex-1' : 'w-full'}
        onPress={(event) => {
          event.stopPropagation?.();
          openDeck();
        }}
        accessibilityLabel={`Open ${displayDeck.name}`}
      >
        <ButtonText>Open deck</ButtonText>
      </Button>
      {onImport ? (
        <Button
          size="sm"
          variant="outline"
          className={compact ? 'min-w-[5.5rem] flex-1' : 'w-full'}
          disabled={importBusy}
          accessibilityLabel={`Import ${displayDeck.name} to my decks`}
          onPress={(event) => {
            event.stopPropagation?.();
            hapticPress();
            onImport();
          }}
        >
          <ButtonText>{importBusy ? 'Importing…' : 'Import'}</ButtonText>
        </Button>
      ) : null}
    </View>
  );

  return (
    <DeckListItemMotion index={motionIndex}>
      <View className="overflow-hidden rounded-[10px] border border-border bg-card">
        <View className="flex-row items-stretch">
          {listArt}
          <View
            className={cn(
              'min-w-0 flex-1 gap-2.5 p-3',
              compact ? undefined : 'flex-row items-stretch justify-between gap-6 p-3.5'
            )}
          >
            {identity}
            {communityStats}
            {readout}
            {actions}
          </View>
        </View>
      </View>
    </DeckListItemMotion>
  );
}

function deckBrowseCardPropsEqual(
  prev: DeckBrowseCardProps,
  next: DeckBrowseCardProps
): boolean {
  return (
    prev.deck.id === next.deck.id &&
    prev.deck.updatedAt === next.deck.updatedAt &&
    prev.deck.name === next.deck.name &&
    prev.deck.isLegal === next.deck.isLegal &&
    prev.importBusy === next.importBusy &&
    prev.motionIndex === next.motionIndex &&
    Boolean(prev.onImport) === Boolean(next.onImport)
  );
}

export const DeckBrowseCard = memo(DeckBrowseCardInner, deckBrowseCardPropsEqual);
