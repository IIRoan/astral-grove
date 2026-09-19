---
version: 1
slug: 'apps-mobile-components-cards-cardtile-tsx'
primary_target: 'apps/mobile/components/cards/CardTile.tsx'
related_targets:
  [
    'apps/mobile/components/deck/DeckCatalogGridTile.tsx',
    'apps/mobile/components/collection/GridCollectionControl.tsx',
  ]
---

# Card tile — Tray

## Scope / mode

Operate — search + deck-builder catalog grids only.

## Direction

Tray: art on top, flush `bg-card-panel` tray with one-line name, single-row price + SKU (SKU never clips), and full-width soft Add (`h-9`). Owned uses matching − n +. Plain Pressable so printing picker keeps working. Dense on phone: prefer truncation of long price ranges over growing the tray.

## Memorable moment

Thumb hits a full-width Add under the print.

## Constraints

Do not change drawer / OwnershipStepper / motion / icon system. Preserve quick-add and foil picker.
