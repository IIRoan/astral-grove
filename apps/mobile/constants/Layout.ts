/** Numeric layout for APIs that need px (FlatList styles) instead of Uniwind className. */

export const Layout = {
  screenPaddingHorizontal: 16,
  /** Desktop SideRail gutters: rail→content, content→detail, content→edge must match (px). */
  screenPaddingHorizontalRail: 16,
  gridGap: 16,
  /** Floating tab bar height (px). */
  tabBarHeight: 56,
  /** Gap between tab bar and home indicator / screen edge. */
  tabBarBottomMargin: 12,
  /** Horizontal inset for the floating tab bar pill. */
  tabBarHorizontalInset: 16,
  /** Tighter pill inset below 360pt so six tab labels still fit (iPhone SE 1st gen, Slide Over). */
  tabBarHorizontalInsetCompact: 8,
  tabBarMaxWidth: 400,
  /** Minimum touch target per HIG / Material (px). */
  minTouchTarget: 44,
} as const;

/** Scroll content padding so the last row clears the floating tab bar. */
export function tabBarContentInset(bottomSafeArea: number): number {
  return (
    Layout.tabBarHeight +
    Layout.tabBarBottomMargin +
    Math.max(bottomSafeArea, Layout.tabBarBottomMargin) +
    16
  );
}
