import { describe, expect, it } from 'vitest';
import { shiftAdjacent, sumUpTo } from '../src/renderer/grid';

describe('sumUpTo', () => {
  it('sums ratios up to and including the given index', () => {
    expect(sumUpTo([0.25, 0.25, 0.25, 0.25], 1)).toBeCloseTo(0.5);
  });

  it('returns the first ratio for index 0', () => {
    expect(sumUpTo([0.3, 0.7], 0)).toBeCloseTo(0.3);
  });
});

describe('shiftAdjacent', () => {
  it('moves fraction from one ratio to its neighbour', () => {
    const next = shiftAdjacent([0.5, 0.5], 0, 0.1);
    expect(next[0]).toBeCloseTo(0.6);
    expect(next[1]).toBeCloseTo(0.4);
  });

  it('refuses a shift that would push a ratio below MIN_RATIO', () => {
    const ratios = [0.5, 0.5];
    const next = shiftAdjacent(ratios, 0, 0.49);
    expect(next).toEqual(ratios);
  });

  it('leaves ratios outside the pair untouched', () => {
    const next = shiftAdjacent([0.34, 0.33, 0.33], 1, 0.05);
    expect(next[0]).toBeCloseTo(0.34);
    expect(next[1]).toBeCloseTo(0.38);
    expect(next[2]).toBeCloseTo(0.28);
  });
});
