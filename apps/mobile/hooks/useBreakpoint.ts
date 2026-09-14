import { Platform, useWindowDimensions } from 'react-native';
import { Layout } from '@/constants/Layout';
import {
  isTabletWidth,
  showSideRailFor,
  widthClassFor,
  type WidthClass,
} from '@/lib/responsive-layout';

/** SideRail column width (`pl` gutter + `w-12` card; flush to content) */
export const SIDE_RAIL_WIDTH = Layout.screenPaddingHorizontalRail + 48;

/** Gap between catalog column and detail panel — same as rail shell gutter. */
export const CATALOG_DETAIL_GAP = Layout.screenPaddingHorizontalRail;

const IS_WEB = Platform.OS === 'web';

export function useShowSideRail() {
  const { width } = useWindowDimensions();
  return showSideRailFor(width, IS_WEB);
}

export function useCatalogSplitLayout() {
  return useShowSideRail();
}

/** Native phones/tablets and narrow web — bottom tab bar, single-column layouts. */
export function useMobileLayout() {
  return !useShowSideRail();
}

export function useIsTabletWeb() {
  const { width } = useWindowDimensions();
  return IS_WEB && isTabletWidth(width);
}

/** Reactive width class for any platform (iPad Split View resolves by window width). */
export function useWidthClass(): WidthClass {
  const { width } = useWindowDimensions();
  return widthClassFor(width);
}

export const DETAIL_PANEL_WIDTH = 360;
