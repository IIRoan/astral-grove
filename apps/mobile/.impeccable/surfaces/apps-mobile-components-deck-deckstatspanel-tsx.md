---
version: 1
slug: 'apps-mobile-components-deck-deckstatspanel-tsx'
primary_target: 'apps/mobile/components/deck/DeckStatsPanel.tsx'
related_targets:
  [
    'apps/mobile/components/deck/DeckStatsCompact.tsx',
    'apps/mobile/components/deck/DeckStatsHistogram.tsx',
    'apps/mobile/components/deck/DeckBuilderWorkspace.tsx',
    'apps/mobile/components/deck/DeckBuilderMiddlePanelToggle.tsx',
    'apps/mobile/components/deck/DeckCompositionList.tsx',
  ]
---

# Deck builder stats

## Scope & mode

Operate — composition instrument inside the existing deck builder. Extends the incumbent tetra-ui / Uniwind world; no new brand system.

## Audience & job

Players building or inspecting a list. Job: see energy/power shape, domain mix, type split, curve bands, copy density, and rarity for the playable main body (main deck + champion) without leaving the builder.

## Direction

Live instrument, not a dashboard. Compact readout in the deck-list rail opens Stats; card counts stay on the status strip. Cards / Desc lives under battlefields in the info rail and does not include Stats. Stats uses a Cards (or Deck) back control. Each energy and power cost is a domain-colored column (same fills as runes) with the card count in a reserved row above the plot. Full plots include a left count scale. Cost labels sit on the axis. Domain, type, and rarity mix use official Riftbound icons and status-strip meters. Curve shape and copies use bone meters. Unique / dual / signature are a mono instrument strip, not nested metric cards.

## Memorable moment

The curve itself is the overview: domain color in the bar, count sitting on top of every occupied column.

## Motion

Catalog ↔ Stats uses the existing catalog results handoff (≈180ms fade + snappy settle). Bars are state, not choreography.

## Unresolved

Collection ownership overlay left out of this pass by design. Hands simulator not in scope. No Skia/Victory Native — custom SVG-free Uniwind bars keep domain fills on token classes without a native rebuild.
