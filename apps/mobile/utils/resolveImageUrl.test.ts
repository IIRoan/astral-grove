import { describe, expect, test } from 'bun:test';
import { resolveThumbImageUrl } from './resolveImageUrl';

describe('resolveThumbImageUrl', () => {
  test('snaps to the nearest width the API serves, or the full image above it', () => {
    const url = '/api/v1/images/cards/ogn-001.png';
    expect(resolveThumbImageUrl(url, 48)).toEndWith('cards/ogn-001.png?w=96');
    expect(resolveThumbImageUrl(url, 160)).toEndWith('cards/ogn-001.png?w=160');
    expect(resolveThumbImageUrl(url, 480)).toEndWith('cards/ogn-001.png');
  });
});
