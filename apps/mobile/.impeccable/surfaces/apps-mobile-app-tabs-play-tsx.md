---
version: 1
slug: 'apps-mobile-app-tabs-play-tsx'
primary_target: 'apps/mobile/app/(tabs)/play.tsx'
related_targets:
  - 'apps/mobile/components/play/PlayerScoreSeat.tsx'
  - 'apps/mobile/components/play/PlaySetupSheet.tsx'
  - 'apps/mobile/components/play/PlayLegendPicker.tsx'
---

# Play scoreboard

## Scope & mode

Operate — live table scoreboard inside The Astral Grove mobile. Extends the incumbent tetra-ui / Uniwind world; no new brand system.

## Audience & job

Players at a shop or kitchen table use one phone as a shared scoreboard. Job: track victory points to the mode’s win score and XP for Unleashed Level/Hunt play.

## Direction

Phone-as-table: opposing seats (top half rotated 180°) for 2–4 players. Hero is the VP numeral. Lean trackers only: VP + XP. Format settings cover Duel, Match, Skirmish, War, Magma Chamber.

Seat affordances are **etched halves**: soft typographic −/+ marks in each half (no floating discs). Legend identity is bare name — no bordered icon chip.

Play settings drawer is a **scoreboard strip**: current format called out, then hairline format rows with explainers and a check — no stacked cards. Legend picking is seat-only.

## Memorable moment

“Final point” cue at victoryScore−1; Victory banner when a seat/team hits the threshold.

## Motion

Apple-restraint scoreboard motion via Reanimated (`lib/motion.ts`): spring VP/XP pops, Final-point pulse + Victory zoom/frame settle, rail pressure + Next enter. All gated by `useReduceMotion`.

## Unresolved

Seat rename UI deferred; timer/coin-toss deliberately out of lean scope.
