import { describe, expect, test } from 'bun:test';
import { nextStackQuantity } from '../../src/services/collection-service.js';

describe('nextStackQuantity', () => {
  test('adds from zero when stack is missing', () => {
    expect(nextStackQuantity(undefined, 1)).toBe(1);
    expect(nextStackQuantity(undefined, 3)).toBe(3);
  });

  test('increments an existing stack', () => {
    expect(nextStackQuantity(2, 1)).toBe(3);
    expect(nextStackQuantity(1, 5)).toBe(6);
  });

  test('decrements and can reach zero or negative (delete signal)', () => {
    expect(nextStackQuantity(2, -1)).toBe(1);
    expect(nextStackQuantity(1, -1)).toBe(0);
    expect(nextStackQuantity(1, -3)).toBe(-2);
    expect(nextStackQuantity(undefined, -1)).toBe(-1);
  });

  test('treats explicit zero existing quantity as zero', () => {
    expect(nextStackQuantity(0, 2)).toBe(2);
    expect(nextStackQuantity(0, -1)).toBe(-1);
  });
});
