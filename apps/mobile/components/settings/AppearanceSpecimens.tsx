import { useMemo, useState } from 'react';
import { Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import type { CardListItem } from '@riftbound/contracts';
import { CardTile } from '@/components/cards/CardTile';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Text } from '@/components/ui/text';
import { useTheme, type ThemeType } from '@/context/ThemeContext';
import { getCatalogIndexItems, useCatalogIndex } from '@/hooks/useCatalogIndex';
import { Layout } from '@/constants/Layout';
import { GRID_CARD_SIZE_OPTIONS } from '@/lib/grid-columns';
import { cn } from '@/lib/utils';
import type { CollectionOwnershipMap } from '@/utils/collectionOwnership';

/** Fixed specimen paints so Light/Dark previews stay readable regardless of live theme. */
const SPECIMEN = {
  light: { bg: '#f5f5f5', ink: '#1a1a1a', panel: '#e8e8e8', line: '#d0d0d0' },
  dark: { bg: '#1c1c1c', ink: '#f2f2f2', panel: '#2a2a2a', line: '#3a3a3a' },
  accent: '#d4f542',
} as const;

const THEMES: { value: ThemeType; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const GRID_COLS = 3;
const GRID_ROWS = 2;
const GRID_CARD_COUNT = GRID_COLS * GRID_ROWS;
const GRID_TILE_WIDTH = 156;
const GRID_GAP = Layout.gridGap;
const GRID_LAYOUT_WIDTH = GRID_COLS * GRID_TILE_WIDTH + (GRID_COLS - 1) * GRID_GAP;

const LIST_CARD_COUNT = 4;
const LIST_LAYOUT_WIDTH = 420;

/** Inflate virtual canvas so chrome scales down while gaps/type stay proportional. */
const PREVIEW_SCALE_FACTOR = 0.38;
const GRID_CONTENT_WIDTH = GRID_LAYOUT_WIDTH / PREVIEW_SCALE_FACTOR;
const LIST_CONTENT_WIDTH = LIST_LAYOUT_WIDTH / PREVIEW_SCALE_FACTOR;

const EMPTY_OWNERSHIP: CollectionOwnershipMap = new Map();

function ThemeSwatch({ mode }: { mode: 'light' | 'dark' | 'system' }) {
  if (mode === 'system') {
    return (
      <View className="h-16 w-full flex-row overflow-hidden rounded-[3px]">
        <View className="flex-1" style={{ backgroundColor: SPECIMEN.light.bg }}>
          <View
            className="m-1.5 h-2 w-8 rounded-sm"
            style={{ backgroundColor: SPECIMEN.light.ink }}
          />
          <View
            className="mx-1.5 h-6 rounded-sm"
            style={{ backgroundColor: SPECIMEN.light.panel }}
          />
        </View>
        <View className="w-px" style={{ backgroundColor: SPECIMEN.accent }} />
        <View className="flex-1" style={{ backgroundColor: SPECIMEN.dark.bg }}>
          <View
            className="m-1.5 h-2 w-8 rounded-sm"
            style={{ backgroundColor: SPECIMEN.dark.ink }}
          />
          <View
            className="mx-1.5 h-6 rounded-sm"
            style={{ backgroundColor: SPECIMEN.dark.panel }}
          />
        </View>
      </View>
    );
  }

  const paint = SPECIMEN[mode];
  return (
    <View
      className="h-16 w-full overflow-hidden rounded-[3px]"
      style={{ backgroundColor: paint.bg }}
    >
      <View className="flex-row items-center justify-between px-2 pt-2">
        <View className="h-2 w-10 rounded-sm" style={{ backgroundColor: paint.ink }} />
        <View
          className="size-2.5 rounded-sm"
          style={{ backgroundColor: SPECIMEN.accent }}
        />
      </View>
      <View className="mt-2 flex-row gap-1 px-2">
        <View
          className="h-7 flex-1 rounded-sm"
          style={{ backgroundColor: paint.panel }}
        />
        <View
          className="h-7 flex-1 rounded-sm"
          style={{ backgroundColor: paint.panel }}
        />
      </View>
      <View className="mt-1.5 h-px w-full" style={{ backgroundColor: paint.line }} />
    </View>
  );
}

/** Full-size catalog chrome in a wider canvas, scaled down to specimen width. */
function ScaleToFitPreview({
  contentWidth,
  layoutWidth,
  children,
}: {
  contentWidth: number;
  layoutWidth: number;
  children: React.ReactNode;
}) {
  const [boxWidth, setBoxWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const scale = boxWidth > 0 ? boxWidth / contentWidth : 0;
  const scaledHeight =
    scale > 0 && contentHeight > 0 ? Math.ceil(contentHeight * scale) : 96;

  const onBoxLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0) setBoxWidth((prev) => (prev === next ? prev : next));
  };

  const onContentLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.height);
    if (next > 0) setContentHeight((prev) => (prev === next ? prev : next));
  };

  const scaledStyle =
    Platform.OS === 'web'
      ? ({
          width: contentWidth,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        } as const)
      : {
          width: contentWidth,
          transform: [{ scale }],
          transformOrigin: 'top left' as const,
        };

  return (
    <View
      className="w-full overflow-hidden rounded-[3px] bg-background"
      style={{ height: scaledHeight }}
      onLayout={onBoxLayout}
      pointerEvents="none"
    >
      {scale > 0 ? (
        <View style={scaledStyle}>
          <View
            className="items-center"
            style={{ width: contentWidth }}
            onLayout={onContentLayout}
          >
            <View style={{ width: layoutWidth }}>{children}</View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function GridLayoutPreview({ cards }: { cards: CardListItem[] }) {
  const slots = Array.from({ length: GRID_CARD_COUNT }, (_, i) => cards[i] ?? null);

  return (
    <ScaleToFitPreview
      contentWidth={GRID_CONTENT_WIDTH}
      layoutWidth={GRID_LAYOUT_WIDTH}
    >
      <View
        className="flex-row flex-wrap"
        style={{ width: GRID_LAYOUT_WIDTH, gap: GRID_GAP }}
      >
        {slots.map((card, index) => (
          <View
            key={
              card
                ? `${card.variantNumber}-grid-${String(index)}`
                : `grid-slot-${index}`
            }
            style={{ width: GRID_TILE_WIDTH }}
          >
            {card ? (
              <CardTile
                card={card}
                layout="grid"
                mode="search"
                enableQuickAdd={false}
                collectionByVariant={EMPTY_OWNERSHIP}
              />
            ) : (
              <View className="opacity-40">
                <View className="aspect-[5/7] w-full rounded-[10px] bg-card" />
                <View className="mt-2 h-3 w-[70%] rounded bg-card" />
                <View className="mt-1.5 h-2.5 w-[40%] rounded bg-card" />
              </View>
            )}
          </View>
        ))}
      </View>
    </ScaleToFitPreview>
  );
}

function ListLayoutPreview({ cards }: { cards: CardListItem[] }) {
  const slots = Array.from({ length: LIST_CARD_COUNT }, (_, i) => cards[i] ?? null);

  return (
    <ScaleToFitPreview
      contentWidth={LIST_CONTENT_WIDTH}
      layoutWidth={LIST_LAYOUT_WIDTH}
    >
      <View style={{ width: LIST_LAYOUT_WIDTH }}>
        {slots.map((card, index) =>
          card ? (
            <CardTile
              key={`${card.variantNumber}-list-${String(index)}`}
              card={card}
              layout="list"
              mode="search"
              enableQuickAdd={false}
              collectionByVariant={EMPTY_OWNERSHIP}
            />
          ) : (
            <View
              key={`list-slot-${index}`}
              className="flex-row items-center gap-4 px-4 py-3.5 opacity-40"
            >
              <View className="h-[78px] w-[56px] rounded-[3px] bg-card-panel" />
              <View className="min-w-0 flex-1 gap-1.5">
                <View className="h-3 w-[65%] rounded bg-card-panel" />
                <View className="h-2.5 w-[40%] rounded bg-card-panel" />
                <View className="h-2 w-[30%] rounded bg-card-panel" />
              </View>
            </View>
          )
        )}
      </View>
    </ScaleToFitPreview>
  );
}

export function AppearanceSpecimens() {
  const {
    theme,
    setTheme,
    defaultLayout,
    setDefaultLayout,
    gridCardSize,
    setGridCardSize,
  } = useTheme();
  const catalogIndex = useCatalogIndex();
  const previewCards = useMemo(() => {
    const items = getCatalogIndexItems(catalogIndex.data);
    const withArt: CardListItem[] = [];
    for (const item of items) {
      if (!item.imageUrl) continue;
      withArt.push(item);
      if (withArt.length >= GRID_CARD_COUNT) break;
    }
    return withArt;
  }, [catalogIndex.data]);

  return (
    <View className="gap-5">
      <Text className="text-sm text-muted-foreground">
        Preferences sync to your account when signed in. Phone and desktop keep their
        own layout and card size.
      </Text>

      <View className="gap-2">
        <SectionLabel className="mb-0">Theme</SectionLabel>

        <View className="flex-row gap-2">
          {THEMES.map((item) => {
            const selected = theme === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.label} theme`}
                onPress={() => {
                  setTheme(item.value);
                }}
                className={cn(
                  'min-w-0 flex-1 gap-2 rounded-[3px] border p-2 active:opacity-90',
                  selected
                    ? 'border-foreground bg-card-panel'
                    : 'border-border bg-card active:border-border'
                )}
              >
                <ThemeSwatch mode={item.value === 'system' ? 'system' : item.value} />
                <Text
                  className={cn(
                    'px-0.5 text-sm font-normal',
                    selected ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <SectionLabel className="mb-0">Catalog layout</SectionLabel>

        <View className="flex-row items-stretch gap-2">
          {(['list', 'grid'] as const).map((layout) => {
            const selected = defaultLayout === layout;
            return (
              <View
                key={layout}
                className={cn(
                  'relative min-w-0 flex-1 gap-2 rounded-[3px] border p-2',
                  selected ? 'border-foreground bg-card-panel' : 'border-border bg-card'
                )}
              >
                {/* Overlay hit target — CardTile previews render their own buttons. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${layout} layout`}
                  onPress={() => {
                    setDefaultLayout(layout);
                  }}
                  className="absolute inset-0 z-10 rounded-[3px] active:opacity-90"
                />
                <View pointerEvents="none">
                  {layout === 'list' ? (
                    <ListLayoutPreview cards={previewCards} />
                  ) : (
                    <GridLayoutPreview cards={previewCards} />
                  )}
                </View>
                <Text
                  pointerEvents="none"
                  className={cn(
                    'px-0.5 text-sm font-normal capitalize',
                    selected ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {layout}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <SectionLabel className="mb-0">Card size</SectionLabel>
        <Text className="text-sm text-muted-foreground">
          Saved to your account for this device. Phone and desktop keep separate sizes.
        </Text>

        <View className="flex-row gap-2">
          {GRID_CARD_SIZE_OPTIONS.map((item) => {
            const selected = gridCardSize === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.label} card size. ${item.description}`}
                onPress={() => {
                  setGridCardSize(item.value);
                }}
                className={cn(
                  'min-w-0 flex-1 gap-1 rounded-[3px] border px-2 py-2.5 active:opacity-90',
                  selected ? 'border-foreground bg-card-panel' : 'border-border bg-card'
                )}
              >
                <Text
                  className={cn(
                    'text-sm font-medium',
                    selected ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </Text>
                <Text
                  className={cn(
                    'text-[11px] leading-4',
                    selected ? 'text-foreground/80' : 'text-muted-foreground'
                  )}
                  numberOfLines={2}
                >
                  {item.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
