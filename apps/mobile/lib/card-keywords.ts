const STAT_KEYWORDS = new Set(['might', 'power', 'energy']);

export const DOMAIN_KEYWORD_NAMES = [
  'Fury',
  'Calm',
  'Mind',
  'Body',
  'Chaos',
  'Order',
] as const;

const KEYWORD_BASES = [
  'QUICK-DRAW',
  'WEAPONMASTER',
  'DEATHKNELL',
  'ACCELERATE',
  'TEMPORARY',
  'REACTION',
  'ASSAULT',
  'DEFLECT',
  'LEGION',
  'GANKING',
  'MIGHTY',
  'HIDDEN',
  'REPEAT',
  'VISION',
  'ACTION',
  'SHIELD',
  'EQUIP',
  'SLOW',
  'FAST',
  'TANK',
  'ADD',
] as const;

const SORTED_KEYWORD_BASES = [...KEYWORD_BASES].sort((a, b) => b.length - a.length);

const KEYWORD_BADGE_CLASSES: Record<string, string> = {
  // Timing / permissive — dark teal (#197060)
  ACCELERATE: 'bg-keyword-accelerate',
  ACTION: 'bg-keyword-accelerate',
  REACTION: 'bg-keyword-accelerate',
  REPEAT: 'bg-keyword-accelerate',
  'QUICK-DRAW': 'bg-keyword-accelerate',
  // Combat / defender — magenta (#c8386c)
  ASSAULT: 'bg-keyword-assault',
  GANKING: 'bg-keyword-assault',
  SHIELD: 'bg-keyword-assault',
  TANK: 'bg-keyword-assault',
  DEFLECT: 'bg-keyword-assault',
  LEGION: 'bg-keyword-assault',
  // Unique
  DEATHKNELL: 'bg-keyword-deathknell',
  WEAPONMASTER: 'bg-keyword-weaponmaster',
  VISION: 'bg-keyword-vision',
  // Neutral grey banners
  HIDDEN: 'bg-keyword-default',
  EQUIP: 'bg-keyword-default',
  MIGHTY: 'bg-keyword-default',
  TEMPORARY: 'bg-keyword-default',
  SLOW: 'bg-keyword-default',
  FAST: 'bg-keyword-default',
  ADD: 'bg-keyword-default',
};

export function isStatKeyword(label: string): boolean {
  return STAT_KEYWORDS.has(label.toLowerCase());
}

export function isDomainKeyword(label: string): boolean {
  return DOMAIN_KEYWORD_NAMES.some(
    (name) => name.toLowerCase() === label.toLowerCase()
  );
}

export function isTapToken(label: string): boolean {
  return label.toLowerCase() === 'tap';
}

export function isRuneToken(label: string): boolean {
  return label.toLowerCase() === 'rune';
}

export function parseKeywordToken(
  inner: string
): { base: string; display: string } | null {
  const trimmed = inner.trim();
  const upper = trimmed.toUpperCase();

  const shieldCompact = upper.match(/^SHIELD(\d+)$/);
  if (shieldCompact) {
    return { base: 'SHIELD', display: `SHIELD ${shieldCompact[1]}` };
  }

  for (const base of SORTED_KEYWORD_BASES) {
    if (upper === base) {
      return { base, display: base };
    }

    if (upper.startsWith(`${base} `)) {
      const suffix = trimmed.slice(base.length).trim();
      // REPEAT costs render as icons beside the badge (see expandRepeatKeyword).
      if (base === 'REPEAT' && /^\d+$/.test(suffix)) {
        return { base, display: base };
      }
      return { base, display: `${base} ${suffix}`.trim() };
    }
  }

  return null;
}

export function getKeywordBadgeClassName(keywordBase: string): string {
  const key = keywordBase.toUpperCase();
  return KEYWORD_BADGE_CLASSES[key] ?? 'bg-keyword-default';
}

export function getKeywordInkClassName(keywordBase: string): string {
  if (keywordBase.toUpperCase() === 'DEATHKNELL') {
    return 'text-black';
  }
  return 'text-white';
}
