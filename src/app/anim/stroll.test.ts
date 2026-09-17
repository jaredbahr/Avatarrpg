import { describe, expect, it } from 'vitest';
import { strollTiming } from './stroll';

describe('exploration pace', () => {
  it('reaches the same cruising speed on short, long and diagonal routes', () => {
    for (const length of [2, 30, Math.sqrt(2) * 12]) {
      const timing = strollTiming(length, 280);
      const pos = (ms: number) => timing.ease(ms / timing.duration) * length;
      expect((pos(300) - pos(200)) / 100).toBeCloseTo(1 / 280, 9);
      expect(pos(0)).toBe(0);
      expect(pos(timing.duration)).toBeCloseTo(length, 9);
      expect(pos(timing.duration + 100)).toBeCloseTo(length, 9);
    }
  });
  it('keeps the acceleration short and lands sound cues at their travelled distance', () => {
    for (const length of [0.05, 1, 5.37, 30]) {
      const timing = strollTiming(length, 280);
      for (let i = 0; i <= 100; i++) {
        const distance = (length * i) / 100;
        expect(timing.ease(timing.atDistance(distance) / timing.duration) * length).toBeCloseTo(
          distance,
          8,
        );
      }
      expect(timing.duration - length * 280).toBeLessThanOrEqual(120);
    }
  });
  it('handles a stationary route without a non-finite clock', () => {
    const timing = strollTiming(0, 280);
    expect(timing.duration).toBe(0);
    expect(timing.ease(1)).toBe(0);
    expect(timing.atDistance(0)).toBe(0);
  });
});
