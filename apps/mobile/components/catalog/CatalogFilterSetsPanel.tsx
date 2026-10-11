import { SetFilterOptions } from '@/components/filters/SetFilterOptions';
import {
  toggleCatalogFilterValue,
  type CatalogFilterSegmentCommonProps,
} from '@/components/catalog/catalogFilterPanels.shared';

type SetOption = {
  code: string;
  name: string;
  count: number;
};

export function CatalogFilterSetsPanel({
  filters,
  compact,
  presentation,
  onUpdate,
  setOptions,
  selectedSets,
}: CatalogFilterSegmentCommonProps & {
  setOptions: SetOption[];
  selectedSets: Set<string>;
}) {
  return (
    <SetFilterOptions
      options={setOptions}
      selectedSets={selectedSets}
      onToggle={(code) =>
        onUpdate({ sets: toggleCatalogFilterValue(filters.sets, code) })
      }
      compact={compact}
      presentation={presentation}
    />
  );
}
