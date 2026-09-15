import { describe, expect, it } from 'vitest';
import { RngCursor, nextChance, nextFloat, nextInt, pick, seedFromString, shuffle } from './rng';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const runOnce = () => {
      const c = new RngCursor(seedFromString('quarry-of-ba-dan'));
      return Array.from({ length: 16 }, () => c.int(1, 100));
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('produces different streams for different seeds', () => {
    const a = new RngCursor(seedFromString('a'));
    const b = new RngCursor(seedFromString('b'));
    const seqA = Array.from({ length: 8 }, () => a.int(0, 1000));
    const seqB = Array.from({ length: 8 }, () => b.int(0, 1000));
    expect(seqA).not.toEqual(seqB);
  });

  it('never mutates the state it is given', () => {
    const state = 12345;
    nextFloat(state);
    nextInt(state, 0, 10);
    expect(state).toBe(12345);
  });

  it('keeps floats inside [0, 1)', () => {
    let rng = seedFromString('range-check');
    for (let i = 0; i < 5000; i++) {
      const d = nextFloat(rng);
      rng = d.rng;
      expect(d.value).toBeGreaterThanOrEqual(0);
      expect(d.value).toBeLessThan(1);
    }
  });

  it('keeps ints inside the inclusive bounds and hits both ends', () => {
    let rng = seedFromString('int-check');
    const seen = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      const d = nextInt(rng, 3, 7);
      rng = d.rng;
      expect(d.value).toBeGreaterThanOrEqual(3);
      expect(d.value).toBeLessThanOrEqual(7);
      seen.add(d.value);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6, 7]);
  });

  it('nextChance tracks the requested probability', () => {
    let rng = seedFromString('chance');
    let hits = 0;
    const trials = 20_000;
    for (let i = 0; i < trials; i++) {
      const d = nextChance(rng, 0.25);
      rng = d.rng;
      if (d.value) hits++;
    }
    expect(hits / trials).toBeGreaterThan(0.22);
    expect(hits / trials).toBeLessThan(0.28);
  });

  it('nextChance clamps at the extremes', () => {
    let rng = seedFromString('extremes');
    for (let i = 0; i < 200; i++) {
      const never = nextChance(rng, 0);
      const always = nextChance(rng, 1);
      rng = never.rng;
      expect(never.value).toBe(false);
      expect(always.value).toBe(true);
    }
  });

  it('shuffle keeps every element and leaves the input alone', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const { value } = shuffle(seedFromString('shuffle'), input);
    expect([...value].sort((a, b) => a - b)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('pick throws rather than returning undefined on an empty list', () => {
    expect(() => pick(1, [])).toThrow(/empty/);
  });

  it('nextInt rejects an inverted range', () => {
    expect(() => nextInt(1, 5, 2)).toThrow();
  });
});
