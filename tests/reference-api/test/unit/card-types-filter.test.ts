import { describe, expect, test } from 'bun:test';
import { cardTypeMatchesFilters } from '@riftbound/contracts';
import { buildCardTypesCondition } from '../../src/lib/card-types-filter.js';

function sqlFragmentText(condition: unknown): string {
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks ?? [];
  const parts: string[] = [];
  for (const chunk of chunks) {
    if (typeof chunk === 'string') {
      parts.push(chunk);
      continue;
    }
    if (chunk && typeof chunk === 'object' && 'value' in chunk) {
      const value = (chunk as { value: unknown }).value;
      if (Array.isArray(value)) parts.push(value.map(String).join(''));
      else if (value != null) parts.push(String(value));
    }
  }
  return parts.join('');
}

describe('buildCardTypesCondition', () => {
  test('returns undefined for empty type list', () => {
    expect(buildCardTypesCondition([])).toBeUndefined();
    expect(buildCardTypesCondition(['', '  '])).toBeUndefined();
  });

  test('uses token-array overlap so Unit Gear cannot regress to exact IN', () => {
    const condition = buildCardTypesCondition(['Unit', 'Gear', 'Spell']);
    expect(condition).toBeDefined();
    const sqlText = sqlFragmentText(condition);
    expect(sqlText).toContain('string_to_array');
    expect(sqlText).toContain('&& ARRAY[');
    expect(sqlText).not.toContain(' in (');
  });

  test('JS semantics stay aligned with deck-builder type lists', () => {
    expect(cardTypeMatchesFilters('Unit Gear', ['Unit', 'Gear', 'Spell'])).toBe(true);
    expect(cardTypeMatchesFilters('Unit Gear', ['Spell'])).toBe(false);
    expect(cardTypeMatchesFilters('Unit', ['Unit', 'Gear', 'Spell'])).toBe(true);
  });
});
