import { describe, expect, test } from 'bun:test';
import {
  CardsDetailQuery,
  CollectionAdjustRequest,
  CollectionDeleteQuery,
  CollectionVariantNumbersRequest,
  COLLECTION_VARIANT_LOOKUP_MAX,
  DecksListQuery,
  GlobalSearchQuery,
  ImageThumbQuery,
  OkResponse,
  parseAllowedThumbWidth,
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

  test('parses card detail refresh flags', () => {
    expect(CardsDetailQuery.parse({ refresh: 'true' }).refresh).toBe(true);
    expect(CardsDetailQuery.parse({}).refresh).toBeUndefined();
  });

  test('applies collection adjust defaults and rejects invalid deltas', () => {
    expect(CollectionAdjustRequest.parse({})).toMatchObject({
      delta: 1,
      condition: 'near_mint',
      language: 'en',
    });
    expect(() => CollectionAdjustRequest.parse({ delta: 0 })).toThrow();
    expect(() => CollectionAdjustRequest.parse({ delta: -1 })).toThrow();
  });

  test('parses collection delete query booleans', () => {
    expect(CollectionDeleteQuery.parse({})).toMatchObject({
      condition: 'near_mint',
      language: 'en',
    });
    expect(CollectionDeleteQuery.parse({ isFoil: 'true' }).isFoil).toBe(true);
    expect(() => CollectionDeleteQuery.parse({ condition: 'pristine' })).toThrow();
  });

  test('caps collection variant lookup at the catalog browse limit', () => {
    const variantNumbers = Array.from(
      { length: COLLECTION_VARIANT_LOOKUP_MAX },
      (_, index) => `OGN-${String(index + 1)}`
    );
    expect(
      CollectionVariantNumbersRequest.parse({ variantNumbers }).variantNumbers
    ).toHaveLength(COLLECTION_VARIANT_LOOKUP_MAX);
    expect(() =>
      CollectionVariantNumbersRequest.parse({
        variantNumbers: [...variantNumbers, 'OGN-overflow'],
      })
    ).toThrow();
  });

  test('parses image thumb widths and ignores unknown sizes', () => {
    expect(ImageThumbQuery.parse({ w: '160' }).w).toBe(160);
    expect(ImageThumbQuery.parse({ w: '200' }).w).toBeUndefined();
    expect(parseAllowedThumbWidth('96')).toBe(96);
    expect(parseAllowedThumbWidth('abc')).toBeUndefined();
  });

  test('builds ok ack responses', () => {
    expect(OkResponse.parse({ data: { ok: true } })).toEqual({ data: { ok: true } });
    expect(() => OkResponse.parse({ data: { ok: false } })).toThrow();
  });
});
