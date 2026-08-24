import { View } from 'react-native';
import {
  FilterClearButton,
  FilterPopoverBar,
} from '@/components/filters/FilterPrimitives';
import {
  catalogFiltersActive,
  DEFAULT_CATALOG_FILTERS,
  type CatalogFilters,
} from '@/constants/catalogFilters';
import { CATALOG_TOOLBAR_DESKTOP_ROW_CLASS } from '@/constants/catalogToolbar';
import {
  useCatalogDesktopFilterPopoverState,
  useCatalogDesktopFilterSegments,
} from '@/hooks/useCatalogDesktopFilterSegments';

interface CatalogDesktopFilterBarProps {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
}

export function CatalogDesktopFilterBar({
  filters,
  onFiltersChange,
}: CatalogDesktopFilterBarProps) {
  const [openSegment, setOpenSegment] = useCatalogDesktopFilterPopoverState();
  const segments = useCatalogDesktopFilterSegments(filters, onFiltersChange);

  return (
    <View className={CATALOG_TOOLBAR_DESKTOP_ROW_CLASS}>
      <FilterPopoverBar
        portalName="catalog-filter-bar"
        openId={openSegment}
        onOpenIdChange={setOpenSegment}
        segments={segments}
      />

      {catalogFiltersActive(filters) ? (
        <FilterClearButton
          onPress={() =>
            onFiltersChange({
              ...DEFAULT_CATALOG_FILTERS,
              simpleAdd: filters.simpleAdd,
            })
          }
        />
      ) : null}
    </View>
  );
}
