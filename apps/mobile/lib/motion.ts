/** Motion palette (Apple snappy/smooth/bouncy); gate scale/translate behind `useReduceMotion`. */

import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';

export const MOTION = {
  /** Arrivals, score ticks, tab indicator — mass=1, stiffness=400, damping=30 */
  snappy: { stiffness: 400, damping: 30, mass: 1 },
  /** Spatial settles (sheets, banners) — mass=1, stiffness=200, damping=24 */
  smooth: { stiffness: 200, damping: 24, mass: 1 },
  /** Press release / micro pops — mass=1, stiffness=500, damping=18 */
  bouncy: { stiffness: 500, damping: 18, mass: 1 },
} as const;

/** Layout/accordion springs — lighter mass for mechanical height expands. */
export const LAYOUT_SPRING = {
  damping: 28,
  stiffness: 340,
  mass: 0.55,
} as const;

/** Chip / tray entry — snappy arrival with tiny settle. */
export const TRAY_SPRING = {
  damping: 30,
  stiffness: 380,
  mass: 0.5,
} as const;

/** Functional press depth (no spring overshoot while held). */
export const PRESS = {
  depth: 0.97,
  activeDepth: 0.94,
  inMs: 90,
  outSpring: MOTION.bouncy,
} as const;

/** Tab / screen crossfade timing when spring specs aren't available. */
export const FADE_TRANSITION = {
  durationMs: 220,
} as const;

/** Measured disclosure resize leads a deferred, unscaled content reveal. */
export const DISCLOSURE_MOTION = {
  resizeMs: 240,
  enterMs: 160,
  enterDelayMs: 50,
  exitMs: 100,
  easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
} as const;

/** Expo-out curve for height collapses and polished settles (near GSAP power3.out). */
export const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);

/** Bottom-tab scene crossfade — mechanical, matches tab indicator. */
export const TAB_SCENE = {
  durationMs: 220,
  easing: Easing.out(Easing.cubic),
} as const;

/** Ambient pulse loops (final-point cue, etc.). */
export const PULSE_MS = 1400;

/** Overlay choreography: smooth open, snappy close; reduced-motion opacity-only; Gorhom backdrop tracks animatedIndex. */
export const OVERLAY = {
  /** Content starts slightly small + below, settles into place. */
  enterScale: 0.96,
  enterY: 12,
  /** Backdrop target opacities (light / dark). */
  backdropLight: 0.5,
  backdropDark: 0.75,
  /** Card modal / card-detail drawer denser scrim. */
  backdropCard: 0.85,
  /** Dialog settle only; sheets release hit-testing at dismiss-start (card detail may keep visual presence until Gorhom closes). */
  unmountMs: 280,
  closeMs: 220,
  closeEasing: Easing.out(Easing.cubic),
} as const;

/** Gorhom / Reanimated spring for drawer + bottom-sheet open/snap. */
export const SHEET_SPRING: WithSpringConfig = {
  ...MOTION.smooth,
  overshootClamping: false,
};

/** Reduced-motion sheet/dialog: short opacity-friendly timing. */
export const SHEET_REDUCED: WithTimingConfig = {
  duration: FADE_TRANSITION.durationMs,
  easing: OVERLAY.closeEasing,
};

/** Dialog / modal close — timing so the panel doesn't bounce off-screen. */
export const OVERLAY_CLOSE: WithTimingConfig = {
  duration: OVERLAY.closeMs,
  easing: OVERLAY.closeEasing,
};
