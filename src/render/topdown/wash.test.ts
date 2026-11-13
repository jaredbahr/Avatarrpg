/**
 * The top-down board's organic overlays (#457): the mask is deterministic and cached, it follows the
 * rules' 8-way reach (a diagonal step is washed, a corner cut is not), the cover cue is `hasCover`,
 * and both backends draw the layer on the top-down board only, with grid lines still on the setting.
 */
import { Sprite, Texture, TextureSource } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasCover } from '../../core/rules/damage';
import { buildGrid, posKey, reachable } from '../../core/rules/grid';
import type { Grid, MapDef, Unit, Vec2 } from '../../core/types';
import { CONTENT } from '../../content';
import { coverCue } from '../../app/scenes/coverCue';
import { Camera } from '../camera';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import type { MapView, RenderUnit } from '../view';
import { CS, hash2, vnoise } from './organic';
import {
  AREA_RGB,
  ENEMY_RGB,
  PARTY_RGB,
  REACH_RGB,
  TARGET_RGB,
  cachedWashMasks,
  resetWashCache,
  washImage,
  washMask,
  washSpec,
} from './wash';

const map = (rows: string[]): MapDef => ({
  ...TOPDOWN_FIXTURE,
  width: rows[0]?.length ?? 0,
  height: rows.length,
  rows,
  legend: {
    '.': { terrain: 'grass' },
    '#': { terrain: 'wall' },
    c: { terrain: 'grass', cover: true },
  },
});

const centre = (m: Uint8Array, grid: Grid, p: Vec2) =>
  m[(p.y * CS + CS / 2) * grid.width * CS + p.x * CS + CS / 2];

beforeEach(() => resetWashCache());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('the prototype noise', () => {
  it('is head.js verbatim', () => {
    // Values computed with the prototype's own expressions.
    let t = (3 * 374761393 + 5 * 668265263 + 171 * 1442695041) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
    expect(hash2(3, 5, 171)).toBe(((t ^ (t >>> 16)) & 0xffff) / 65535);
    expect(vnoise(0, 0, 1, 9)).toBe(hash2(0, 0, 1) * 2 - 1);
    for (let i = 0; i < 50; i++) {
      const v = vnoise(i * 3.7, i * 1.3, 7, 2.6);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('the wash mask', () => {
  const grid = buildGrid(map(['......', '......', '......', '......', '......']));
  const cells = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ];

  it('is deterministic and cached by its cell set', () => {
    const a = washMask(grid, cells);
    expect(washMask(grid, [...cells].reverse())).toBe(a);
    resetWashCache();
    expect(washMask(grid, cells)).toEqual(a);
  });

  it('keeps a bounded cache', () => {
    for (let x = 0; x < 6; x++) for (let y = 0; y < 5; y++) washMask(grid, [{ x, y }]);
    expect(cachedWashMasks()).toBeLessThanOrEqual(8);
  });

  it('covers every cell core and stays within the cap of its cells', () => {
    const m = washMask(grid, cells);
    const BW = grid.width * CS;
    const on = new Set(cells.map(posKey));
    for (let y = 0; y < grid.height * CS; y++)
      for (let x = 0; x < BW; x++) {
        const cell = { x: Math.floor(x / CS), y: Math.floor(y / CS) };
        const inCore = x % CS > 12 && x % CS < CS - 12 && y % CS > 12 && y % CS < CS - 12;
        if (on.has(posKey(cell)) && inCore) expect(m[y * BW + x]).toBe(1);
        if (!m[y * BW + x]) continue;
        // within the 9 px cap (and the majority pass's 2 px) of an authored cell's box
        const d = Math.min(
          ...cells.map((c) =>
            Math.hypot(
              Math.max(0, c.x * CS - x, x - (c.x * CS + CS - 1)),
              Math.max(0, c.y * CS - y, y - (c.y * CS + CS - 1)),
            ),
          ),
        );
        expect(d).toBeLessThanOrEqual(11);
      }
  });

  it('never washes a blocked cell', () => {
    const walled = buildGrid(map(['......', '..#...', '......']));
    const m = washMask(walled, [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ]);
    const BW = walled.width * CS;
    for (let y = CS; y < 2 * CS; y++)
      for (let x = 2 * CS; x < 3 * CS; x++) expect(m[y * BW + x]).toBe(0);
  });
});

describe('the reach follows the 8-way rule', () => {
  // From (2, 2) with one step: the open diagonal (1, 1) is reachable; (3, 3) is not, because
  // the wall at (3, 2) would be cut at its corner.
  const grid = buildGrid(map(['......', '......', '...#..', '......', '......']));
  const reach = reachable(
    { grid, blocked: new Set(), surfaces: CONTENT.surfaces, size: 1, climbCost: 1 },
    { x: 2, y: 2 },
    1,
  );
  const cells = [...reach.values()].filter((c) => c.cost > 0).map((c) => c.pos);
  const view = { grid, overlays: [{ kind: 'move', tiles: cells }] } as unknown as MapView;

  it('washes a diagonal step and not a corner cut', () => {
    expect(cells).toContainEqual({ x: 1, y: 1 });
    expect(cells).not.toContainEqual({ x: 3, y: 3 });
    const spec = washSpec({ ...view, units: [], path: [], pathFrom: null, hoverTile: null });
    expect(spec.washes).toEqual([{ cells, color: REACH_RGB }]);
    const m = washMask(grid, cells);
    expect(centre(m, grid, { x: 1, y: 1 })).toBe(1);
    expect(centre(m, grid, { x: 3, y: 3 })).toBe(0);
  });

  it('lays a solid 1 px rim round a tinted inside (#699)', () => {
    const image = washImage(
      washSpec({ ...view, units: [], path: [], pathFrom: null, hoverTile: null }),
    );
    const W = image.width;
    const a = (p: Vec2) => image.data[(p.y * W + p.x) * 4 + 3];
    expect(a({ x: CS + 20, y: CS + 20 })).toBe(96);
    const seen = new Set<number>();
    for (let i = 3; i < image.data.length; i += 4) if (image.data[i]) seen.add(image.data[i] ?? 0);
    expect([...seen].sort((x, y) => x - y)).toEqual([96, 255]);
  });
});

const unit = (id: string, pos: Vec2, faction: RenderUnit['faction']): RenderUnit =>
  ({ id, pos, size: 1, faction, fallen: false, sprite: 'unit.fire.kaya' }) as unknown as RenderUnit;

describe('targets, area, path and the cover pip', () => {
  const grid = buildGrid(map(['......', '......', '......', '......']));
  const base = {
    grid,
    units: [unit('kaya', { x: 0, y: 0 }, 'party'), unit('thug', { x: 4, y: 2 }, 'enemy')],
    path: [],
    pathFrom: null,
    hoverTile: null,
  } as unknown as MapView;

  it('rings a target on a valid tile and washes open ground targets', () => {
    const spec = washSpec({
      ...base,
      overlays: [
        {
          kind: 'target',
          tiles: [
            { x: 4, y: 2 },
            { x: 3, y: 3 },
          ],
        },
      ],
    });
    expect(spec.rings).toEqual([{ x: 4 * CS + 20, y: 2 * CS + 31, color: TARGET_RGB, w: 9, h: 3 }]);
    expect(spec.washes).toEqual([{ cells: [{ x: 3, y: 3 }], color: TARGET_RGB }]);
  });

  it('washes the area and rings everyone in it by side', () => {
    const spec = washSpec({
      ...base,
      overlays: [
        { kind: 'target', tiles: [{ x: 4, y: 2 }] },
        {
          kind: 'area',
          tiles: [
            { x: 4, y: 2 },
            { x: 0, y: 0 },
          ],
        },
      ],
    });
    expect(spec.washes.map((w) => w.color)).toEqual([AREA_RGB]);
    expect(spec.rings.map((r) => r.color)).toEqual([PARTY_RGB, ENEMY_RGB]);
  });

  it('walks the path in footprints to a ring', () => {
    const spec = washSpec({
      ...base,
      overlays: [],
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      pathFrom: { x: 0, y: 0 },
    });
    const image = washImage(spec);
    const W = image.width;
    // the end ring: its rightmost point, 10 px right of the last foot
    const end = { x: 2 * CS + 20 + 10, y: 1 * CS + 31 };
    expect(image.data.slice((end.y * W + end.x) * 4, (end.y * W + end.x) * 4 + 4)).toEqual(
      new Uint8ClampedArray([...PARTY_RGB, 255]),
    );
    // a footprint's dark print lies on the way
    let prints = 0;
    for (let i = 0; i < image.data.length; i += 4)
      if (image.data[i] === 50 && image.data[i + 1] === 33) prints++;
    expect(prints).toBeGreaterThan(8);
  });

  it('pips the aimed target only when the cue says so', () => {
    const cue = (cover: 'covered' | 'ignored' | null) =>
      washSpec({
        ...base,
        overlays: [{ kind: 'target', tiles: [{ x: 4, y: 2 }] }],
        targetReticle: { pos: { x: 4, y: 2 }, elevation: null, obscured: false, cover },
      }).pips;
    expect(cue(null)).toEqual([]);
    expect(cue('covered')).toEqual([{ x: 4 * CS + 32, y: 2 * CS + 25, kind: 'covered' }]);
    expect(cue('ignored').map((p) => p.kind)).toEqual(['ignored']);
  });
});

describe('the cover cue is hasCover', () => {
  // A barrel-like cover cell at (3, 1) screens a shot from (0, 1) at (4, 1); a figure screens too.
  const grid = buildGrid(map(['......', '...c..', '......', '......']));
  const make = (id: string, pos: Vec2, faction: Unit['faction'] = 'enemy') =>
    ({ id, pos, size: 1, faction, hp: 10 }) as unknown as Unit;
  const shooter = make('a', { x: 0, y: 1 }, 'party');
  const cases: { target: Unit; units: Unit[] }[] = [
    { target: make('t', { x: 4, y: 1 }), units: [] },
    { target: make('t', { x: 4, y: 3 }), units: [] },
    { target: make('t', { x: 4, y: 3 }), units: [make('b', { x: 3, y: 3 })] },
    { target: make('t', { x: 1, y: 2 }), units: [] },
    { target: make('t', { x: 3, y: 1 }), units: [] },
  ];

  it('agrees case by case, and melee and lobs read as the rule plays them', () => {
    for (const { target, units } of cases) {
      const roster = [shooter, target, ...units];
      const rule = hasCover(CONTENT, grid, target, undefined, {
        origin: shooter.pos,
        attacker: shooter,
        units: roster,
      });
      const adjacent = Math.max(Math.abs(target.pos.x - 0), Math.abs(target.pos.y - 1)) <= 1;
      const cue = coverCue(CONTENT, grid, shooter, target, { requiresLineOfSight: true }, roster);
      expect(cue, JSON.stringify(target.pos)).toBe(rule && !adjacent ? 'covered' : null);
      const lob = coverCue(CONTENT, grid, shooter, target, { requiresLineOfSight: false }, roster);
      expect(lob).toBe(rule && !adjacent ? 'ignored' : null);
    }
    expect(
      cases.some(({ target, units }) =>
        coverCue(CONTENT, grid, shooter, target, { requiresLineOfSight: true }, [
          shooter,
          target,
          ...units,
        ]),
      ),
    ).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Both backends                                                       */
/* ------------------------------------------------------------------ */

const gridLines = vi.hoisted(() => ({ count: 0 }));
vi.mock('../painters/tiles', () => ({
  paintTerrain: () => undefined,
  paintSurface: () => undefined,
  paintGridLine: () => void gridLines.count++,
}));
vi.mock('../fx/canvasFx', () => ({ CanvasFxLayer: class {} }));

const { Canvas2DBackend } = await import('../backends/canvas2d');
const { PixiBackend } = await import('../backends/pixi');

function fakeDocument(): void {
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { src: 'canvas', width: 0, height: 0 } as Record<string, unknown>;
      const known: Record<string, unknown> = {
        // only a computed layer's canvas is filled from an image of the whole top-down board
        putImageData: (data: { data: Uint8ClampedArray }) =>
          (canvas.src = data.data.length === 360 * 240 * 4 ? 'wash' : 'canvas'),
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        }),
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      };
      canvas.getContext = () =>
        new Proxy(known, {
          get: (target, key: string) => (key in target ? target[key] : () => undefined),
          set: (target, key: string, value) => {
            target[key] = value;
            return true;
          },
        });
      return canvas;
    },
  });
}

function fixtureView(extra: Partial<MapView> = {}): MapView {
  return {
    grid: buildGrid(TOPDOWN_FIXTURE),
    units: [],
    overlays: [
      {
        kind: 'move',
        tiles: [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 0, y: 2 },
        ],
      },
    ],
    npcs: [],
    props: [],
    path: [],
    pathFrom: null,
    aimArc: null,
    emitters: [],
    floaters: [],
    cameraNudge: { x: 0, y: 0 },
    activeUnitId: null,
    selectedUnitId: null,
    hoverTile: null,
    exit: null,
    hatch: false,
    gridLines: false,
    crispOverlays: false,
    atmosphere: false,
    backdrop: null,
    time: 0,
    reducedMotion: true,
    ...extra,
  } as unknown as MapView;
}

function camera(projection: 'topdown' | 'orthographic'): Camera {
  const out = new Camera({ width: 1000, height: 700, dpr: 1 }, { width: 9, height: 6 }, projection);
  out.integerZoom = true;
  out.fitExplore(projection === 'topdown' ? 120 : 96);
  return out;
}

function canvasFrame(projection: 'topdown' | 'orthographic', view: MapView) {
  const drawn: { what: string; args: number[] }[] = [];
  const ctx = new Proxy(
    { globalAlpha: 1, imageSmoothingEnabled: true } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        if (key === 'drawImage')
          return (image: { src?: string }, ...args: number[]) =>
            drawn.push({ what: image.src ?? '?', args });
        return () => undefined;
      },
      set(target, key: string, value) {
        target[key] = value;
        return true;
      },
    },
  );
  const backend = new Canvas2DBackend({
    width: 1,
    height: 1,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement);
  const proto = Canvas2DBackend.prototype as unknown as Record<string, (...args: never[]) => void>;
  for (const name of ['drawDecor', 'drawFxLayer', 'drawCastShadows', 'drawFloaters', 'drawUnits'])
    vi.spyOn(proto, name).mockImplementation(() => undefined);
  const marks = vi.spyOn(proto, 'drawPixelCues');
  const cam = camera(projection);
  backend.draw(view, cam);
  return { drawn, camera: cam, marks };
}

describe('Canvas 2D draws the organic layer', () => {
  it('on the top-down board, in place of the cell overlays, over the whole board', () => {
    fakeDocument();
    const { drawn, camera: cam, marks } = canvasFrame('topdown', fixtureView());
    const wash = drawn.find(({ what }) => what === 'wash');
    expect(wash?.args).toEqual([-cam.offsetX, -cam.offsetY, 360 * cam.scale, 240 * cam.scale]);
    const overlays = marks.mock.calls.flatMap((call) => call[0] as unknown as { id: string }[]);
    expect(overlays.some((c) => c.id.startsWith('overlay:'))).toBe(false);
    // the same view on the orthographic board does draw its cell overlay
    resetWashCache();
    const flat = canvasFrame('orthographic', fixtureView()).marks.mock.calls.flatMap(
      (call) => call[0] as unknown as { id: string }[],
    );
    expect(flat.some((c) => c.id.startsWith('overlay:'))).toBe(true);
  });

  it('not on the orthographic board, nor under High contrast', () => {
    fakeDocument();
    expect(
      canvasFrame('orthographic', fixtureView()).drawn.some(({ what }) => what === 'wash'),
    ).toBe(false);
    resetWashCache();
    expect(
      canvasFrame('topdown', fixtureView({ crispOverlays: true })).drawn.some(
        ({ what }) => what === 'wash',
      ),
    ).toBe(false);
  });

  it('keeps grid lines on the setting', () => {
    fakeDocument();
    gridLines.count = 0;
    canvasFrame('topdown', fixtureView({ gridLines: true }));
    expect(gridLines.count).toBeGreaterThan(0);
    gridLines.count = 0;
    canvasFrame('topdown', fixtureView({ gridLines: false }));
    expect(gridLines.count).toBe(0);
  });
});

describe('Pixi lays the same layer', () => {
  it('at the board origin, nearest, top-down only', () => {
    fakeDocument();
    const backend = Object.create(PixiBackend.prototype) as Record<string, unknown>;
    const sprite = new Sprite();
    const texture = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
    Object.assign(backend, {
      washSprite: sprite,
      squareFootprints: true,
      texture: () => texture,
    });
    const sync = (v: MapView, c: Camera) =>
      (backend.syncTopdownWash as (v: MapView, c: Camera) => void).call(backend, v, c);
    sync(fixtureView(), camera('topdown'));
    expect([sprite.visible, sprite.x, sprite.y, sprite.width, sprite.height]).toEqual([
      true,
      0,
      0,
      360,
      240,
    ]);
    expect(sprite.texture.source.scaleMode).toBe('nearest');
    sync(fixtureView(), camera('orthographic'));
    expect(sprite.visible).toBe(false);
    sync(fixtureView({ overlays: [] }), camera('topdown'));
    expect(sprite.visible).toBe(false);
  });
});
