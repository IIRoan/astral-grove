import { describe, expect, test } from 'bun:test';
import { cn } from '@/lib/utils';

describe('cn', () => {
  test('merges conflicting tailwind classes', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  test('joins conditionals and objects', () => {
    expect(cn('base', false && 'hidden', { active: true })).toBe('base active');
  });
});
