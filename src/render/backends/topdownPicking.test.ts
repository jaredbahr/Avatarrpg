/**
 * Both-backend picking on a top-down board (ADR 0104, phase T1): every cell of
 * a fixture board, tapped at its centre, just inside each edge and each corner,
 * picks the cell the backend drew there. Canvas 2D is read from the boxes its
 * ground pass paints; Pixi from the uniforms its ground shader is given, run
 * through the shader's own arithmetic. CI takes the Canvas 2D path, so both are
 * held here rather than in a browser.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import type { Grid, Vec2 } from '../../core/types';
import { Camera } from '../camera';
import type { Viewport } from '../camera';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import { Canvas2DBackend, canvasActorDepth } from './canvas2d';
import { groundShaderFrame, pixiActorDepth } from './pixi';
import { SCENERY_BIAS, SHADOW_BIAS, boardDepth, sceneryZ, shadowZ } from './depthOrder';

const painted = vi.hoisted(
  () => [] as { box: { x: number; y: number; size: number }; pos: Vec2 }[],
);

vi.mock('../painters/tiles', () => ({
  paintTerrain: (
    _ctx: unknown,
    box: { x: number; y: number; size: number },
    _t: unknown,
    pos: Vec2,
  ) => painted.push({ box: { ...box }, pos: { ...pos } }),
  paintSurface: () => undefined,
  paintGridLine: () => undefined,
}));

// CanvasFxLayer paints its atlas in the constructor; nothing here constructs it.
vi.mock('../fx/canvasFx', () => ({ CanvasFxLayer: class {} }));

afterEach(() => {
  painted.length = 0;
  vi.restoreAllMocks();
});

const VIEWPORTS: readonly Viewport[] = [
  { width: 1368, height: 912, dpr: 1 },
  { width: 1368, height: 912, dpr: 1.5 },
  { width: 834, height: 1194, dpr: 2 },
  { width: 390, height: 844, dpr: 3 },
];

/** The cameras a player meets: fitted, zoomed in and panned, on whole device pixels. */
function cameras(grid: Grid): Camera[] {
  const out: Camera[] = [];
  for (const viewport of VIEWPORTS) {
    const fitted = new Camera(viewport, grid, 'topdown');
    fitted.integerZoom = true;
    fitted.fit();
    out.push(fitted);
    const zoomed = new Camera(viewport, grid, 'topdown');
    zoomed.integerZoom = true;
    zoomed.fit();
    zoomed.zoomAt({ x: viewport.width / 3, y: viewport.height / 3 }, 2.5);
    zoomed.panBy(-31.3, -17.9);
    out.push(zoomed);
  }
  return out;
}

/** The cells Canvas 2D's ground pass paints, and where. */
function canvasCells(grid: Grid, camera: Camera) {
  painted.length = 0;
  const self = { ctx: {}, only: null };
  const proto = Canvas2DBackend.prototype as unknown as {
    drawGround(this: unknown, ...args: unknown[]): void;
    tileBounds: unknown;
  };
  proto.drawGround.call(
    { ...self, tileBounds: proto.tileBounds },
    { grid, hatch: false, gridLines: false, scene: undefined },
    camera,
    false,
  );
  return [...painted];
}

/** The ground shader's cell lookup (shaders.ts `main`), on the uniforms Pixi uploads. */
function shaderCell(frame: ReturnType<typeof groundShaderFrame>, screen: Vec2): Vec2 {
  const dx = screen.x - frame.origin[0];
  const dy = screen.y - frame.origin[1];
  const [a, b, c, d] = frame.inverse;
  return {
    x: Math.floor((a * dx + b * dy) / frame.tileSize),
    y: Math.floor((c * dx + d * dy) / frame.tileSize),
  };
}

/** Centre, just inside each edge and just inside each corner of a drawn box. */
function taps(box: { x: number; y: number; size: number }): Vec2[] {
  const e = box.size * 1e-3;
  const lo = { x: box.x + e, y: box.y + e };
  const hi = { x: box.x + box.size - e, y: box.y + box.size - e };
  const mid = { x: box.x + box.size / 2, y: box.y + box.size / 2 };
  return [
    mid,
    { x: lo.x, y: mid.y },
    { x: hi.x, y: mid.y },
    { x: mid.x, y: lo.y },
    { x: mid.x, y: hi.y },
    lo,
    { x: hi.x, y: lo.y },
    { x: lo.x, y: hi.y },
    hi,
  ];
}

describe('top-down fixture board, tapped on every cell', () => {
  const grid = buildGrid(TOPDOWN_FIXTURE);

  it('Canvas 2D: every painted cell is the cell a tap anywhere in it picks', () => {
    const tapped = new Set<string>();
    for (const camera of cameras(grid)) {
      const cells = canvasCells(grid, camera);
      // A zoomed board paints only what is on screen (plus its margin).
      const shown = camera.visibleBounds(grid);
      expect(cells).toHaveLength((shown.x1 - shown.x0 + 1) * (shown.y1 - shown.y0 + 1));
      for (const { box, pos } of cells) {
        expect(box.size).toBeCloseTo(40 * camera.scale, 9);
        for (const tap of taps(box)) expect(camera.pickTile(tap.x, tap.y, grid)).toEqual(pos);
        tapped.add(`${pos.x},${pos.y}`);
      }
    }
    expect(tapped.size).toBe(grid.width * grid.height);
  });

  it('WebGL: the ground shader draws, at every tap, the cell the tap picks', () => {
    for (const camera of cameras(grid)) {
      const frame = groundShaderFrame(camera.groundMatrix(), camera.tile);
      expect(frame.tileSize).toBe(40);
      for (let y = 0; y < grid.height; y++)
        for (let x = 0; x < grid.width; x++) {
          const box = camera.toScreen({ x, y });
          for (const tap of taps(box)) {
            expect(shaderCell(frame, tap)).toEqual({ x, y });
            expect(camera.pickTile(tap.x, tap.y, grid)).toEqual({ x, y });
          }
        }
    }
  });

  it('both backends agree just across every edge, on the neighbour', () => {
    const camera = cameras(grid)[1] as Camera;
    const frame = groundShaderFrame(camera.groundMatrix(), camera.tile);
    for (const { box, pos } of canvasCells(grid, camera)) {
      const e = box.size * 1e-3;
      for (const [tap, cell] of [
        [
          { x: box.x - e, y: box.y + box.size / 2 },
          { x: pos.x - 1, y: pos.y },
        ],
        [
          { x: box.x + box.size + e, y: box.y + box.size / 2 },
          { x: pos.x + 1, y: pos.y },
        ],
        [
          { x: box.x + box.size / 2, y: box.y - e },
          { x: pos.x, y: pos.y - 1 },
        ],
        [
          { x: box.x + box.size / 2, y: box.y + box.size + e },
          { x: pos.x, y: pos.y + 1 },
        ],
      ] as const) {
        expect(camera.pickTile(tap.x, tap.y, grid)).toEqual(cell);
        expect(shaderCell(frame, tap)).toEqual(cell);
      }
    }
  });
});

describe('top-down depth key: foot screen y, then x', () => {
  const camera = new Camera(
    { width: 1000, height: 700, dpr: 1 },
    { width: 20, height: 12 },
    'topdown',
  );

  it('sorts a row left to right and rows top to bottom, alike on both backends', () => {
    const actors = [
      { name: 'row 4, x 7', pos: { x: 7, y: 4 } },
      { name: 'row 3, x 9', pos: { x: 9, y: 3 } },
      { name: 'row 4, x 2', pos: { x: 2, y: 4 } },
      { name: 'row 5, x 0', pos: { x: 0, y: 5 } },
      { name: 'row 3, x 1', pos: { x: 1, y: 3 } },
    ];
    const order = (depth: typeof canvasActorDepth) =>
      [...actors]
        .sort((a, b) => depth(camera, a.pos, 1) - depth(camera, b.pos, 1))
        .map(({ name }) => name);
    const expected = ['row 3, x 1', 'row 3, x 9', 'row 4, x 2', 'row 4, x 7', 'row 5, x 0'];
    expect(order(canvasActorDepth)).toEqual(expected);
    expect(order(pixiActorDepth)).toEqual(expected);
    // Reversed input lands the same: the tie on a row no longer rests on list order.
    actors.reverse();
    expect(order(canvasActorDepth)).toEqual(expected);
    expect(order(pixiActorDepth)).toEqual(expected);
  });

  it('never lets x outweigh a world pixel of y or the shadow and scenery biases', () => {
    const wide = 225 * 40;
    expect(boardDepth({ x: wide, y: 100 }, 'topdown')).toBeLessThan(
      boardDepth({ x: 0, y: 101 }, 'topdown'),
    );
    // Scenery at the far right of a row still sorts under a shadow at its left, and the shadow under its figure.
    const figure = boardDepth({ x: 0, y: 100 }, 'topdown');
    expect(sceneryZ(boardDepth({ x: wide, y: 100 }, 'topdown'))).toBeLessThan(shadowZ(figure));
    expect(shadowZ(figure)).toBeLessThan(figure);
    expect(SCENERY_BIAS).toBeLessThan(SHADOW_BIAS);
  });

  it('leaves the oblique and orthographic keys as the foot y alone', () => {
    for (const projection of ['orthographic'] as const)
      expect(boardDepth({ x: 812.5, y: 412.25 }, projection)).toBe(412.25);
  });
});
