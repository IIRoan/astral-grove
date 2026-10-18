import { View } from 'react-native';
import {
  FilterChipGrid,
  FilterOptionChip,
} from '@/components/filters/MobileFilterSheet';
import { FilterToggleRow } from '@/components/filters/FilterPrimitives';
import {
  Accordion,
  AccordionContent,
  AccordionIndicator,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Text } from '@/components/ui/text';
import { groupSetFilterOptions } from '@/lib/set-filter-options';

type SetOption = {
  code: string;
  name: string;
  count: number;
};

export function SetFilterOptions({
  options,
  selectedSets,
  onToggle,
  compact = false,
  presentation = 'list',
}: {
  options: readonly SetOption[];
  selectedSets: ReadonlySet<string>;
  onToggle: (code: string) => void;
  compact?: boolean | undefined;
  presentation?: 'list' | 'mobile' | undefined;
}) {
  const { mainline, special } = groupSetFilterOptions(options);
  const selectedSpecialCount = special.filter((set) =>
    selectedSets.has(set.code)
  ).length;

  if (options.length === 0) {
    return (
      <Text className="py-6 text-center text-sm text-muted-foreground">
        No set filters available.
      </Text>
    );
  }

  const renderOptions = (sets: readonly SetOption[]) =>
    presentation === 'mobile' ? (
      <FilterChipGrid>
        {sets.map((set) => (
          <FilterOptionChip
            key={set.code}
            label={set.code}
            active={selectedSets.has(set.code)}
            onPress={() => onToggle(set.code)}
            accessibilityLabel={`${set.name} (${set.code})`}
          />
        ))}
      </FilterChipGrid>
    ) : (
      <View className="gap-0.5">
        {sets.map((set) => (
          <FilterToggleRow
            key={set.code}
            label={set.name}
            subtitle={`${set.code} · ${set.count.toLocaleString()} printings`}
            active={selectedSets.has(set.code)}
            onPress={() => onToggle(set.code)}
            compact={compact}
          />
        ))}
      </View>
    );

  return (
    <View className="gap-3">
      {mainline.length > 0 ? renderOptions(mainline) : null}
      {special.length > 0 ? (
        <Accordion
          collapsible
          animation={presentation === 'list' ? 'deferred' : 'default'}
        >
          <AccordionItem
            value="special-sets"
            className="border-t border-border bg-transparent pt-2 data-[layout=open]:my-0 data-[layout=open]:rounded-none data-[layout=closed-only]:rounded-none"
          >
            <AccordionTrigger
              className="min-h-11 rounded-[3px] bg-transparent px-2 py-2"
              accessibilityLabel={`Special sets${selectedSpecialCount > 0 ? `, ${selectedSpecialCount} selected` : ''}`}
            >
              <Text className="flex-1 text-sm font-medium text-foreground">
                Special sets
              </Text>
              {selectedSpecialCount > 0 ? (
                <Text className="text-xs text-muted-foreground">
                  {selectedSpecialCount} selected
                </Text>
              ) : null}
              <AccordionIndicator />
            </AccordionTrigger>
            <AccordionContent className="px-0 pt-2 pb-0">
              {renderOptions(special)}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </View>
  );
}
