export type ChampionTagCard = {
  name: string;
  tags: string[];
};

/** Primary champion name from title ("Darius, Hand of Noxus" → "Darius"). */
export function cardPrimaryNameToken(card: Pick<ChampionTagCard, 'name'>): string {
  const head = (card.name.split(' - ')[0] ?? card.name).trim();
  return (head.split(',')[0] ?? head).trim();
}

/** Legend champion tags: card tags when present, else primary name token. */
export function legendChampionTags(legend: ChampionTagCard): string[] {
  const tags = (legend.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  if (tags.length > 0) return tags;

  const primary = cardPrimaryNameToken(legend);
  return primary ? [primary] : [];
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

/** Champion/signature shares an exact (case-insensitive) champion tag with the Legend (CR 103.3.a.2). */
export function sharesLegendChampionTag(
  legend: ChampionTagCard,
  candidate: ChampionTagCard
): boolean {
  const legendTokens = legendChampionTags(legend);
  if (!legendTokens.length) return true;

  const candidateTags = new Set(
    [...candidate.tags, cardPrimaryNameToken(candidate)].map(normalizeTag)
  );
  return [...legendTokens, cardPrimaryNameToken(legend)].some((tag) =>
    candidateTags.has(normalizeTag(tag))
  );
}
