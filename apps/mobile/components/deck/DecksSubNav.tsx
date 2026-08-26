import { CompassIcon, LibraryIcon } from '@/components/icons';
import { usePathname, useRouter } from 'expo-router';
import { CatalogSegmentedControl } from '@/components/catalog/CatalogSegmentedControl';
import { useMobileLayout } from '@/hooks/useBreakpoint';

const NAV_ITEMS = [
  {
    id: 'mine' as const,
    label: 'Mine',
    accessibilityLabel: 'My decks',
    icon: LibraryIcon,
  },
  {
    id: 'browse' as const,
    label: 'Browse',
    accessibilityLabel: 'Browse decks',
    icon: CompassIcon,
  },
] as const;

function isBrowseDecksPath(pathname: string): boolean {
  return pathname.includes('/decks/browse');
}

export function DecksSubNav() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useMobileLayout();
  const browseActive = isBrowseDecksPath(pathname);

  return (
    <CatalogSegmentedControl
      value={browseActive ? 'browse' : 'mine'}
      onChange={(id) => {
        router.replace(id === 'browse' ? '/(tabs)/decks/browse' : '/(tabs)/decks');
      }}
      options={NAV_ITEMS}
      mobile={isMobile}
      accessibilityRole="tablist"
      segmentAccessibilityRole="tab"
    />
  );
}
