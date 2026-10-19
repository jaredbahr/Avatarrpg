import { describe, expect, it } from 'vitest';
import { talkPipPosition, visiblePixelBounds } from './talkPip';

describe('NPC talk pip placement', () => {
  it('keeps the cue horizontally stable as a small lean changes direction', () => {
    const bounds = { left: -0.3, top: -1, right: 0.3, bottom: 0 };
    const left = talkPipPosition({ x: 100, y: 100 }, bounds, 100, -0.00001, 7, 4);
    const right = talkPipPosition({ x: 100, y: 100 }, bounds, 100, 0.00001, 7, 4);
    expect(Math.abs(left.x - right.x)).toBeLessThan(0.01);
    expect(left.y + 7 + 4).toBeLessThanOrEqual(0);
    expect(right.y + 7 + 4).toBeLessThanOrEqual(0);
  });

  it('ignores transparent padding and keeps differing silhouettes above their own tops', () => {
    const pixels = new Uint8ClampedArray(10 * 12 * 4);
    pixels[(3 * 10 + 4) * 4 + 3] = 255;
    pixels[(8 * 10 + 6) * 4 + 3] = 255;
    expect(visiblePixelBounds(pixels, 10, 12)).toEqual({ left: 4, top: 3, right: 7, bottom: 9 });
    const short = talkPipPosition(
      { x: 0, y: 0 },
      { left: -0.2, top: -0.7, right: 0.2, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    const tall = talkPipPosition(
      { x: 0, y: 0 },
      { left: -0.2, top: -1.4, right: 0.2, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    expect(short.y).toBeCloseTo(-0.81);
    expect(tall.y).toBeCloseTo(-1.51);
  });

  it('includes actor scale, pose scale, offsets in the foot, lean, radius and gap', () => {
    const base = talkPipPosition(
      { x: 3, y: 8 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    const enlarged = talkPipPosition(
      { x: 3, y: 7.5 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1.5,
      0,
      0.07,
      0.04,
    );
    const offset = talkPipPosition(
      { x: 5, y: 6 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1,
      0,
      0.07,
      0.04,
    );
    const leaning = talkPipPosition(
      { x: 3, y: 8 },
      { left: -0.3, top: -1, right: 0.3, bottom: 0 },
      1,
      0.25,
      0.07,
      0.04,
    );
    expect(base.x).toBe(3);
    expect(base.y).toBeCloseTo(6.89, 8);
    expect(enlarged.x).toBe(3);
    expect(enlarged.y).toBeCloseTo(5.89, 8);
    expect(offset.x).toBe(5);
    expect(offset.y).toBeCloseTo(4.89, 8);
    const c = Math.cos(0.25);
    const s = Math.sin(0.25);
    const highest = Math.min(...[-0.3, 0.3].flatMap((x) => [-1, 0].map((y) => 8 + x * s + y * c)));
    expect(leaning.y).toBeCloseTo(highest - 0.11, 8);
    expect(leaning.y + 0.07 + 0.04).toBeCloseTo(highest, 8);
  });

  it('mirrors asymmetric art before applying lean, matching the renderer transform', () => {
    const bounds = { left: -0.1, top: -1.2, right: 0.5, bottom: -0.2 };
    const scale = 1.3;
    const lean = 0.3;
    const radius = 0.08;
    const gap = 0.05;
    const position = talkPipPosition({ x: 2, y: 4 }, bounds, scale, lean, radius, gap, -1);
    const c = Math.cos(lean);
    const s = Math.sin(lean);
    const highest = Math.min(
      ...[bounds.left, bounds.right].flatMap((x) =>
        [bounds.top, bounds.bottom].map((y) => 4 + scale * (-x * s + y * c)),
      ),
    );
    expect(position.y).toBeCloseTo(highest - radius - gap, 8);
    expect(position.y + radius + gap).toBeCloseTo(highest, 8);
  });
});
