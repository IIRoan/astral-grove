const STAGGER_MS = 42;
const STAGGER_CAP = 7;

export function deckListItemStaggerMs(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER_CAP) * STAGGER_MS;
}

export type DecksListPane = 'mine' | 'browse';

let lastDecksListPane: DecksListPane | null = null;

export function decksPaneEnterDirection(pane: DecksListPane): -1 | 0 | 1 {
  const prev = lastDecksListPane;
  lastDecksListPane = pane;
  if (prev == null || prev === pane) return 0;
  return pane === 'browse' ? 1 : -1;
}

export function resetDecksPaneDirection(): void {
  lastDecksListPane = null;
}
