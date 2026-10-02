import { afterEach, describe, expect, it, vi } from 'vitest';
import { SQUARE_FOOTPRINTS } from '../../core/rules/footprint';
import { Camera } from '../camera';
import { loadingPlaceholderBox } from '../painters/registry';
import { Canvas2DBackend, canvasActorDepth } from './canvas2d';
import { pixiActorDepth } from './pixi';

// CanvasFxLayer paints its atlas in the constructor; keep the node test focused
// on backend construction without requiring a browser canvas implementation.
vi.mock('../fx/canvasFx', () => ({
  CanvasFxLayer: class {},
}));

const canvas = (): HTMLCanvasElement =>
  ({
    width: 1,
    height: 1,
    getContext: () => ({}),
  }) as unknown as HTMLCanvasElement;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('square-footprint backend parity', () => {
  it.each([
    ['orthographic', ['east-back', 'square', 'east-front', 'west-front', 'south']],
    ['oblique', ['west-front', 'square', 'east-back', 'south', 'east-front']],
  ] as const)('sorts real neighbours by their visible feet in %s', (projection, expected) => {
    const camera = new Camera(
      { width: 1000, height: 700, dpr: 1 },
      { width: 20, height: 12 },
      projection,
    );
    const actors = [
      { name: 'square', pos: { x: 4, y: 3 }, size: 2 as const },
      { name: 'east-back', pos: { x: 6, y: 3 }, size: 1 as const },
      { name: 'east-front', pos: { x: 6, y: 4 }, size: 1 as const },
      { name: 'west-front', pos: { x: 3, y: 4 }, size: 1 as const },
      { name: 'south', pos: { x: 4, y: 5 }, size: 1 as const },
    ];
    const order = (depth: typeof canvasActorDepth) =>
      [...actors]
        .sort((a, b) => depth(camera, a.pos, a.size, true) - depth(camera, b.pos, b.size, true))
        .map(({ name }) => name);
    expect(order(canvasActorDepth)).toEqual(expected);
    expect(order(pixiActorDepth)).toEqual(expected);
  });

  it.each(['orthographic', 'oblique'] as const)(
    'sorts props at (6,3)/(6,4) against the actual 2x2 occupant key in %s',
    (projection) => {
      const camera = new Camera(
        { width: 1000, height: 700, dpr: 1 },
        { width: 20, height: 12 },
        projection,
      );
      const square = canvasActorDepth(camera, { x: 4, y: 3 }, 2, true);
      const propBack = camera.groundPoint({ x: 6.5, y: 3.5 }).y;
      const propFront = camera.groundPoint({ x: 6.5, y: 4.5 }).y;
      if (projection === 'orthographic') {
        expect(propBack).toBeLessThan(square);
        expect(propFront).toBe(square);
      } else {
        // The oblique key is the front cell (5,4): (6,3) is on the same depth row,
        // a full tile to its right on screen and clear of the body, so a tie is safe.
        expect(propBack).toBe(square);
        expect(propFront).toBeGreaterThan(square);
      }
      expect(pixiActorDepth(camera, { x: 4, y: 3 }, 2, true)).toBe(square);
    },
  );

  it('uses the shared front-cell foot for both oblique backend depth keys', () => {
    const camera = new Camera(
      { width: 1000, height: 700, dpr: 1 },
      { width: 20, height: 12 },
      'oblique',
    );
    const expected = camera.groundPoint({ x: 5.5, y: 4.5 }).y;
    expect(canvasActorDepth(camera, { x: 4, y: 3 }, 2, true)).toBe(expected);
    expect(pixiActorDepth(camera, { x: 4, y: 3 }, 2, true)).toBe(expected);
    const behind = camera.groundPoint({ x: 5.5, y: 2.5 }).y;
    const inFront = camera.groundPoint({ x: 5.5, y: 6.5 }).y;
    expect(behind).toBeLessThan(expected);
    expect(inFront).toBeGreaterThan(expected);
  });

  it('gives a generic 2x2 placeholder the full footprint box', () => {
    expect(
      loadingPlaceholderBox({ x: 10, y: 74, size: 64 }, { footprintWidth: 2, footprintHeight: 2 }),
    ).toEqual({ x: 10, y: 10, size: 128, height: 128 });
  });

  it('passes the square gate into the Canvas2D backend construction', () => {
    // Canvas2D only probes the supplied canvas, so a tiny DOM stub is enough in
    // node. Pixi allocates real textures in its field initialisers and cannot be
    // built without a browser.
    vi.stubGlobal('document', { createElement: canvas });
    const shipped = new Canvas2DBackend(canvas());
    expect((shipped as unknown as { squareFootprints: boolean }).squareFootprints).toBe(
      SQUARE_FOOTPRINTS,
    );
    const legacy = new Canvas2DBackend(canvas(), false);
    expect((legacy as unknown as { squareFootprints: boolean }).squareFootprints).toBe(false);
  });
});
