import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { XIcon } from '@/components/icons';
import { DomainIcon } from '@/components/riftbound/CardIcons';
import { Text } from '@/components/ui/text';
import type { CatalogFilterChip } from '@/constants/catalogFilters';
import {
  FILTER_CHIP_CATEGORY_CLASS,
  FILTER_CHIP_CATEGORY_LABEL_CLASS,
  FILTER_CHIP_DISMISS_CLASS,
  FILTER_CHIP_DISMISS_COMPACT_CLASS,
  FILTER_CHIP_SHELL_CLASS,
  FILTER_CHIP_VALUE_CLASS,
  FILTER_CHIP_VALUE_PILL_CLASS,
  FILTER_CHIP_VALUE_TEXT_CLASS,
} from '@/constants/catalogToolbar';
import { cn } from '@/lib/utils';
import { hapticPress } from '@/utils/haptics';

function parseCatalogFilterChipDisplay(chip: CatalogFilterChip): {
  category: string;
  value?: string;
} {
  if (chip.colorNames && chip.colorNames.length > 0) {
    return { category: chip.label };
  }

  const colonIdx = chip.label.indexOf(': ');
  if (colonIdx !== -1) {
    return {
      category: chip.label.slice(0, colonIdx),
      value: chip.label.slice(colonIdx + 2),
    };
  }

  const statMatch = chip.label.match(/^(Energy|Power|Might)\s+(.+)$/);
  if (statMatch) {
    return { category: statMatch[1]!, value: statMatch[2] };
  }

  return { category: chip.label };
}

function FilterChipDismissButton({
  label,
  onPress,
  compact = false,
  className,
}: {
  label: string;
  onPress: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        hapticPress();
        onPress();
      }}
      hitSlop={compact ? 6 : 4}
      className={cn(
        compact ? FILTER_CHIP_DISMISS_COMPACT_CLASS : FILTER_CHIP_DISMISS_CLASS,
        className
      )}
    >
      <XIcon className="size-3.5 text-muted-foreground" />
    </Pressable>
  );
}

function FilterChipValuePill({
  children,
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <View className={FILTER_CHIP_VALUE_PILL_CLASS}>
      {children}
      {onRemove ? (
        <FilterChipDismissButton
          label={removeLabel ?? 'Remove'}
          onPress={onRemove}
          compact
        />
      ) : null}
    </View>
  );
}

interface CatalogActiveFilterChipProps {
  chip: CatalogFilterChip;
  colorImageByName?: Map<string, { imageUrl?: string } | undefined>;
  onClear: () => void;
  onRemoveColor?: (name: string) => void;
}

export function CatalogActiveFilterChip({
  chip,
  colorImageByName,
  onClear,
  onRemoveColor,
}: CatalogActiveFilterChipProps) {
  const { category, value } = parseCatalogFilterChipDisplay(chip);
  const hasColorPills = Boolean(chip.colorNames && chip.colorNames.length > 0);

  const valueContent =
    hasColorPills && chip.colorNames ? (
      chip.colorNames.map((name) => (
        <FilterChipValuePill
          key={name}
          removeLabel={`Remove ${name} color filter`}
          onRemove={
            onRemoveColor
              ? () => {
                  onRemoveColor(name);
                }
              : undefined
          }
        >
          <View className="flex-row items-center gap-1 pr-0.5">
            <DomainIcon
              name={name}
              imageUrl={colorImageByName?.get(name)?.imageUrl}
              size={14}
            />
            <Text className={FILTER_CHIP_VALUE_TEXT_CLASS}>{name}</Text>
          </View>
        </FilterChipValuePill>
      ))
    ) : value ? (
      <Text className={cn(FILTER_CHIP_VALUE_TEXT_CLASS, 'shrink')} numberOfLines={1}>
        {value}
      </Text>
    ) : null;

  return (
    <View className={FILTER_CHIP_SHELL_CLASS}>
      <View className={FILTER_CHIP_CATEGORY_CLASS}>
        <Text className={FILTER_CHIP_CATEGORY_LABEL_CLASS}>{category}</Text>
      </View>

      {valueContent ? (
        hasColorPills ? (
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            className="min-w-0 flex-1"
            contentContainerClassName="h-8 flex-row items-center gap-1 px-2"
          >
            {valueContent}
          </ScrollView>
        ) : (
          <View className={FILTER_CHIP_VALUE_CLASS}>{valueContent}</View>
        )
      ) : null}

      <View className="justify-center border-l border-border">
        <FilterChipDismissButton label={`Clear ${category} filter`} onPress={onClear} />
      </View>
    </View>
  );
}
