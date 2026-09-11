import { ThemedIcon, PencilIcon } from '@/components/icons';
import { memo, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { DeckFormatBadge } from '@/components/deck/DeckFormatBadge';
import { DeckLegalityBadge } from '@/components/deck/DeckLegalityBadge';
import { DeckListEnergyCurve } from '@/components/deck/DeckListEnergyCurve';
import { DeckListItemMotion } from '@/components/deck/DeckListItemMotion';
import { DeckManageMenu } from '@/components/deck/DeckManageMenu';
import {
  DeckLegendPortrait,
  LEGEND_GRID_BANNER,
  LEGEND_RAIL_MIN_HEIGHT_WIDE,
  LEGEND_RAIL_NARROW,
  LEGEND_RAIL_WIDE,
} from '@/components/deck/DeckLegendRail';
import { DomainIcon } from '@/components/riftbound/CardIcons';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDeckLiveLegality } from '@/hooks/useBanDatesByVariant';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import { useDeckCardImages } from '@/hooks/useDeckCardImages';
import {
  EMPTY_COLLECTION_BY_NAME,
  collectionByNameEqual,
} from '@/lib/collection-by-name';
import { getSectionCount, resolveDeckCardImageUrl } from '@/lib/deck-card';
import { deckSectionProgress } from '@/lib/deck-display';
import type { DeckListLayout } from '@/lib/deck-list';
import { deckListStatus } from '@/lib/deck-list-status';
import { computeDeckStats } from '@/lib/deck-stats';
import type { DeckState } from '@/lib/deck-types';
import { legendFullCardHeight } from '@/lib/legend-list-art';
import { hapticPress } from '@/utils/haptics';
import { cn } from '@/lib/utils';

const DOMAIN_ICON_WIDE = 32;
const DOMAIN_ICON_NARROW = 24;

interface DeckListCardProps {
  deck: DeckState;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onImport?: () => void;
  onDuplicate?: () => void;
  importBusy?: boolean;
  duplicateBusy?: boolean;
  collectionByName?: ReadonlyMap<string, number>;
  collectionReady?: boolean;
  layout?: DeckListLayout;
  motionIndex?: number;
}

const EDITED_DAY_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const EDITED_TIME_FORMAT = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const CREATED_AT_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatTimestamp(value: number, formatter: Intl.DateTimeFormat): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  try {
    return formatter.format(new Date(value));
  } catch {
    return '';
  }
}

function formatEditedAt(value: number): string {
  const day = formatTimestamp(value, EDITED_DAY_FORMAT);
  const time = formatTimestamp(value, EDITED_TIME_FORMAT);
  if (!day) return '';
  return time ? `${day} · ${time}` : day;
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

function DeckListCardInner({
  deck,
  onPress,
  onEdit,
  onDelete,
  onImport,
  onDuplicate,
  importBusy = false,
  duplicateBusy = false,
  collectionByName,
  collectionReady = false,
  layout = 'list',
  motionIndex = 0,
}: DeckListCardProps) {
  const compact = useMobileLayout();
  const grid = layout === 'grid';
  const readOnly = deck.readOnly === true;
  const railWidth = compact ? LEGEND_RAIL_NARROW : LEGEND_RAIL_WIDE;
  const railHeight = compact
    ? legendFullCardHeight(railWidth)
    : LEGEND_RAIL_MIN_HEIGHT_WIDE;
  const [gridBannerWidth, setGridBannerWidth] = useState(railWidth);
  const ownedCollection = collectionByName ?? EMPTY_COLLECTION_BY_NAME;
  const { deck: liveDeck } = useDeckLiveLegality(deck);
  const displayDeck = liveDeck ?? deck;

  const imageVariants = useMemo(() => {
    const variant = displayDeck.legend?.variantNumber;
    return variant ?? '';
  }, [displayDeck.legend?.variantNumber]);

  const { data: imageByVariant = new Map<string, string>() } =
    useDeckCardImages(imageVariants);

  const stats = useMemo(() => computeDeckStats(displayDeck), [displayDeck]);
  const status = useMemo(
    () => deckListStatus(displayDeck, ownedCollection, collectionReady),
    [displayDeck, ownedCollection, collectionReady]
  );
  const main = deckSectionProgress(displayDeck, 'mainDeck');
  const runeCount = getSectionCount(displayDeck, 'runes');
  const battlefieldCount = getSectionCount(displayDeck, 'battlefields');
  const sideCount = getSectionCount(displayDeck, 'sideboard');
  const editedLabel = formatEditedAt(displayDeck.updatedAt);
  const createdLabel = formatTimestamp(displayDeck.createdAt, CREATED_AT_FORMAT);
  const legendColors = displayDeck.legend?.colors ?? [];
  const showIllegalBadge = status.tone === 'illegal';

  const legendUri = displayDeck.legend
    ? resolveDeckCardImageUrl(displayDeck.legend, imageByVariant)
    : '';

  const formatLabel = displayDeck.format === 'pre-rift' ? 'Pre-Rift' : 'Constructed';
  const identityLine = displayDeck.legend
    ? `${formatLabel} · ${displayDeck.legend.name}${displayDeck.champion ? ` · ${displayDeck.champion.name}` : ''}`
    : `${formatLabel} · No legend selected`;

  const openDeck = () => {
    hapticPress();
    onPress();
  };

  const editDeck = () => {
    hapticPress();
    onEdit?.();
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

  const gridArt = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${displayDeck.name}`}
      onPress={openDeck}
      className="w-full overflow-hidden border-b border-border"
      style={{ height: LEGEND_GRID_BANNER }}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== gridBannerWidth) {
          setGridBannerWidth(nextWidth);
        }
      }}
    >
      <DeckLegendPortrait
        imageUri={legendUri}
        variantNumber={displayDeck.legend?.variantNumber}
        fallbackIcon
        width={gridBannerWidth}
        fill
        fade="bottom"
      />
    </Pressable>
  );

  const identity = (
    <View
      className={cn(
        'min-w-0',
        compact || grid ? 'w-full flex-1 gap-2' : 'w-[17rem] shrink-0 gap-4'
      )}
    >
      <View className={compact ? 'gap-1.5' : 'gap-2'}>
        <View className="flex-row items-center gap-1.5">
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${displayDeck.name}. ${identityLine}. ${status.title}. ${status.caption}`}
            onPress={openDeck}
            className="min-w-0 flex-1"
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
          {onEdit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${displayDeck.name}`}
              className="size-8 shrink-0 items-center justify-center rounded-[3px] active:bg-card-panel"
              onPress={editDeck}
            >
              <ThemedIcon icon={PencilIcon} size={16} color="muted-foreground" />
            </Pressable>
          ) : null}
        </View>
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
      {compact ? null : (
        <Text className="font-mono text-[11px] tabular-nums text-muted-foreground">
          Runes {runeCount}/12 · Fields {battlefieldCount}/3
          {sideCount > 0 ? ` · Side ${sideCount}` : ''}
        </Text>
      )}
    </View>
  );

  const timestamps =
    grid || compact || !(editedLabel || createdLabel) ? null : (
      <View className="min-w-[11rem] flex-1 gap-3.5">
        {editedLabel ? (
          <View className="gap-1">
            <Text className="font-mono text-[11px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
              Last edited
            </Text>
            <Text className="text-[16px] font-semibold leading-5 text-foreground">
              {editedLabel}
            </Text>
          </View>
        ) : null}
        {createdLabel ? (
          <View className="gap-1">
            <Text className="font-mono text-[11px] font-medium uppercase tracking-[-0.24px] text-muted-foreground">
              Created
            </Text>
            <Text className="text-[16px] font-semibold leading-5 text-foreground">
              {createdLabel}
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
      className={cn('gap-2', compact || grid ? 'w-full' : 'w-[11.5rem] shrink-0')}
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
    </PressableScale>
    );

  const actions = (
    <View
      className={cn(
        compact || grid
          ? 'w-full flex-row flex-wrap items-center gap-1.5'
          : 'w-[7.75rem] shrink-0 gap-1.5'
      )}
    >
      <Button
        size="sm"
        className={compact || grid ? 'min-w-[5.5rem] flex-1' : 'w-full'}
        onPress={(event) => {
          event.stopPropagation?.();
          openDeck();
        }}
        accessibilityLabel={`Open ${displayDeck.name}`}
      >
        <ButtonText>Open deck</ButtonText>
      </Button>
      {readOnly && onImport ? (
        <Button
          size="sm"
          variant="outline"
          className={compact || grid ? 'min-w-[5.5rem] flex-1' : 'w-full'}
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
      {!readOnly && compact ? (
        <DeckManageMenu
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          duplicateBusy={duplicateBusy}
        />
      ) : null}
      {!compact && !readOnly && onDuplicate ? (
        <Button
          size="sm"
          variant="outline"
          className={compact || grid ? 'min-w-[5.5rem] flex-1' : 'w-full'}
          disabled={duplicateBusy}
          accessibilityLabel={`Duplicate ${displayDeck.name}`}
          onPress={(event) => {
            event.stopPropagation?.();
            hapticPress();
            onDuplicate();
          }}
        >
          <ButtonText>{duplicateBusy ? 'Duplicating…' : 'Duplicate'}</ButtonText>
        </Button>
      ) : null}
      {!compact && onDelete ? (
        <DeckManageMenu
          showLabel
          onDelete={onDelete}
          className={compact || grid ? undefined : 'w-full'}
          triggerClassName={compact || grid ? undefined : 'h-8 w-full'}
        />
      ) : null}
    </View>
  );

  return (
    <DeckListItemMotion index={motionIndex}>
      <View className="overflow-hidden rounded-[10px] border border-border bg-card">
        {grid ? (
          <>
            {gridArt}
            <View className="gap-3 p-3.5">
              {identity}
              {readout}
              {actions}
            </View>
          </>
        ) : (
          <View className="flex-row items-stretch">
            {listArt}
            <View
              className={cn(
                'min-w-0 flex-1 gap-2.5 p-3',
                compact ? undefined : 'flex-row items-stretch justify-between gap-6 p-3.5'
              )}
            >
              {identity}
              {timestamps}
              {readout}
              {actions}
            </View>
          </View>
        )}
      </View>
    </DeckListItemMotion>
  );
}

function deckListCardPropsEqual(
  prev: DeckListCardProps,
  next: DeckListCardProps
): boolean {
  return (
    prev.deck.id === next.deck.id &&
    prev.deck.updatedAt === next.deck.updatedAt &&
    prev.deck.name === next.deck.name &&
    prev.deck.format === next.deck.format &&
    prev.deck.isLegal === next.deck.isLegal &&
    prev.deck.readOnly === next.deck.readOnly &&
    prev.layout === next.layout &&
    prev.motionIndex === next.motionIndex &&
    prev.importBusy === next.importBusy &&
    prev.duplicateBusy === next.duplicateBusy &&
    prev.collectionReady === next.collectionReady &&
    collectionByNameEqual(prev.collectionByName, next.collectionByName) &&
    Boolean(prev.onDelete) === Boolean(next.onDelete) &&
    Boolean(prev.onImport) === Boolean(next.onImport) &&
    Boolean(prev.onDuplicate) === Boolean(next.onDuplicate) &&
    Boolean(prev.onEdit) === Boolean(next.onEdit)
  );
}

export const DeckListCard = memo(DeckListCardInner, deckListCardPropsEqual);
