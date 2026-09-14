import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ArrowUpDownIcon,
  CheckIcon,
  LayoutGridIcon,
  ListIcon,
  SlidersHorizontalIcon,
  ThemedIcon,
} from '@/components/icons';
import {
  CatalogToolbarBadgeDot,
  CatalogToolbarButton,
} from '@/components/catalog/CatalogToolbarButton';
import { CatalogSegmentedControl } from '@/components/catalog/CatalogSegmentedControl';
import {
  AppSheet,
  AppSheetContent,
  AppSheetHeader,
  AppSheetOverlay,
  AppSheetPortal,
  AppSheetScrollView,
  AppSheetTitle,
} from '@/components/ui/app-sheet';
import {
  Popover,
  PopoverContent,
  PopoverOverlay,
  PopoverPortal,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Text } from '@/components/ui/text';
import {
  catalogToolbarButtonClasses,
  catalogToolbarGroupClass,
  catalogToolbarIconColor,
  catalogToolbarSegmentClasses,
} from '@/constants/catalogToolbar';
import { useMobileLayout } from '@/hooks/useBreakpoint';
import type {
  DeckListLayout,
  OwnedDeckFormatFilter,
  OwnedDeckSort,
} from '@/lib/deck-list';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

const FORMAT_TABS: {
  id: OwnedDeckFormatFilter;
  label: string;
}[] = [
  { id: 'all', label: 'All' },
  { id: 'constructed', label: 'Constructed' },
  { id: 'pre-rift', label: 'Pre-Rift' },
];

const SORT_OPTIONS: { id: OwnedDeckSort; label: string }[] = [
  { id: 'edited', label: 'Last edited' },
  { id: 'created', label: 'Created' },
  { id: 'name', label: 'Name' },
];

const LAYOUT_OPTIONS = [
  {
    id: 'list' as const,
    label: 'List',
    accessibilityLabel: 'List view',
    icon: ListIcon,
  },
  {
    id: 'grid' as const,
    label: 'Grid',
    accessibilityLabel: 'Grid view',
    icon: LayoutGridIcon,
  },
];

export type OwnedDeckFormatCounts = {
  all: number;
  constructed: number;
  'pre-rift': number;
};

interface DecksListOwnedToolbarProps {
  formatFilter: OwnedDeckFormatFilter;
  onFormatFilterChange: (value: OwnedDeckFormatFilter) => void;
  formatCounts: OwnedDeckFormatCounts;
  sort: OwnedDeckSort;
  onSortChange: (value: OwnedDeckSort) => void;
  layout: DeckListLayout;
  onLayoutChange: (value: DeckListLayout) => void;
}

/** Owned-deck view controls: inline on desktop, one options button + sheet on phones. */
export function DecksListOwnedToolbar(props: DecksListOwnedToolbarProps) {
  const isMobile = useMobileLayout();
  return isMobile ? (
    <OwnedDeckOptionsButton {...props} />
  ) : (
    <OwnedDeckInlineControls {...props} />
  );
}

function FormatTabs({
  formatFilter,
  onFormatFilterChange,
  formatCounts,
  mobile,
}: Pick<
  DecksListOwnedToolbarProps,
  'formatFilter' | 'onFormatFilterChange' | 'formatCounts'
> & { mobile: boolean }) {
  return (
    <View
      accessibilityRole="tablist"
      className={cn(catalogToolbarGroupClass(mobile), mobile && 'w-full')}
    >
      {FORMAT_TABS.map((tab) => {
        const active = formatFilter === tab.id;
        const count = formatCounts[tab.id];
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${tab.label}, ${count} decks`}
            onPress={() => {
              if (active) return;
              hapticPress();
              onFormatFilterChange(tab.id);
            }}
            className={cn(
              catalogToolbarSegmentClasses(active, mobile, true),
              mobile && 'min-w-0 flex-1 justify-center'
            )}
          >
            <Text
              className={cn(
                'text-[13px] font-normal leading-none',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            <Text
              className={cn(
                'font-mono text-[11px] font-medium tabular-nums leading-none',
                active ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {count}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OwnedDeckInlineControls({
  formatFilter,
  onFormatFilterChange,
  formatCounts,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
}: DecksListOwnedToolbarProps) {
  const [sortOpen, setSortOpen] = useState(false);
  const sortLabel = SORT_OPTIONS.find((option) => option.id === sort)?.label ?? 'Sort';

  return (
    <View className="shrink-0 flex-row items-center gap-2">
      <FormatTabs
        formatFilter={formatFilter}
        onFormatFilterChange={onFormatFilterChange}
        formatCounts={formatCounts}
        mobile={false}
      />

      <Popover open={sortOpen} onOpenChange={setSortOpen}>
        <PopoverTrigger asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${sortLabel}`}
            className={catalogToolbarButtonClasses(sortOpen, false, true)}
            onPress={() => {
              hapticPress();
            }}
          >
            <ThemedIcon
              icon={ArrowUpDownIcon}
              size={16}
              color={catalogToolbarIconColor(sortOpen ? 'active' : 'inactive')}
            />
            <Text
              className={cn(
                'text-[13px] font-normal leading-none',
                sortOpen ? 'text-foreground' : 'text-muted-foreground'
              )}
              numberOfLines={1}
            >
              {sortLabel}
            </Text>
          </Pressable>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverOverlay className="bg-transparent" closeOnPress />
          <PopoverContent
            side="bottom"
            align="end"
            sideOffset={4}
            className="z-50 min-w-[11.5rem] overflow-hidden rounded-[3px] border border-border bg-popover p-1 shadow-none"
          >
            <Text className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Sort by
            </Text>
            {SORT_OPTIONS.map((option) => (
              <SortOptionRow
                key={option.id}
                label={option.label}
                active={option.id === sort}
                compact
                onPress={() => {
                  onSortChange(option.id);
                  setSortOpen(false);
                }}
              />
            ))}
          </PopoverContent>
        </PopoverPortal>
      </Popover>

      <CatalogSegmentedControl
        value={layout}
        onChange={onLayoutChange}
        options={LAYOUT_OPTIONS}
        iconOnly
        accessibilityRole="tablist"
        segmentAccessibilityRole="tab"
      />
    </View>
  );
}

function SortOptionRow({
  label,
  active,
  compact = false,
  onPress,
}: {
  label: string;
  active: boolean;
  compact?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: active }}
      className={cn(
        'flex-row items-center justify-between rounded-[3px] active:bg-card-panel',
        compact ? 'px-2 py-1.5' : 'min-h-11 px-3 py-2.5'
      )}
      onPress={() => {
        hapticPress();
        onPress();
      }}
    >
      <Text
        className={cn(
          compact ? 'text-sm text-popover-foreground' : 'text-sm text-foreground'
        )}
      >
        {label}
      </Text>
      {active ? (
        <ThemedIcon icon={CheckIcon} size={compact ? 16 : 18} color="foreground" />
      ) : null}
    </Pressable>
  );
}

function OwnedDeckOptionsButton({
  formatFilter,
  onFormatFilterChange,
  formatCounts,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
}: DecksListOwnedToolbarProps) {
  const [open, setOpen] = useState(false);
  // Signal when the list is narrowed or re-ordered away from the defaults.
  const customized = formatFilter !== 'all' || sort !== 'edited';

  return (
    <>
      <CatalogToolbarButton
        icon={SlidersHorizontalIcon}
        mobile
        active={customized}
        accessibilityLabel="Deck view options"
        onPress={() => {
          hapticPress();
          setOpen(true);
        }}
        badge={customized ? <CatalogToolbarBadgeDot /> : null}
      />

      <AppSheet open={open} onOpenChange={setOpen}>
        <AppSheetPortal name="owned-deck-options">
          <AppSheetOverlay />
          <AppSheetContent snapPoints={['70%']}>
            <AppSheetHeader>
              <AppSheetTitle>View options</AppSheetTitle>
            </AppSheetHeader>
            <AppSheetScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-5">
                <View className="gap-2">
                  <Text className="text-xs font-medium text-muted-foreground">
                    Format
                  </Text>
                  <FormatTabs
                    formatFilter={formatFilter}
                    onFormatFilterChange={onFormatFilterChange}
                    formatCounts={formatCounts}
                    mobile
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-xs font-medium text-muted-foreground">
                    Sort by
                  </Text>
                  {SORT_OPTIONS.map((option) => (
                    <SortOptionRow
                      key={option.id}
                      label={option.label}
                      active={option.id === sort}
                      onPress={() => onSortChange(option.id)}
                    />
                  ))}
                </View>

                <View className="gap-2">
                  <Text className="text-xs font-medium text-muted-foreground">
                    Layout
                  </Text>
                  <CatalogSegmentedControl
                    value={layout}
                    onChange={onLayoutChange}
                    options={LAYOUT_OPTIONS}
                    mobile
                    fill
                    accessibilityRole="tablist"
                    segmentAccessibilityRole="tab"
                  />
                </View>
              </View>
            </AppSheetScrollView>
          </AppSheetContent>
        </AppSheetPortal>
      </AppSheet>
    </>
  );
}
