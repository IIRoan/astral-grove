import { useState } from 'react';
import { View } from 'react-native';
import { CatalogActionBar } from '@/components/catalog/CatalogActionBar';
import { CatalogActiveFilterChips } from '@/components/catalog/FilterSheet';
import { FilterPopoverBar } from '@/components/filters/FilterPrimitives';
import type {
  CatalogCollectionFilter,
  CatalogFilters,
} from '@/constants/catalogFilters';
import type { CatalogSort } from '@/constants/catalogSort';
import {
  CATALOG_TOOLBAR_DESKTOP_DIVIDER_CLASS,
  CATALOG_TOOLBAR_DESKTOP_PRIMARY_ROW_CLASS,
  CATALOG_TOOLBAR_DESKTOP_SHELL_CLASS,
} from '@/constants/catalogToolbar';
import {
  useCatalogDesktopFilterPopoverState,
  useCatalogDesktopFilterSegments,
} from '@/hooks/useCatalogDesktopFilterSegments';
import { catalogToolbarDensityFor } from '@/lib/responsive-layout';

interface CatalogDesktopToolbarProps {
  filters: CatalogFilters;
  onFiltersChange: (filters: CatalogFilters) => void;
  filterActive: boolean;
  activeSort: CatalogSort;
  onSortPress: () => void;
  collection: CatalogCollectionFilter;
  onCollectionChange: (collection: CatalogCollectionFilter) => void;
  simpleAdd: boolean;
  onSimpleAddChange: (simpleAdd: boolean) => void;
}

/** Fixed-height desktop toolbar; no Reanimated `entering` on web (pins tray absolute). */
export function CatalogDesktopToolbar({
  filters,
  onFiltersChange,
  filterActive,
  activeSort,
  onSortPress,
  collection,
  onCollectionChange,
  simpleAdd,
  onSimpleAddChange,
}: CatalogDesktopToolbarProps) {
  const [openSegment, setOpenSegment] = useCatalogDesktopFilterPopoverState();
  const segments = useCatalogDesktopFilterSegments(filters, onFiltersChange);
  // Catalog column is ~550px in the 1024–1430 split layout — shed action labels to fit.
  const [toolbarWidth, setToolbarWidth] = useState<number | null>(null);
  const density = catalogToolbarDensityFor(toolbarWidth);

  return (
    <View
      className="w-full gap-1.5"
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        setToolbarWidth((prev) => (prev === nextWidth ? prev : nextWidth));
      }}
    >
      <View className={CATALOG_TOOLBAR_DESKTOP_SHELL_CLASS}>
        <View className={CATALOG_TOOLBAR_DESKTOP_PRIMARY_ROW_CLASS}>
          {/* Column wrapper so the trigger row stretches to the free width and wraps as a last resort. */}
          <View className="min-w-0 flex-1">
            <FilterPopoverBar
              portalName="catalog-filter-bar"
              openId={openSegment}
              onOpenIdChange={setOpenSegment}
              segments={segments}
              embedded
            />
          </View>

          <View className={CATALOG_TOOLBAR_DESKTOP_DIVIDER_CLASS} />

          <CatalogActionBar
            inline
            density={density}
            activeSort={activeSort}
            onSortPress={onSortPress}
            filters={filters}
            onFilterPress={() => undefined}
            collection={collection}
            onCollectionChange={onCollectionChange}
            simpleAdd={simpleAdd}
            onSimpleAddChange={onSimpleAddChange}
            showFilterTrigger={false}
          />
        </View>
      </View>

      {filterActive ? (
        <CatalogActiveFilterChips filters={filters} onFiltersChange={onFiltersChange} />
      ) : null}
    </View>
  );
}
