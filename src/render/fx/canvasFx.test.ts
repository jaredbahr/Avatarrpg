import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FX_AMBIENCE } from '../../content/fx';
import type { Grid } from '../../core/types';
import { ambientEmitters } from '../../app/anim/ambience';
import { CanvasFxLayer } from './canvasFx';
import { sampleParticles } from './simulate';
import type * as Simulate from './simulate';

/**
 * The Canvas still wisp (Canvas 2D and Reduce motion): the same particles
 * every frame, so they are sampled once and kept rather than resampled.
 */

vi.mock('./atlas', () => ({
  ATLAS_CELL: 64,
  cellFrame: () => ({ x: 0, y: 0, size: 64 }),
  fxAtlas: () => ({}),
  celAtlasFrame: () => null,
  celReady: () => false,
}));

vi.mock('./simulate', async (original) => {
  const real = await original<typeof Simulate>();
  return { ...real, sampleParticles: vi.fn(real.sampleParticles) };
});

/** Records where each particle is drawn: the translate of each draw's transform. */
class Matrix {
  constructor(private readonly log: number[][]) {}
  translate(x: number, y: number) {
    this.log.push([x, y]);
    return this;
  }
  rotate() {
    return this;
  }
  scale() {
    return this;
  }
}

function context(log: number[][]) {
  return {
    save() {},
    restore() {},
    getTransform: () => new Matrix(log),
    setTransform() {},
    drawImage() {},
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  } as unknown as CanvasRenderingContext2D;
}

const grid: Grid = { width: 20, height: 12, tiles: [] };
const village = FX_AMBIENCE.village;
const chimneys = [
  { x: 3.5, y: -1.25 },
  { x: 8, y: 6 },
];

describe('CanvasFxLayer', () => {
  const doc = (globalThis as { document?: unknown }).document;
  beforeAll(() => {
    (globalThis as { document?: unknown }).document = {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    };
  });
  afterAll(() => {
    (globalThis as { document?: unknown }).document = doc;
  });

  it('samples a still wisp once, and draws it the same as sampling it afresh', () => {
    const still = ambientEmitters(village ?? null, grid, 0, chimneys, true);
    expect(still).toHaveLength(4);
    expect(still.every((emitter) => emitter.still)).toBe(true);
    const layer = new CanvasFxLayer();
    const sample = vi.mocked(sampleParticles);
    sample.mockClear();
    const frames: number[][][] = [];
    for (let frame = 0; frame < 30; frame++) {
      const log: number[][] = [];
      // The scene builds new instances every frame; the cache keys on what they hold.
      const emitters = ambientEmitters(village ?? null, grid, frame * 16, chimneys, true);
      layer.draw(context(log), emitters, 'over', { x: 0, y: 0 }, 64, true);
      frames.push(log);
    }
    expect(sample).toHaveBeenCalledTimes(4);
    expect(frames[0]!.length).toBeGreaterThan(0);
    for (const log of frames) expect(log).toEqual(frames[0]);

    // The same instances, not marked still, sample every frame and land in the same places.
    const fresh: number[][] = [];
    sample.mockClear();
    new CanvasFxLayer().draw(
      context(fresh),
      still.map(({ still: _, ...live }) => live),
      'over',
      { x: 0, y: 0 },
      64,
      true,
    );
    expect(sample).toHaveBeenCalledTimes(4);
    expect(fresh).toEqual(frames[0]);
  });
});
