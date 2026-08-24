import { describe, expect, test } from 'bun:test';
import { blobatar } from 'blobatar';

describe('blobatar seed (user id)', () => {
  test('same user id always produces the same SVG', () => {
    const a = blobatar('user_01HZX9ABCDEF');
    const b = blobatar('user_01HZX9ABCDEF');
    expect(a).toBe(b);
    expect(a.startsWith('<svg')).toBe(true);
  });

  test('different user ids produce different faces', () => {
    expect(blobatar('user_owner')).not.toBe(blobatar('user_partner'));
  });
});
