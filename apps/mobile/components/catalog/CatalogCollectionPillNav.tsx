import { useEffect } from 'react';
import { CardholderIcon, CardsIcon } from '@/components/icons';
import { CatalogSegmentedControl } from '@/components/catalog/CatalogSegmentedControl';
import type { CatalogCollectionFilter } from '@/constants/catalogFilters';
import { useMobileLayout } from '@/hooks/useBreakpoint';

const NAV_ITEMS = [
  {
    id: 'all' as const,
    label: 'All',
    accessibilityLabel: 'All cards',
    icon: CardsIcon,
  },
  {
    id: 'owned' as const,
    label: 'Owned',
    accessibilityLabel: 'Owned cards',
    icon: CardholderIcon,
  },
] as const;

interface CatalogCollectionPillNavProps {
  value: CatalogCollectionFilter;
  onChange: (value: CatalogCollectionFilter) => void;
  /** Desktop icon-only (narrow toolbar); mobile is always icon-only. */
  iconOnly?: boolean;
  className?: string;
}

export function CatalogCollectionPillNav({
  value,
  onChange,
  iconOnly = false,
}: CatalogCollectionPillNavProps) {
  const isMobile = useMobileLayout();
  const resolved = value === 'missing' ? 'all' : value;

  useEffect(() => {
    if (value === 'missing') onChange('all');
  }, [onChange, value]);

  return (
    <CatalogSegmentedControl
      value={resolved}
      onChange={onChange}
      options={NAV_ITEMS}
      mobile={isMobile}
      iconOnly={isMobile || iconOnly}
      accessibilityRole="tablist"
      segmentAccessibilityRole="tab"
    />
  );
}
