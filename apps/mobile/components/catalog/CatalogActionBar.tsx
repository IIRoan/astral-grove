import type { ReactNode } from 'react';
import { View } from 'react-native';
import { CatalogCollectionPillNav } from '@/components/catalog/CatalogCollectionPillNav';
import { CatalogFilterTrigger } from '@/components/catalog/FilterSheet';
import { CatalogSimpleAddToggle } from '@/components/catalog/CatalogSimpleAddToggle';
import { SortTrigger } from '@/components/catalog/SortSheet';
import type {
  CatalogCollectionFilter,
  CatalogFilters,
} from '@/constants/catalogFilters';
import type { CatalogSort } from '@/constants/catalogSort';
import type { CatalogToolbarDensity } from '@/lib/responsive-layout';
import { cn } from '@/lib/utils';

interface CatalogActionBarProps {
  activeSort: CatalogSort;
  onSortPress: () => void;
  filters: CatalogFilters;
  onFilterPress: () => void;
  collection: CatalogCollectionFilter;
  onCollectionChange: (collection: CatalogCollectionFilter) => void;
  simpleAdd: boolean;
  onSimpleAddChange: (simpleAdd: boolean) => void;
  showFilterTrigger?: boolean;
  inline?: boolean;
  /** Inline desktop only — shed labels when the catalog column is narrow. */
  density?: CatalogToolbarDensity;
  leading?: ReactNode;
  className?: string;
}

/** Desktop / inline catalog action cluster (collection, quick add, sort, filters). */
export function CatalogActionBar({
  activeSort,
  onSortPress,
  filters,
  onFilterPress,
  collection,
  onCollectionChange,
  simpleAdd,
  onSimpleAddChange,
  showFilterTrigger = true,
  inline = false,
  density = 'full',
  leading,
  className,
}: CatalogActionBarProps) {
  const inlineDensity = inline ? density : 'full';

  const actionControls = (
    <View className={cn('shrink-0 flex-row items-center gap-1.5', inline && className)}>
      <CatalogCollectionPillNav
        value={collection}
        onChange={onCollectionChange}
        iconOnly={inlineDensity === 'compact'}
      />
      <CatalogSimpleAddToggle
        active={simpleAdd}
        onChange={onSimpleAddChange}
        iconOnly={inlineDensity !== 'full'}
      />
      <SortTrigger
        activeSort={activeSort}
        onPress={onSortPress}
        compact={inlineDensity === 'medium'}
        iconOnly={inlineDensity === 'compact'}
      />
      {showFilterTrigger ? (
        <CatalogFilterTrigger filters={filters} onPress={onFilterPress} compact />
      ) : null}
    </View>
  );

  if (inline) {
    return actionControls;
  }

  return (
    <View
      className={cn('w-full flex-row items-center justify-between gap-3', className)}
    >
      <View className="min-w-0 flex-1">{leading ?? null}</View>
      {actionControls}
    </View>
  );
}
