import { describe, expect, test } from 'bun:test';
import {
  cardEmbeddingDocument,
  cosineSimilarity,
  fuseSearchResultIds,
  isCloseNameMatch,
  lexicalRelevanceScore,
  matchesSearchHaystack,
  normalizeSearchText,
  parseSearchQuery,
  reciprocalRankFusion,
  tokenizeSearchQuery,
  trigramSimilarity,
  wordSimilarity,
  type SearchRankCard,
} from './search-query.js';

const ambessaLegend: SearchRankCard = {
  name: 'Ambessa, Matriarch of War',
  type: 'Legend',
  super: null,
  tags: ['Ambessa'],
  variantNumber: 'VEN-153',
};

const ambessaChampion: SearchRankCard = {
  name: 'Ambessa, The Wolf',
  type: 'Unit',
  super: 'Champion',
  tags: ['Ambessa'],
  variantNumber: 'VEN-084',
};

const hungryWolf: SearchRankCard = {
  name: 'Hungry Wolf',
  type: 'Unit',
  super: null,
  tags: ['Ambessa'],
  variantNumber: 'VEN-125',
};

const soulSpinner: SearchRankCard = {
  name: 'Soul Spinner',
  type: 'Unit',
  super: null,
  tags: [],
  variantNumber: 'OGN-010',
};

const soulspinnerCompact: SearchRankCard = {
  name: 'Soulspinner',
  type: 'Unit',
  super: null,
  tags: [],
  variantNumber: 'VEN-123',
};

describe('normalizeSearchText', () => {
  test('folds commas and dashes into spaces', () => {
    expect(normalizeSearchText('Ambessa, Matriarch of War')).toBe(
      'ambessa matriarch of war'
    );
    expect(normalizeSearchText('Ambessa - Matriarch of War')).toBe(
      'ambessa matriarch of war'
    );
  });
});

describe('parseSearchQuery / tokenizeSearchQuery', () => {
  test('splits on whitespace and lowercases', () => {
    expect(tokenizeSearchQuery('  Vi   Destruct  ')).toEqual(['vi', 'destruct']);
  });

  test('returns empty array for blank input', () => {
    expect(tokenizeSearchQuery('   ')).toEqual([]);
  });

  test('drops stopwords and keeps champion name tokens', () => {
    expect(tokenizeSearchQuery('matriarch of war')).toEqual(['matriarch', 'war']);
    expect(parseSearchQuery('a b').identityTokens).toEqual(['b']);
  });

  test('extracts type-intent tokens separately', () => {
    const parsed = parseSearchQuery('ambessa legend');
    expect(parsed.identityTokens).toEqual(['ambessa']);
    expect(parsed.typeIntents).toEqual(['legend']);
  });
});

describe('matchesSearchHaystack', () => {
  test('matches a second title word despite punctuation', () => {
    expect(matchesSearchHaystack('Ambessa, Matriarch of War', 'matriarch')).toBe(true);
    expect(
      matchesSearchHaystack('Ambessa, Matriarch of War', 'ambessa matriarch')
    ).toBe(true);
  });

  test('matches soul spinner whether spaced or compacted', () => {
    expect(matchesSearchHaystack('Soul Spinner', 'soul spinner')).toBe(true);
    expect(matchesSearchHaystack('Soul Spinner', 'soulspinner')).toBe(true);
    expect(matchesSearchHaystack('Soul Spinner', 'spinner')).toBe(true);
    expect(matchesSearchHaystack('Soulspinner', 'soul spinner')).toBe(true);
  });

  test('blank query matches everything; stopword-only matches nothing', () => {
    expect(matchesSearchHaystack('Vi Destructive', '')).toBe(true);
    expect(matchesSearchHaystack('Vi Destructive', 'the of a')).toBe(false);
  });

  test('matches a one-letter name typo against the Ambessa legend', () => {
    expect(matchesSearchHaystack('Ambessa, Matriarch of War', 'embessa')).toBe(true);
    expect(matchesSearchHaystack('Ambessa, The Wolf', 'embessa')).toBe(true);
    expect(matchesSearchHaystack('Vi Destructive', 'embessa')).toBe(false);
  });

  test('does not treat shared letter scraps as a name match', () => {
    expect(matchesSearchHaystack('Affectionate Poro', 'plate')).toBe(false);
    expect(matchesSearchHaystack('Isolate', 'plate')).toBe(false);
    expect(matchesSearchHaystack('Playful Phantom', 'plate')).toBe(false);
    expect(matchesSearchHaystack('Platewyrm Egg', 'plate')).toBe(true);
    expect(matchesSearchHaystack('Experimental Hexplate', 'plate')).toBe(true);
  });

  test('matches a catalog misspelling when the user types the real name', () => {
    expect(matchesSearchHaystack('Stagazer', 'stargazer')).toBe(true);
    expect(isCloseNameMatch('stargazer', 'Stagazer')).toBe(true);
    expect(isCloseNameMatch('stargazer', 'Falling Star')).toBe(false);
    expect(matchesSearchHaystack('Falling Star', 'stargazer')).toBe(false);
  });
});

describe('trigram / word similarity', () => {
  test('scores a swapped first letter high enough to recall Ambessa', () => {
    expect(trigramSimilarity('embessa', 'ambessa')).toBeGreaterThanOrEqual(0.35);
    expect(
      wordSimilarity('embessa', 'Ambessa, Matriarch of War')
    ).toBeGreaterThanOrEqual(0.35);
  });

  test('scores stargazer against Stagazer closer than against Star', () => {
    expect(trigramSimilarity('stargazer', 'stagazer')).toBeGreaterThanOrEqual(0.45);
    expect(wordSimilarity('stargazer', 'star')).toBeLessThan(0.45);
  });
});

describe('lexicalRelevanceScore', () => {
  test('ranks Ambessa legend ahead of champion unit and tagged package cards', () => {
    const query = 'ambessa';
    const legend = lexicalRelevanceScore(ambessaLegend, query);
    const champion = lexicalRelevanceScore(ambessaChampion, query);
    const tagged = lexicalRelevanceScore(hungryWolf, query);
    expect(legend).toBeLessThan(champion);
    expect(champion).toBeLessThan(tagged);
  });

  test('second-word queries still hit the Ambessa legend', () => {
    expect(matchesSearchHaystack(ambessaLegend.name, 'matriarch')).toBe(true);
    expect(lexicalRelevanceScore(ambessaLegend, 'matriarch')).toBeLessThan(9);
  });

  test('ambessa legend prefers Legend over Unit', () => {
    const query = 'ambessa legend';
    expect(lexicalRelevanceScore(ambessaLegend, query)).toBeLessThan(
      lexicalRelevanceScore(ambessaChampion, query)
    );
    expect(
      matchesSearchHaystack(`${ambessaLegend.name} ${ambessaLegend.type}`, query)
    ).toBe(true);
  });

  test('any-word prefix ranks spinner hits on Soul Spinner', () => {
    expect(lexicalRelevanceScore(soulSpinner, 'spinner')).toBeLessThan(9);
    expect(lexicalRelevanceScore(soulspinnerCompact, 'soul spinner')).toBeLessThan(9);
  });

  test('ranks exact first-word Vi ahead of Viktor prefix and Sivir substring', () => {
    const vi: SearchRankCard = {
      name: 'Vi Destructive',
      type: 'Unit',
      super: null,
      tags: ['Vi'],
      variantNumber: 'OGN-001',
    };
    const viktor: SearchRankCard = {
      name: 'Viktor, Herald of the Arcane',
      type: 'Legend',
      super: null,
      tags: ['Viktor'],
      variantNumber: 'OGN-265',
    };
    const sivir: SearchRankCard = {
      name: 'Sivir, the Battle Mistress',
      type: 'Legend',
      super: null,
      tags: ['Sivir'],
      variantNumber: 'OGN-200',
    };
    expect(lexicalRelevanceScore(vi, 'vi')).toBeLessThan(
      lexicalRelevanceScore(viktor, 'vi')
    );
    expect(lexicalRelevanceScore(viktor, 'vi')).toBeLessThan(
      lexicalRelevanceScore(sivir, 'vi')
    );
  });

  test('ranks Platewyrm and Hexplate ahead of unrelated plate-shaped noise', () => {
    const platewyrm: SearchRankCard = {
      name: 'Platewyrm Egg',
      type: 'Gear',
      super: null,
      tags: [],
      variantNumber: 'VEN-075',
    };
    const hexplate: SearchRankCard = {
      name: 'Experimental Hexplate',
      type: 'Gear',
      super: null,
      tags: [],
      variantNumber: 'SFD-073',
    };
    const poro: SearchRankCard = {
      name: 'Affectionate Poro',
      type: 'Unit',
      super: null,
      tags: ['Poro'],
      variantNumber: 'VEN-024',
    };
    expect(lexicalRelevanceScore(platewyrm, 'plate')).toBeLessThan(
      lexicalRelevanceScore(hexplate, 'plate')
    );
    expect(lexicalRelevanceScore(hexplate, 'plate')).toBeLessThan(
      lexicalRelevanceScore(poro, 'plate')
    );
  });

  test('ranks Stagazer ahead of a weak Star substring hit for stargazer', () => {
    const fallingStar: SearchRankCard = {
      name: 'Falling Star',
      type: 'Spell',
      super: null,
      tags: [],
      variantNumber: 'OGN-029',
    };
    const stagazer: SearchRankCard = {
      name: 'Stagazer',
      type: 'Unit',
      super: null,
      tags: [],
      variantNumber: 'VEN-098',
    };
    expect(lexicalRelevanceScore(stagazer, 'stargazer')).toBeLessThan(
      lexicalRelevanceScore(fallingStar, 'stargazer')
    );
  });
});

describe('vector helpers', () => {
  test('cosineSimilarity is 1 for identical vectors and 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  test('reciprocalRankFusion prefers ids that rank well on both lists', () => {
    const fused = reciprocalRankFusion([
      ['legend', 'unit', 'spell'],
      ['unit', 'legend', 'gear'],
    ]);
    expect(fused.get('legend') ?? 0).toBeGreaterThan(fused.get('spell') ?? 0);
    expect(fused.get('unit') ?? 0).toBeGreaterThan(fused.get('gear') ?? 0);
  });

  test('fuseSearchResultIds keeps legend boost above a vector-only tag hit', () => {
    const cards = new Map<string, SearchRankCard>([
      ['legend', ambessaLegend],
      ['wolf', hungryWolf],
    ]);
    const fused = fuseSearchResultIds(['wolf', 'legend'], ['wolf'], cards, 'ambessa');
    expect(fused[0]).toBe('legend');
  });

  test('cardEmbeddingDocument includes name type tags and rules', () => {
    const doc = cardEmbeddingDocument({
      name: 'Ambessa, Matriarch of War',
      type: 'Legend',
      tags: ['Ambessa'],
      effect: 'Ready a unit.',
      description: '',
    });
    expect(doc).toContain('Ambessa, Matriarch of War');
    expect(doc).toContain('Legend');
    expect(doc).toContain('Ready a unit.');
  });
});
