import { describe, expect, test } from 'bun:test';
import {
  buildUpstreamDeckListParams,
  buildUpstreamDeckSearchQuery,
} from '../../src/lib/upstream-deck-list-params.js';

describe('buildUpstreamDeckSearchQuery', () => {
  test('combines text, legend, and set filters', () => {
    expect(
      buildUpstreamDeckSearchQuery({
        q: 'control',
        legend: 'Ahri, Nine-Tailed Fox',
        sets: 'OGN,SFD',
      })
    ).toBe('control legend:Ahri, Nine-Tailed Fox set:OGN set:SFD');
  });

  test('returns undefined when no search parts', () => {
    expect(buildUpstreamDeckSearchQuery({})).toBeUndefined();
  });
});

describe('buildUpstreamDeckListParams', () => {
  test('maps browse query to upstream params', () => {
    expect(
      buildUpstreamDeckListParams({
        q: 'ahri',
        page: 2,
        limit: 25,
        sort: 'likes',
        dir: 'desc',
        isLegal: true,
        hasGuide: true,
        source: 'imported',
      })
    ).toEqual({
      page: 2,
      limit: 25,
      sort: 'likes',
      dir: 'desc',
      q: 'ahri',
      isLegal: true,
      hasGuide: true,
    });
  });
});
