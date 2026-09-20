import { describe, expect, it, vi } from 'vitest';
import type { Tile } from '../core/types';
import { paintSurface } from './painters/tiles';
import {
  SURFACE_BANK,
  SURFACE_RIM,
  surfaceIntensity,
  surfaceOutline,
  surfaceRim,
} from './surfaceRendering';

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
  const fills: { alpha: number; color: string; box: number[] }[] = [];
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
    fillRect(x: number, y: number, w: number, h: number) {
      fills.push({ alpha: this.globalAlpha, color: this.fillStyle, box: [x, y, w, h] });
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
    // Three interior material strokes and no boundary segment: a tile
    // surrounded by the same material has no bank to draw.
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
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
  it('keeps a thin coat over the whole tile and draws every outline inside it', () => {
    const { ctx, fills } = context();
    paintSurface(ctx as unknown as CanvasRenderingContext2D, box, tile(-1), { x: 2, y: 3 }, false, {
      ...edges,
      n: true,
    });
    // The base coat still covers the hazard tile: a thinned edge is shading,
    // never a tile that has stopped reading as material.
    expect(fills[0]?.box).toEqual([Math.round(box.x), Math.round(box.y), box.size, box.size]);
    // The firmer interior, the ragged bank and the material gathering along it.
    expect(ctx.fill).toHaveBeenCalledTimes(3);
    for (const [x, y] of ctx.lineTo.mock.calls as [number, number][]) {
      expect(x).toBeGreaterThanOrEqual(box.x);
      expect(x).toBeLessThanOrEqual(box.x + box.size);
      expect(y).toBeGreaterThanOrEqual(box.y);
      expect(y).toBeLessThanOrEqual(box.y + box.size);
    }
  });
});

describe('surface rim', () => {
  const pos = { x: 4, y: 9 };
  const edges = { n: true, e: true, s: false, w: true };

  it('runs one ragged bank per open edge, in n, e, s, w order', () => {
    expect(surfaceRim(pos, edges)).toHaveLength(3);
    expect(surfaceRim(pos, { n: false, e: false, s: false, w: false })).toHaveLength(0);
  });

  it('draws the wash outline on the open edges and on nothing else', () => {
    const outline = surfaceOutline(pos, edges);
    expect(outline).toHaveLength((SURFACE_RIM.steps + 1) * 4);
    // A side that meets the same material stays on the tile's own edge, so a
    // puddle four tiles wide has no interior rim.
    const flat = surfaceOutline(pos, { n: false, e: false, s: false, w: false });
    expect(flat.every(([x, y]) => x === 0 || x === 1 || y === 0 || y === 1)).toBe(true);
  });

  it('never leaves the tile, and always keeps the tie to its own edge', () => {
    for (const rim of surfaceRim(pos, edges)) {
      expect(rim.outer).toHaveLength(rim.bank.length);
      for (const points of [rim.outer, rim.bank, rim.pool]) {
        for (const [x, y] of points) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(1);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(1);
        }
      }
      // A bank that sits on the tile boundary is the ruled edge again.
      const depths = rim.bank.map(([x, y], index) => {
        const [ox, oy] = rim.outer[index] ?? [0, 0];
        return Math.abs(x - ox) + Math.abs(y - oy);
      });
      expect(Math.min(...depths)).toBeGreaterThan(0);
      expect(Math.max(...depths)).toBeLessThanOrEqual(SURFACE_BANK.width * 0.9 + 1e-9);
    }
  });

  it('wanders along its length, is stable per tile, and differs between tiles', () => {
    const [first] = surfaceRim(pos, edges);
    const depths = first?.bank.map(([, y]) => y) ?? [];
    expect(new Set(depths).size).toBeGreaterThan(1);
    expect(surfaceRim(pos, edges)).toEqual(surfaceRim(pos, edges));
    expect(surfaceRim({ x: pos.x, y: pos.y + 1 }, edges)).not.toEqual(surfaceRim(pos, edges));
  });
});
