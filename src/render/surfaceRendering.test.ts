import { describe, expect, it, vi } from 'vitest';
import type { Tile } from '../core/types';
import { paintSurface } from './painters/tiles';
import { SURFACE_POOL, surfaceIntensity } from './surfaceRendering';

const box = { x: 3.25, y: 7.5, size: 64 };
const edges = { n: false, e: false, s: false, w: false };
const tile = (duration: number): Tile => ({
  terrain: 'stone',
  elevation: 0,
  blocked: false,
  blocksSight: false,
  cover: false,
  surface: { id: 'mud', duration, spread: 0 },
});
function context() {
  const fills: { alpha: number; color: string }[] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    ellipse: vi.fn(),
    bezierCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillRect() {
      fills.push({ alpha: this.globalAlpha, color: this.fillStyle });
    },
  };
  return {
    ctx,
    fills,
    paint: (duration: number) =>
      paintSurface(
        ctx as unknown as CanvasRenderingContext2D,
        box,
        tile(duration),
        { x: 2, y: 3 },
        false,
        edges,
      ),
  };
}

describe('surface material presentation', () => {
  it('keeps permanent and last-turn hazards visible, with a monotonic duration cue', () => {
    expect(surfaceIntensity(-1)).toBe(1);
    const temporary = [0, 1, 2, 3, 6, 100].map(surfaceIntensity);
    expect(temporary).toEqual([...temporary].sort((a, b) => a - b));
    expect(temporary.every((value) => value > 0 && value <= 1)).toBe(true);
    expect(surfaceIntensity(1)).toBeLessThan(surfaceIntensity(3));
  });
  it('clips all material marks to the exact tile and omits rims between matching neighbours', () => {
    const { ctx, paint } = context();
    paint(-1);
    expect(ctx.rect).toHaveBeenCalledWith(box.x, box.y, box.size, box.size);
    expect(ctx.clip).toHaveBeenCalledOnce();
    // Three interior material strokes, no extra boundary segments.
    expect(ctx.moveTo).toHaveBeenCalledTimes(3);
    expect(ctx.lineTo).not.toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });
  it('fades the original wash instead of painting black over an expiring tile', () => {
    const permanent = context();
    const expiring = context();
    permanent.paint(-1);
    expiring.paint(1);
    expect(expiring.fills).toHaveLength(1);
    expect(expiring.fills[0]?.color).toBe(permanent.fills[0]?.color);
    expect(expiring.fills[0]?.alpha).toBeLessThan(permanent.fills[0]?.alpha ?? 0);
    expect(expiring.fills[0]?.alpha).toBeGreaterThan(0);
  });
  it('confines irregular pooling to a shallow strip inside the exterior bank', () => {
    const { ctx } = context();
    paintSurface(ctx as unknown as CanvasRenderingContext2D, box, tile(-1), { x: 2, y: 3 }, false, {
      ...edges,
      n: true,
    });
    expect(ctx.fill).toHaveBeenCalledOnce();
    for (const [x, y] of ctx.lineTo.mock.calls as [number, number][]) {
      expect(x).toBeGreaterThanOrEqual(box.x);
      expect(x).toBeLessThanOrEqual(box.x + box.size);
      expect(y).toBeGreaterThanOrEqual(box.y);
      expect(y).toBeLessThanOrEqual(box.y + box.size * SURFACE_POOL.depth);
    }
  });
});
