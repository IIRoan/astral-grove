export function deckVersionSaveKey(deckId: string, versionId?: string): string {
  return versionId ? `${deckId}:${versionId}` : deckId;
}

export function isSaveKeyForDeck(key: string, deckId: string): boolean {
  return key === deckId || key.startsWith(`${deckId}:`);
}

export function formatVersionUpdatedAt(ms: number, now = Date.now()): string {
  const delta = Math.max(0, now - ms);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}
