import { describe, expect, it, vi } from 'vitest';
import { TERRAIN_STYLES } from '../palettes';
import { paintTileSeams } from './board';

const box = { x: 10, y: 20, size: 64 };

/** A context that records the shapes a painter lays down, in tile-local space. */
function context() {
  const points: [number, number][] = [];
  const paths: [number, number][][] = [];
  const fills: string[] = [];
  const alphas: number[] = [];
  let tx = 0;
  let ty = 0;
  let rotate = 0;
  const translateCalls: [number, number][] = [];
  let current: [number, number][] = [];
  const ctx = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save: vi.fn(),
    restore: vi.fn(),
    translate(x: number, y: number) {
      tx += x;
      ty += y;
      translateCalls.push([x, y]);
    },
    rotate(angle: number) {
      rotate += angle;
    },
    beginPath() {
      current = [];
    },
    closePath() {
      paths.push([...current]);
    },
    moveTo(x: number, y: number) {
      current.push([x, y]);
      points.push([x, y]);
    },
    lineTo(x: number, y: number) {
      current.push([x, y]);
      points.push([x, y]);
    },
    ellipse(x: number, y: number) {
      current.push([x, y]);
    },
    stroke: vi.fn(),
    fill() {
      fills.push(this.fillStyle);
      alphas.push(this.globalAlpha);
    },
    fillRect: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  };
  return { ctx, points, paths, fills, alphas, translateCalls, state: () => ({ tx, ty, rotate }) };
}

describe('ground joins', () => {
  it('draws nothing at all when no side of a tile meets another material', () => {
    const probe = context();
    paintTileSeams(
      probe.ctx as unknown as CanvasRenderingContext2D,
      box,
      { x: 1, y: 2 },
      'dirt',
      null,
    );
    expect(probe.fills).toHaveLength(0);
    expect(probe.translateCalls).toHaveLength(0);
  });

  it('bleeds the neighbouring material in along one side only', () => {
    const probe = context();
    paintTileSeams(probe.ctx as unknown as CanvasRenderingContext2D, box, { x: 1, y: 2 }, 'dirt', [
      null,
      'grass',
      null,
      null,
    ]);
    expect(probe.fills).toContain(TERRAIN_STYLES.grass.fill);
    // One side drawn, turned to face east, and no join on the other three.
    expect(probe.translateCalls).toHaveLength(2);
    expect(probe.state().rotate).toBeCloseTo(Math.PI / 2);
  });

  it('keeps the fringe inside the tile so a chunk bake cannot clip it', () => {
    const probe = context();
    paintTileSeams(probe.ctx as unknown as CanvasRenderingContext2D, box, { x: 4, y: 5 }, 'dirt', [
      'road',
      'stone',
      'sand',
      'water',
    ]);
    // One fringe per side, each a closed seven-segment wedge.
    const fringes = probe.paths.filter((path) => path.length === 9);
    expect(fringes).toHaveLength(4);
    for (const path of fringes) {
      const ys = path.map(([, y]) => y);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...ys)).toBeLessThanOrEqual(box.size * 0.18);
    }
  });

  it('gives a bank a deeper, stronger wedge than a dry join, breaking the water outline', () => {
    const dry = context();
    const bank = context();
    const seams = ['dirt', null, null, null] as const;
    paintTileSeams(
      dry.ctx as unknown as CanvasRenderingContext2D,
      box,
      { x: 3, y: 3 },
      'dirt',
      seams,
    );
    paintTileSeams(
      bank.ctx as unknown as CanvasRenderingContext2D,
      box,
      { x: 3, y: 3 },
      'water',
      seams,
    );
    const reach = (probe: ReturnType<typeof context>): number =>
      Math.max(
        ...probe.paths
          .filter((path) => path.length === 9)
          .flat()
          .map(([, y]) => y),
      );
    // The first fill of a side is the wedge itself, before any litter.
    expect(reach(bank)).toBeGreaterThan(reach(dry));
    expect(bank.alphas[0]).toBeGreaterThan(dry.alphas[0] ?? 0);
    expect(reach(bank)).toBeLessThanOrEqual(box.size * 0.2);
  });

  it('is the same painting every frame, so the ground never shimmers', () => {
    const first = context();
    const second = context();
    const seams = ['grass', null, 'water', 'stone'] as const;
    paintTileSeams(
      first.ctx as unknown as CanvasRenderingContext2D,
      box,
      { x: 7, y: 9 },
      'dirt',
      seams,
    );
    paintTileSeams(
      second.ctx as unknown as CanvasRenderingContext2D,
      box,
      { x: 7, y: 9 },
      'dirt',
      seams,
    );
    expect(second.points).toEqual(first.points);
  });
});
