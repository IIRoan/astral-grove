import { describe, expect, test } from 'bun:test';
import {
  DecksListQuery,
  GlobalSearchQuery,
  PriceHistoryQuery,
  PricesListQuery,
} from './index.js';

describe('query contracts', () => {
  test('parses deck list booleans and defaults', () => {
    const parsed = DecksListQuery.parse({
      hasGuide: 'true',
      hasVideo: 'false',
      page: '2',
    });

    expect(parsed).toMatchObject({
      hasGuide: true,
      hasVideo: false,
      page: 2,
      limit: 25,
      source: 'all',
    });
  });

  test('parses prices list booleans', () => {
    expect(PricesListQuery.parse({ isFoil: 'true' }).isFoil).toBe(true);
    expect(PricesListQuery.parse({ isFoil: 'false' }).isFoil).toBe(false);
  });

  test('applies price history defaults', () => {
    expect(PriceHistoryQuery.parse({}).days).toBe(30);
  });

  test('keeps global search defaults consistent', () => {
    const parsed = GlobalSearchQuery.parse({ q: 'ahri' });
    expect(parsed.limit).toBe(10);
    expect(parsed.page).toBe(1);
  });
});
