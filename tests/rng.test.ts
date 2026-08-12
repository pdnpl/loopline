import { describe, expect, it } from 'vitest';
import { hashSeed, levelSeed, mulberry32, randInt, shuffled, weightedPick } from '../src/core/rng';

describe('mulberry32', () => {
  it('produces the same sequence for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const left = Array.from({ length: 32 }, () => a());
    const right = Array.from({ length: 32 }, () => b());
    expect(left).toEqual(right);
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('stays inside [0, 1)', () => {
    const rng = mulberry32(99);
    for (let i = 0; i < 2000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('hashSeed', () => {
  it('is stable and differs per input', () => {
    expect(hashSeed('loopline')).toBe(hashSeed('loopline'));
    expect(hashSeed('loopline')).not.toBe(hashSeed('loopline!'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const value = hashSeed('anything at all');
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('levelSeed', () => {
  it('separates levels and retry attempts', () => {
    expect(levelSeed(3)).toBe(levelSeed(3, 0));
    expect(levelSeed(3)).not.toBe(levelSeed(4));
    expect(levelSeed(3, 0)).not.toBe(levelSeed(3, 1));
  });
});

describe('helpers', () => {
  it('randInt covers both bounds inclusively', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(randInt(rng, 2, 5));
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('shuffled keeps every element and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = shuffled(mulberry32(4), input);
    expect(output).toHaveLength(input.length);
    expect([...output].sort((l, r) => l - r)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('weightedPick never returns a zero-weight item', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 400; i++) {
      expect(weightedPick(rng, ['a', 'b'], [0, 1])).toBe('b');
    }
  });
});
