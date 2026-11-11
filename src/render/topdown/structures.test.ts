/**
 * The Earth Wall and rubble on top-down boards (#577): which cells stand a drawing (a raised wall,
 * not authored masonry nor an expired one; a rubble surface, not the scene's painted heaps), the
 * wall's depth among the figures, both backends, and the oblique board untouched.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import type { Grid, MapDef, MapScene, Tile, Vec2 } from '../../core/types';
import { Camera } from '../camera';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import type { MapView, RenderUnit } from '../view';
import * as propLayer from './propLayer';
import { TOPDOWN_OBJECTS, topdownPropBox, topdownPropUrl } from './props';
import { topdownStructures, withStructures } from './structures';

vi.mock('../painters/tiles', () => ({
  paintTerrain: () => undefined,
  paintSurface: () => undefined,
  paintGridLine: () => undefined,
}));
vi.mock('../fx/canvasFx', () => ({ CanvasFxLayer: class {} }));

const { Canvas2DBackend } = await import('../backends/canvas2d');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  propLayer.resetPropShadows();
});

/** A 6x4 board with authored masonry at (0, 0), a raised wall at (2, 1) and rubble at (4, 2). */
function board(): Grid {
  const grid = buildGrid({
    ...TOPDOWN_FIXTURE,
    width: 6,
    height: 4,
    rows: ['#.....', '......', '......', '......'],
    legend: { '.': { terrain: 'grass' }, '#': { terrain: 'wall' } },
  } as MapDef);
  const tiles = grid.tiles.slice();
  const wall = tiles[0] as Tile;
  tiles[1 * 6 + 2] = { ...wall };
  const grass = tiles[2 * 6 + 4] as Tile;
  tiles[2 * 6 + 4] = { ...grass, surface: { id: 'rubble', duration: -1, spread: 0 } };
  return { ...grid, tiles };
}

const RAISED: Vec2 = { x: 2, y: 1 };
const base = (extra: Partial<MapView> = {}) =>
  ({ grid: board(), raisedWalls: [RAISED], ...extra }) as Pick<
    MapView,
    'grid' | 'scene' | 'raisedWalls'
  >;
const ids = (v: Pick<MapView, 'grid' | 'scene' | 'raisedWalls'>) =>
  topdownStructures(v).map((p) => `${p.kind}@${p.pos.x},${p.pos.y}`);

describe('which cells stand a wall or a heap', () => {
  it('a raised wall and a rubble surface; never the authored masonry', () => {
    expect(ids(base())).toEqual(['earth_wall@2,1', 'rubble@4,2']);
  });

  it('no wall once it has expired and the tile is back', () => {
    const grid = board();
    const tiles = grid.tiles.slice();
    tiles[1 * 6 + 2] = tiles[1 * 6 + 1] as Tile;
    expect(ids(base({ grid: { ...grid, tiles } }))).toEqual(['rubble@4,2']);
    expect(ids(base({ raisedWalls: [] }))).toEqual(['rubble@4,2']);
  });

  it('no heap under a scenery piece (the Forest Road draws its heaps as scenery)', () => {
    const scene = {
      ground: [],
      scenery: [
        {
          id: 'r',
          url: 'r.png',
          x: 0,
          y: 0,
          width: 40,
          height: 40,
          footprint: [{ x: 4, y: 2 }],
          depth: { x: 4, y: 2 },
        },
      ],
    } as unknown as MapScene;
    expect(ids(base({ scene }))).toEqual(['earth_wall@2,1']);
  });

  it('none where the scene already paints it', () => {
    const scene = {
      ground: [],
      scenery: [
        {
          id: 'w',
          url: 'w.png',
          x: 0,
          y: 0,
          width: 40,
          height: 40,
          footprint: [RAISED],
          depth: RAISED,
        },
      ],
      paintedRubble: [{ x: 4, y: 2 }],
    } as unknown as MapScene;
    expect(ids(base({ scene }))).toEqual([]);
  });

  it('as props with no hp bar and no oblique fallback sprite', () => {
    const [wall] = topdownStructures(base());
    expect(wall).toMatchObject({ kind: 'earth_wall', sprite: '', hp: 1, maxHp: 1 });
    const v = { ...base(), props: [] } as unknown as MapView;
    expect(withStructures(v).props.map((p) => p.id)).toEqual(['wall:2,1', 'rubble:4,2']);
  });
});

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function fakeDocument(): void {
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { src: 'canvas', width: 0, height: 0 } as Record<string, unknown>;
      const known: Record<string, unknown> = {
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4).fill(255),
        }),
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
      };
      canvas.getContext = () =>
        new Proxy(known, {
          get: (target, k: string) => (k in target ? target[k] : () => undefined),
          set: (target, k: string, value) => {
            target[k] = value;
            return true;
          },
        });
      return canvas;
    },
  });
  vi.spyOn(propLayer.topdownPropImages, 'get').mockImplementation(
    (url) => ({ src: url, naturalWidth: 44, naturalHeight: 34 }) as HTMLImageElement,
  );
}

const unit = (id: string, pos: Vec2): RenderUnit =>
  ({
    id,
    pos,
    size: 1,
    faction: 'party',
    fallen: false,
    sprite: 'unit.fire.kaya',
  }) as unknown as RenderUnit;

function frame(projection: 'topdown' | 'oblique', units: RenderUnit[] = []) {
  const drawn: { what: string; args: number[] }[] = [];
  const ctx = new Proxy({ globalAlpha: 1 } as Record<string, unknown>, {
    get(target, k: string) {
      if (k in target) return target[k];
      if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (k === 'drawImage')
        return (image: { src?: string }, ...args: number[]) =>
          drawn.push({ what: image.src ?? '?', args });
      return () => undefined;
    },
    set(target, k: string, value) {
      target[k] = value;
      return true;
    },
  });
  const backend = new Canvas2DBackend({
    width: 1,
    height: 1,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement);
  const proto = Canvas2DBackend.prototype as unknown as Record<string, (...args: never[]) => void>;
  for (const name of ['drawDecor', 'drawFxLayer', 'drawCastShadows', 'drawFloaters'])
    vi.spyOn(proto, name).mockImplementation(() => undefined);
  vi.spyOn(proto, 'drawUnits').mockImplementation((v: MapView) => {
    for (const u of v.units) drawn.push({ what: `unit:${u.id}`, args: [] });
  });
  const cam = new Camera({ width: 1000, height: 700, dpr: 1 }, { width: 6, height: 4 }, projection);
  cam.integerZoom = true;
  cam.fitExplore(projection === 'topdown' ? 120 : 96);
  const view = {
    grid: board(),
    raisedWalls: [RAISED],
    units,
    overlays: [],
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
  } as unknown as MapView;
  backend.draw(view, cam);
  return { drawn, camera: cam };
}

const WALL_URL = topdownPropUrl(TOPDOWN_OBJECTS.earth_wall ?? { name: '', w: 0, h: 0, base: 0 });
const RUBBLE_URL = topdownPropUrl(TOPDOWN_OBJECTS.rubble ?? { name: '', w: 0, h: 0, base: 0 });

describe('Canvas 2D stands the wall and the heap', () => {
  it('on their boxes, seated on the props’ shadow layer', () => {
    fakeDocument();
    const { drawn, camera: cam } = frame('topdown');
    const wall = drawn.find(({ what }) => what === WALL_URL);
    const box = topdownPropBox(
      RAISED,
      TOPDOWN_OBJECTS.earth_wall ?? { name: '', w: 0, h: 0, base: 0 },
    );
    expect(wall?.args).toEqual([
      box.x * cam.scale - cam.offsetX,
      box.y * cam.scale - cam.offsetY,
      box.w * cam.scale,
      box.h * cam.scale,
    ]);
    expect(drawn.some(({ what }) => what === RUBBLE_URL)).toBe(true);
    // the shadow layer holds both masks
    const { layer } = propLayer.propShadows(
      withStructures({ grid: board(), raisedWalls: [RAISED], props: [] } as unknown as MapView)
        .props,
      undefined,
    );
    expect(layer).not.toBeNull();
  });

  it('sorts the wall by its cell’s foot line: a figure north of it behind, south of it in front', () => {
    fakeDocument();
    const { drawn } = frame('topdown', [
      unit('north', { x: 2, y: 0 }),
      unit('south', { x: 2, y: 2 }),
    ]);
    const order = drawn
      .map(({ what }) => what)
      .filter((w) => w.startsWith('unit:') || w === WALL_URL);
    expect(order).toEqual(['unit:north', WALL_URL, 'unit:south']);
  });

  it('leaves the oblique board as it was', () => {
    fakeDocument();
    const { drawn } = frame('oblique');
    expect(drawn.some(({ what }) => what === WALL_URL || what === RUBBLE_URL)).toBe(false);
  });
});

describe('Pixi stands them through the same path', () => {
  it('adds the structures to a top-down view, and skips an unloaded one rather than drawing a sprite', () => {
    const source = readFileSync('src/render/backends/pixi.ts', 'utf8');
    expect(source).toContain("if (camera.projection === 'topdown') view = withStructures(view);");
    expect(source).toMatch(
      /else if \(!prop\.sprite\) \{\s*\/\/[^\n]*\n\s*sprite\.visible = false;/,
    );
  });
});
