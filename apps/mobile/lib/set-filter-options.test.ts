import { describe, expect, test } from 'bun:test';
import { groupSetFilterOptions } from '@/lib/set-filter-options';

describe('groupSetFilterOptions', () => {
  test('keeps mainline expansions visible and separates special releases', () => {
    const options = [
      { code: 'ARC', count: 6 },
      { code: 'OGN', count: 544 },
      { code: 'OGN-NN', count: 25 },
      { code: 'SFD', count: 434 },
      { code: 'SFD-NN', count: 33 },
      { code: 'UNL', count: 306 },
      { code: 'UNL-NN', count: 19 },
      { code: 'VEN', count: 100 },
      { code: 'VEN-NN', count: 10 },
      { code: 'RAD', count: 100 },
      { code: 'OGS', count: 25 },
      { code: 'WRLD25', count: 4 },
    ];
    const groups = groupSetFilterOptions(options);

    expect(groups.mainline.map((set) => set.code)).toEqual([
      'OGN',
      'SFD',
      'UNL',
      'VEN',
      'RAD',
    ]);
    expect(groups.special.map((set) => set.code)).toEqual([
      'ARC',
      'OGN-NN',
      'SFD-NN',
      'UNL-NN',
      'VEN-NN',
      'OGS',
      'WRLD25',
    ]);
    expect(groups.special[0]).toBe(options[0]);
    expect(options[0]?.code).toBe('ARC');
  });

  test('keeps new upstream sets visible until explicitly classified', () => {
    const futureSet = { code: 'NEW', name: 'New upstream expansion', count: 12 };
    expect(groupSetFilterOptions([futureSet])).toEqual({
      mainline: [futureSet],
      special: [],
    });
  });

  test('recognizes special codes without depending on casing or display names', () => {
    const specialSet = { code: 'arc', name: 'Localized display name' };
    expect(groupSetFilterOptions([specialSet])).toEqual({
      mainline: [],
      special: [specialSet],
    });
  });

  test('handles an empty catalog', () => {
    expect(groupSetFilterOptions([])).toEqual({ mainline: [], special: [] });
  });
});
