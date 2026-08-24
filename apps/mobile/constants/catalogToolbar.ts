import type { ThemedIconColor } from '@/lib/themeIconTokens';
import { cn } from '@/lib/utils';
import { FACTORY_RADIUS_CONTROL_CLASS } from '@/constants/factoryShape';

/** Factory control radius — buttons/nav = 3px (DESIGN.md). */
const CONTROL_RADIUS = FACTORY_RADIUS_CONTROL_CLASS;
const SEGMENT_RADIUS = FACTORY_RADIUS_CONTROL_CLASS;

/** Icon-only toolbar control — matches Layout.minTouchTarget (44px). */
export const CATALOG_TOOLBAR_CONTROL_CLASS = cn(
  'size-11 items-center justify-center border border-border bg-card active:bg-card-panel',
  CONTROL_RADIUS
);

/** Labeled toolbar control (Sort, Quick add, filter triggers). */
export const CATALOG_TOOLBAR_LABELED_CONTROL_CLASS = cn(
  'h-10 shrink-0 flex-row items-center justify-center gap-1.5 border border-border bg-card px-3 active:bg-card-panel',
  CONTROL_RADIUS
);

/** Desktop catalog toolbar row — standalone filter bars (deck builder, etc.). */
export const CATALOG_TOOLBAR_DESKTOP_ROW_CLASS =
  'flex-row flex-wrap items-center gap-1.5';

/** Unified desktop catalog shell — instrument chrome (3px), matches side rail. */
export const CATALOG_TOOLBAR_DESKTOP_SHELL_CLASS = cn(
  'w-full overflow-hidden border border-border bg-card',
  CONTROL_RADIUS
);

/** Primary control row inside the unified shell — fixed single-line height. */
export const CATALOG_TOOLBAR_DESKTOP_PRIMARY_ROW_CLASS =
  'min-h-10 flex-row items-center gap-2 px-1.5 py-1';

/** Active-filter tray under the bordered shell (shell height fixed); gap matches toolbar stack. */
export const CATALOG_TOOLBAR_DESKTOP_CHIP_TRAY_CLASS =
  'w-full flex-row flex-wrap items-center gap-2';

/** Vertical separator between filter and action zones. */
export const CATALOG_TOOLBAR_DESKTOP_DIVIDER_CLASS = 'h-6 w-px shrink-0 bg-border/70';

// ── Active filter chips (Factory instrument chips — match toolbar chrome) ──

/** Outer chip shell — fixed height so color / set / text chips align. */
export const FILTER_CHIP_SHELL_CLASS = cn(
  'h-8 flex-row items-stretch overflow-hidden border border-border bg-card',
  CONTROL_RADIUS
);

export const FILTER_CHIP_CATEGORY_CLASS =
  'justify-center border-r border-border px-2.5';

export const FILTER_CHIP_CATEGORY_LABEL_CLASS =
  'font-mono text-[11px] font-semibold uppercase leading-none tracking-[-0.24px] text-muted-foreground';

export const FILTER_CHIP_VALUE_CLASS = 'min-w-0 flex-row items-center px-2';

export const FILTER_CHIP_VALUE_TEXT_CLASS =
  'text-[12px] font-semibold leading-none text-foreground';

/** Nested value token inside a multi-value chip (e.g. color names) — fits inside h-8. */
export const FILTER_CHIP_VALUE_PILL_CLASS = cn(
  'h-5 flex-row items-center border border-border bg-card-panel pl-1.5 pr-0.5',
  CONTROL_RADIUS
);

export const FILTER_CHIP_DISMISS_CLASS =
  'h-full w-8 shrink-0 items-center justify-center active:bg-card-panel';

export const FILTER_CHIP_DISMISS_COMPACT_CLASS = cn(
  'size-5 shrink-0 items-center justify-center active:opacity-70',
  CONTROL_RADIUS
);

/** Popover / sheet option chips — bone invert when selected (DESIGN.md). */
export const FILTER_OPTION_CHIP_CLASS = cn(
  'min-h-10 flex-row items-center gap-1.5 border px-3 py-2 active:opacity-90',
  CONTROL_RADIUS
);

export const FILTER_OPTION_CHIP_ACTIVE_CLASS = 'border-foreground bg-foreground';
export const FILTER_OPTION_CHIP_IDLE_CLASS = 'border-border bg-transparent';
export const FILTER_OPTION_CHIP_ACTIVE_TEXT_CLASS = 'font-medium text-background';
export const FILTER_OPTION_CHIP_IDLE_TEXT_CLASS = 'font-normal text-muted-foreground';

/** Embedded filter trigger — borderless inside the shell. */
export const CATALOG_TOOLBAR_EMBEDDED_TRIGGER_CLASS = cn(
  'h-8 shrink-0 flex-row items-center gap-1 px-2 active:opacity-90',
  SEGMENT_RADIUS
);

export const CATALOG_TOOLBAR_EMBEDDED_TRIGGER_ACTIVE_CLASS = 'bg-card-panel';

/** Active toolbar icon button — carbon lift, ash stroke (no ring/gold). */
export const CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS = 'border-border bg-card-panel';

/** Segmented control shell (view toggle, All/Owned). */
export const CATALOG_TOOLBAR_GROUP_CLASS = cn(
  'h-10 shrink-0 flex-row items-center border border-border bg-card p-0.5',
  CONTROL_RADIUS
);

/** Icon-only segment inside a segmented toolbar group. */
export const CATALOG_TOOLBAR_SEGMENT_CLASS = cn(
  'h-full aspect-square items-center justify-center',
  SEGMENT_RADIUS
);

/** Labeled segment inside a segmented toolbar group. */
export const CATALOG_TOOLBAR_LABELED_SEGMENT_CLASS = cn(
  'h-full shrink-0 flex-row items-center gap-1.5 px-2.5',
  SEGMENT_RADIUS
);

export const CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS = 'bg-card-panel';
export const CATALOG_TOOLBAR_SEGMENT_INACTIVE_CLASS = 'active:opacity-70';

/** Mobile toolbar row — leading prefs / trailing tools. */
export const CATALOG_TOOLBAR_MOBILE_ROW_CLASS =
  'w-full flex-row items-center justify-between gap-2';

/** Mobile icon control — 44×44 touch target. */
export const CATALOG_TOOLBAR_CONTROL_CLASS_MOBILE = cn(
  'size-11 shrink-0 items-center justify-center border border-border bg-card active:bg-card-panel',
  CONTROL_RADIUS
);

export const CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS_MOBILE =
  'border-border bg-card-panel';

/** Segmented control shell on phone — natural width, matches 44pt row. */
export const CATALOG_TOOLBAR_GROUP_CLASS_MOBILE = cn(
  'h-11 shrink-0 flex-row items-center border border-border bg-card p-0.5',
  CONTROL_RADIUS
);

export const CATALOG_TOOLBAR_SEGMENT_CLASS_MOBILE = cn(
  'h-10 w-10 items-center justify-center',
  SEGMENT_RADIUS
);

export const CATALOG_TOOLBAR_LABELED_SEGMENT_CLASS_MOBILE = cn(
  'h-10 shrink-0 flex-row items-center gap-1.5 px-2.5',
  SEGMENT_RADIUS
);

export const CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS_MOBILE = 'bg-card-panel';

/** Shared bordered input shell — matches catalog toolbar controls. */
export const INPUT_SHELL_CLASS = cn(
  'h-11 min-h-11 border border-border bg-card px-3 py-0 active:bg-card-panel dark:active:bg-card',
  CONTROL_RADIUS
);

/** Search inputs with a leading icon addon. */
export const INPUT_SEARCH_SHELL_CLASS = cn(
  'h-11 min-h-11 border border-border bg-card py-0 pl-0 pr-1 active:bg-card-panel dark:active:bg-card',
  CONTROL_RADIUS
);

/** Multiline input shell — Factory control radius (instrument field, not soft card). */
export const INPUT_TEXTAREA_SHELL_CLASS = cn(
  'min-h-28 items-start border border-border bg-card px-3 py-2 active:bg-card-panel dark:active:bg-card',
  CONTROL_RADIUS
);

export type ToolbarIconTone = 'active' | 'inactive' | 'primary';

/** Icon color for toolbar controls — foreground when active, muted when idle. */
export function catalogToolbarIconColor(tone: ToolbarIconTone): ThemedIconColor {
  if (tone === 'primary') return 'foreground';
  return tone === 'active' ? 'foreground' : 'muted-foreground';
}

export function catalogToolbarGroupClass(mobile = false): string {
  return mobile ? CATALOG_TOOLBAR_GROUP_CLASS_MOBILE : CATALOG_TOOLBAR_GROUP_CLASS;
}

/** Mobile labeled control — compact text + icon (rarely used; prefer icons). */
export const CATALOG_TOOLBAR_LABELED_CONTROL_CLASS_MOBILE = cn(
  'h-11 shrink-0 flex-row items-center justify-center gap-1.5 border border-border bg-card px-2.5 active:bg-card-panel',
  CONTROL_RADIUS
);

export function catalogToolbarButtonClasses(
  active = false,
  mobile = false,
  labeled = false
): string {
  if (mobile && labeled) {
    return cn(
      CATALOG_TOOLBAR_LABELED_CONTROL_CLASS_MOBILE,
      active && CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS_MOBILE
    );
  }
  if (mobile) {
    return cn(
      CATALOG_TOOLBAR_CONTROL_CLASS_MOBILE,
      active && CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS_MOBILE
    );
  }
  if (labeled) {
    return cn(
      CATALOG_TOOLBAR_LABELED_CONTROL_CLASS,
      active && CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS
    );
  }
  return cn(
    CATALOG_TOOLBAR_CONTROL_CLASS,
    active && CATALOG_TOOLBAR_CONTROL_ACTIVE_CLASS
  );
}

export function catalogToolbarSegmentClasses(
  active: boolean,
  mobile = false,
  labeled = false
): string {
  if (mobile) {
    return cn(
      labeled
        ? CATALOG_TOOLBAR_LABELED_SEGMENT_CLASS_MOBILE
        : CATALOG_TOOLBAR_SEGMENT_CLASS_MOBILE,
      active
        ? CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS_MOBILE
        : CATALOG_TOOLBAR_SEGMENT_INACTIVE_CLASS
    );
  }
  return cn(
    labeled ? CATALOG_TOOLBAR_LABELED_SEGMENT_CLASS : CATALOG_TOOLBAR_SEGMENT_CLASS,
    active
      ? CATALOG_TOOLBAR_SEGMENT_ACTIVE_CLASS
      : CATALOG_TOOLBAR_SEGMENT_INACTIVE_CLASS
  );
}
