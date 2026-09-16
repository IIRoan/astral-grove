import { Layout, tabBarContentInset } from '@/constants/Layout';
import { BREAKPOINTS } from '@/lib/responsive-layout';

/** Extra list padding below the home indicator when the floating tab bar is hidden. */
const HIDDEN_TAB_BAR_LIST_PAD = 16;

/** Hide floating tab bar on desktop rail, card modals, the scanner, Play, and deep deck routes (edge-to-edge). */
export function mobileTabBarVisible(pathname: string, showRail: boolean): boolean {
  if (showRail) return false;
  if (pathname.startsWith('/card/')) return false;
  if (pathname === '/collection/scan') return false;
  if (pathname === '/play' || pathname.startsWith('/play/')) return false;
  if (pathname.startsWith('/decks/') && pathname !== '/decks/browse') return false;
  return true;
}

/** Scroll/list bottom inset: tab-bar clearance, or safe-area only when the bar is gone. */
export function listBottomInset(
  bottomSafeArea: number,
  tabBarVisible: boolean
): number {
  if (!tabBarVisible) {
    return Math.max(bottomSafeArea, 12) + HIDDEN_TAB_BAR_LIST_PAD;
  }
  return tabBarContentInset(bottomSafeArea);
}

/** Gap between a bottom toast and whatever it floats above. */
const TOAST_GAP = 8;

/** Bottom offset for native toasts: above the floating tab bar, else above the home indicator. */
export function toastBottomOffset(
  bottomSafeArea: number,
  tabBarVisible: boolean
): number {
  if (tabBarVisible) {
    return (
      Math.max(bottomSafeArea, Layout.tabBarBottomMargin) +
      Layout.tabBarHeight +
      TOAST_GAP
    );
  }
  return Math.max(bottomSafeArea, Layout.tabBarBottomMargin) + TOAST_GAP;
}

/** Floating tab bar width: full width minus gutters (tighter on narrow phones), capped, clear of side insets. */
export function mobileTabBarWidth(
  windowWidth: number,
  insets: { left: number; right: number }
): number {
  const gutter =
    windowWidth < BREAKPOINTS.compact
      ? Layout.tabBarHorizontalInsetCompact
      : Layout.tabBarHorizontalInset;
  const available =
    windowWidth - Math.max(gutter, insets.left) - Math.max(gutter, insets.right);
  return Math.max(0, Math.min(available, Layout.tabBarMaxWidth));
}
