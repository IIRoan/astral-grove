import { useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  ArrowUpDownIcon,
  CheckIcon,
  LayoutGridIcon,
  ListIcon,
  ThemedIcon,
} from '@/components/icons';
import { CatalogSegmentedControl } from '@/components/catalog/CatalogSegmentedControl';
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

export function DecksListOwnedToolbar({
  formatFilter,
  onFormatFilterChange,
  formatCounts,
  sort,
  onSortChange,
  layout,
  onLayoutChange,
}: DecksListOwnedToolbarProps) {
  const isMobile = useMobileLayout();
  const [sortOpen, setSortOpen] = useState(false);
  const sortLabel = SORT_OPTIONS.find((option) => option.id === sort)?.label ?? 'Sort';

  return (
    <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
      <View
        accessibilityRole="tablist"
        className={cn(catalogToolbarGroupClass(isMobile), isMobile && 'w-full')}
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
                catalogToolbarSegmentClasses(active, isMobile, true),
                isMobile && 'min-w-0 flex-1 justify-center'
              )}
            >
              <Text
                className={
                  active
                    ? 'text-[13px] font-normal leading-none text-foreground'
                    : 'text-[13px] font-normal leading-none text-muted-foreground'
                }
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              <Text
                className={
                  active
                    ? 'font-mono text-[11px] font-medium tabular-nums leading-none text-foreground'
                    : 'font-mono text-[11px] font-medium tabular-nums leading-none text-muted-foreground'
                }
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="ml-auto flex-row items-center gap-2">
        <Popover open={sortOpen} onOpenChange={setSortOpen}>
          <PopoverTrigger asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${sortLabel}`}
              className={catalogToolbarButtonClasses(sortOpen, isMobile, true)}
              onPress={() => {
                hapticPress();
              }}
            >
              <ThemedIcon
                icon={ArrowUpDownIcon}
                size={isMobile ? 18 : 16}
                color={catalogToolbarIconColor(sortOpen ? 'active' : 'inactive')}
              />
              <Text
                className={
                  sortOpen
                    ? 'text-[13px] font-normal leading-none text-foreground'
                    : 'text-[13px] font-normal leading-none text-muted-foreground'
                }
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
              {SORT_OPTIONS.map((option) => {
                const active = option.id === sort;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: active }}
                    className="flex-row items-center justify-between rounded-[3px] px-2 py-1.5 active:bg-card-panel"
                    onPress={() => {
                      hapticPress();
                      onSortChange(option.id);
                      setSortOpen(false);
                    }}
                  >
                    <Text className="text-sm text-popover-foreground">
                      {option.label}
                    </Text>
                    {active ? (
                      <ThemedIcon icon={CheckIcon} size={16} color="foreground" />
                    ) : null}
                  </Pressable>
                );
              })}
            </PopoverContent>
          </PopoverPortal>
        </Popover>

        <CatalogSegmentedControl
          value={layout}
          onChange={onLayoutChange}
          options={LAYOUT_OPTIONS}
          mobile={isMobile}
          iconOnly
          accessibilityRole="tablist"
          segmentAccessibilityRole="tab"
        />
      </View>
    </View>
  );
}
