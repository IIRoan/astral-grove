import { CardholderIcon, CardsIcon, InboxIcon } from '@/components/icons';
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
  {
    id: 'missing' as const,
    label: 'Missing',
    accessibilityLabel: 'Missing cards',
    icon: InboxIcon,
  },
] as const;

interface CatalogCollectionPillNavProps {
  value: CatalogCollectionFilter;
  onChange: (value: CatalogCollectionFilter) => void;
  className?: string;
}

export function CatalogCollectionPillNav({
  value,
  onChange,
}: CatalogCollectionPillNavProps) {
  const isMobile = useMobileLayout();

  return (
    <CatalogSegmentedControl
      value={value}
      onChange={onChange}
      options={NAV_ITEMS}
      mobile={isMobile}
      iconOnly={isMobile}
      accessibilityRole="tablist"
      segmentAccessibilityRole="tab"
    />
  );
}
