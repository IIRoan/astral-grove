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
import { useMobileLayout } from '@/hooks/useBreakpoint';
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
  leading?: ReactNode;
  className?: string;
}

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
  leading,
  className,
}: CatalogActionBarProps) {
  const isMobile = useMobileLayout();

  const collectionControls = (
    <View className="shrink-0 flex-row items-center gap-1.5">
      <CatalogCollectionPillNav value={collection} onChange={onCollectionChange} />
      <CatalogSimpleAddToggle active={simpleAdd} onChange={onSimpleAddChange} />
    </View>
  );

  const renderActionControls = (extraClassName?: string) => (
    <View className={cn('shrink-0 flex-row items-center gap-1.5', extraClassName)}>
      {collectionControls}
      <SortTrigger activeSort={activeSort} onPress={onSortPress} mobile={isMobile} />
      {showFilterTrigger ? (
        <CatalogFilterTrigger
          filters={filters}
          onPress={onFilterPress}
          compact
          mobile={isMobile}
        />
      ) : null}
    </View>
  );

  if (inline && !isMobile) {
    return renderActionControls(className);
  }

  if (isMobile) {
    return (
      <View className={cn('w-full gap-2', className)}>
        <View className="w-full flex-row items-center justify-between gap-2">
          {collectionControls}
          <View className="shrink-0 flex-row items-center gap-1.5">
            <SortTrigger activeSort={activeSort} onPress={onSortPress} mobile />
            {showFilterTrigger ? (
              <CatalogFilterTrigger
                filters={filters}
                onPress={onFilterPress}
                compact
                mobile
              />
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className={cn('w-full flex-row items-center justify-between gap-3', className)}
    >
      <View className="min-w-0 flex-1">{leading ?? null}</View>
      {renderActionControls()}
    </View>
  );
}
