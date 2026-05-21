import { describe, expect, it } from 'vitest';
import { chunk } from '../../src/lib/chunk-batch.js';

describe('chunk', () => {
  it('returns an empty array for empty input', () => {
    expect(chunk([], 5)).toEqual([]);
  });

  it('splits an exact multiple into equal-size batches', () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 2)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
  });

  it('puts the remainder in a smaller final batch', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('produces a single batch when size exceeds input length', () => {
    expect(chunk(['a', 'b', 'c'], 10)).toEqual([['a', 'b', 'c']]);
  });

  it('throws on non-positive or non-integer sizes', () => {
    expect(() => chunk([1], 0)).toThrow(/positive integer/);
    expect(() => chunk([1], -1)).toThrow(/positive integer/);
    expect(() => chunk([1], 1.5)).toThrow(/positive integer/);
  });
});
