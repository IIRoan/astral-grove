import { describe, expect, test } from 'bun:test';
import {
  blurHoldResultsSearchState,
  changeHoldResultsSearchState,
  clearHoldResultsSearchState,
  holdClearHoldResultsSearchState,
  createHoldResultsSearchState,
  focusHoldResultsSearchState,
  syncHoldResultsSearchState,
} from '@/utils/holdResultsSearchInput';

describe('holdResultsSearchInput', () => {
  test('focus clears draft while remembering the committed query', () => {
    const initial = createHoldResultsSearchState('OGN-015');
    const focused = focusHoldResultsSearchState(initial, 'OGN-015');
    expect(focused).toEqual({ draft: '', holdingFrom: 'OGN-015', focused: true });

    // Parent still has the same committed query — draft stays empty.
    expect(syncHoldResultsSearchState(focused, 'OGN-015')).toEqual(focused);
  });

  test('a second focus event while already focused does not wipe an in-progress draft', () => {
    const typing = changeHoldResultsSearchState('starg');
    expect(focusHoldResultsSearchState(typing, 'starg')).toEqual(typing);
  });

  test('hold-clear empties the draft while staying focused', () => {
    expect(holdClearHoldResultsSearchState('stargazer')).toEqual({
      draft: '',
      holdingFrom: 'stargazer',
      focused: true,
    });
  });

  test('typing after focus drops the hold', () => {
    const focused = focusHoldResultsSearchState(
      createHoldResultsSearchState('OGN-015'),
      'OGN-015'
    );
    expect(changeHoldResultsSearchState('Jinx')).toEqual({
      draft: 'Jinx',
      holdingFrom: null,
      focused: true,
    });
  });

  test('blur without typing restores the committed draft', () => {
    const focused = focusHoldResultsSearchState(
      createHoldResultsSearchState('Captain Farron'),
      'Captain Farron'
    );
    expect(blurHoldResultsSearchState(focused)).toEqual({
      draft: 'Captain Farron',
      holdingFrom: null,
      focused: false,
    });
  });

  test('external committed change replaces the draft', () => {
    const focused = focusHoldResultsSearchState(
      createHoldResultsSearchState('OGN-015'),
      'OGN-015'
    );
    expect(syncHoldResultsSearchState(focused, 'Jinx')).toEqual({
      draft: 'Jinx',
      holdingFrom: null,
      focused: true,
    });
  });

  test('noop sync while focused and draft already matches committed', () => {
    const editing = changeHoldResultsSearchState('Jinx');
    expect(syncHoldResultsSearchState(editing, 'Jinx')).toBe(editing);
  });

  test('lagged parent committed does not overwrite an in-flight draft', () => {
    const typing = changeHoldResultsSearchState('starg');
    expect(syncHoldResultsSearchState(typing, 'star')).toEqual(typing);
  });

  test('typing a new query after focus-hold ignores the previous committed value', () => {
    const focused = focusHoldResultsSearchState(
      createHoldResultsSearchState('OGN-015'),
      'OGN-015'
    );
    const typing = changeHoldResultsSearchState('j');
    expect(syncHoldResultsSearchState(typing, 'OGN-015')).toEqual(typing);
  });

  test('backspacing a draft is not replaced by a longer committed echo', () => {
    const shorter = changeHoldResultsSearchState('sta');
    expect(syncHoldResultsSearchState(shorter, 'star')).toEqual(shorter);
  });

  test('clear resets draft and hold', () => {
    expect(clearHoldResultsSearchState()).toEqual({
      draft: '',
      holdingFrom: null,
      focused: false,
    });
  });
});
