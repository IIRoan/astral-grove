import type { DecksListQuery } from '@riftbound/contracts';

export function buildUpstreamDeckSearchQuery(
  query: Pick<DecksListQuery, 'q' | 'legend' | 'sets'>
): string | undefined {
  const parts: string[] = [];
  const text = query.q?.trim();
  if (text) parts.push(text);

  const legend = query.legend?.trim();
  if (legend) parts.push(`legend:${legend}`);

  const sets =
    query.sets
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  for (const setPrefix of sets) {
    parts.push(`set:${setPrefix}`);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

export function buildUpstreamDeckListParams(
  query: DecksListQuery
): Record<string, string | number | boolean | undefined> {
  const params: Record<string, string | number | boolean | undefined> = {
    page: query.page,
    limit: Math.min(query.limit, 50),
    sort: query.sort,
    dir: query.dir,
  };

  const q = buildUpstreamDeckSearchQuery(query);
  if (q) params.q = q;
  if (query.isLegal !== undefined) params.isLegal = query.isLegal;
  if (query.hasGuide === true) params.hasGuide = true;
  if (query.hasVideo === true) params.hasVideo = true;
  if (query.hasMatchups === true) params.hasMatchups = true;

  return params;
}
