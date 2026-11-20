import { afterEach, describe, expect, it, vi } from 'vitest';
import { Canvas2DBackend } from './canvas2d';
import type { BoardLight } from '../view';
import { LAMP_GLASS, LAMP_POOL } from '../../content/dayLight';

/** A canvas the glow art can be painted into: the unit environment has none. */
const fakeCanvas = () => ({
  width: 0,
  height: 0,
  getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => undefined,
  }),
});

const LIGHT: BoardLight = {
  grade: { multiply: [0.92, 0.8, 0.78], lift: [10 / 255, 0, 14 / 255] },
  lamps: [
    {
      glass: { x: 29.6775, y: 9.9075 },
      ground: { x: 29.6775, y: 11.375 },
      depth: { x: 29.5, y: 11.325 },
    },
  ],
  pool: LAMP_POOL,
  glass: LAMP_GLASS,
};

/** Drives one of the backend's private light passes on a recording context. */
function record(method: 'drawLampPools' | 'glassOccupants', projection = 'topdown') {
  vi.stubGlobal('document', { createElement: fakeCanvas });
  const draws: { op: string; rect: number[] }[] = [];
  const ctx = {
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    save: vi.fn(),
    restore: vi.fn(() => {
      ctx.globalCompositeOperation = 'source-over';
    }),
    getTransform: () => ({ a: 3, b: 0, c: 0, d: 3 }),
    drawImage: vi.fn((_s: unknown, ...rect: number[]) =>
      draws.push({ op: ctx.globalCompositeOperation, rect }),
    ),
  };
  const camera = { projection, scale: 3, offsetX: 100, offsetY: 50, tile: 40 };
  const self = { ctx, light: LIGHT, grade: LIGHT.grade };
  const proto = Canvas2DBackend.prototype as unknown as Record<
    string,
    (this: unknown, ...args: unknown[]) => unknown
  >;
  const out = proto[method]?.call(self, camera);
  if (Array.isArray(out)) for (const occupant of out as { draw(): void }[]) occupant.draw();
  return { draws, out };
}

describe('Canvas 2D day light (ADR 0121)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adds each lamp pool onto the ground on whole world pixels, centred under the glass', () => {
    const { draws } = record('drawLampPools');
    expect(draws).toHaveLength(1);
    const [draw] = draws;
    expect(draw?.op).toBe('lighter');
    // 1187 x 455 world px, less the radii, at scale 3 less the camera offset.
    expect(draw?.rect).toEqual([
      (1187 - LAMP_POOL.radiusX) * 3 - 100,
      (455 - LAMP_POOL.radiusY) * 3 - 50,
      (LAMP_POOL.radiusX * 2 + 1) * 3,
      (LAMP_POOL.radiusY * 2 + 1) * 3,
    ]);
  });

  it('draws the glass as an occupant at its lamp’s depth, additively', () => {
    const { draws, out } = record('glassOccupants');
    expect((out as { pos: unknown }[]).map((o) => o.pos)).toEqual([LIGHT.lamps[0]?.depth]);
    expect(draws.map((d) => d.op)).toEqual(['lighter']);
  });

  it('draws no light on a board that is not top-down', () => {
    expect(record('drawLampPools', 'orthographic').draws).toEqual([]);
    expect(record('glassOccupants', 'orthographic').draws).toEqual([]);
  });
});
