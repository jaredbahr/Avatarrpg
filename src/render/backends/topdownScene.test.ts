/**
 * Both backends draw a top-down map's scene (ADR 0104, phase T3): its ground plates at the identity
 * ground transform, 40 world px a tile, in place of the procedural terrain once every plate and
 * piece has loaded; and its scenery in one depth order with the figures (`boardDepth`). Its shadows
 * are baked into the plates. CI takes the Canvas 2D path, so it is driven through a whole `draw` here; Pixi's
 * scene pass is run on a stage built without a WebGL renderer.
 */
import type { Sprite } from 'pixi.js';
import { Container, Texture, TextureSource } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import type { Vec2 } from '../../core/types';
import { Camera } from '../camera';
import { sceneImages } from '../scene';
import { TOPDOWN_FIXTURE, TOPDOWN_FIXTURE_SCENE } from '../topdown.fixture';
import type { MapView, RenderUnit } from '../view';
import { Canvas2DBackend, canvasActorDepth } from './canvas2d';
import { PixiBackend, pixiActorDepth } from './pixi';
import { boardDepth, sceneryZ } from './depthOrder';

const painted = vi.hoisted(() => [] as Vec2[]);

vi.mock('../painters/tiles', () => ({
  paintTerrain: (_ctx: unknown, _box: unknown, _t: unknown, pos: Vec2) => painted.push({ ...pos }),
  paintSurface: () => undefined,
  paintGridLine: () => undefined,
}));

// CanvasFxLayer paints its atlas in the constructor; nothing here draws effects.
vi.mock('../fx/canvasFx', () => ({ CanvasFxLayer: class {} }));

afterEach(() => {
  painted.length = 0;
  vi.restoreAllMocks();
});

const GROUND_URL = TOPDOWN_FIXTURE_SCENE.ground[0]?.url ?? '';
const ROCK_URL = TOPDOWN_FIXTURE_SCENE.scenery[0]?.url ?? '';

/** Fake decoded pages, one art px a world px, so `sceneImage` finds every piece. */
const IMAGES: Record<string, HTMLImageElement> = {
  [GROUND_URL]: { naturalWidth: 360, naturalHeight: 240, src: GROUND_URL } as HTMLImageElement,
  [ROCK_URL]: { naturalWidth: 40, naturalHeight: 80, src: ROCK_URL } as HTMLImageElement,
};

function artLoaded(loaded: boolean): void {
  vi.spyOn(sceneImages, 'get').mockImplementation((url: string) =>
    loaded ? (IMAGES[url] ?? null) : null,
  );
}

/** Figures behind the rock, level with its depth row, and in front of it. */
const FIGURES: readonly { id: string; pos: Vec2 }[] = [
  { id: 'above', pos: { x: 5, y: 1 } },
  { id: 'beside', pos: { x: 4, y: 2 } },
  { id: 'level', pos: { x: 5, y: 3 } },
  { id: 'front', pos: { x: 6, y: 4 } },
];

function unit(id: string, pos: Vec2): RenderUnit {
  return { id, pos, size: 1, faction: 'party', sprite: 'unit.fire.kaya' } as unknown as RenderUnit;
}

function view(): MapView {
  return {
    scene: TOPDOWN_FIXTURE_SCENE,
    grid: buildGrid(TOPDOWN_FIXTURE),
    units: FIGURES.map(({ id, pos }) => unit(id, pos)),
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
}

function camera(projection: 'topdown' | 'orthographic'): Camera {
  const out = new Camera({ width: 1000, height: 700, dpr: 1 }, { width: 9, height: 6 }, projection);
  out.integerZoom = projection === 'topdown';
  out.fitExplore(120);
  out.panBy(-13, 7);
  return out;
}

/** What a whole Canvas 2D frame drew, in order: the scene's pages and the figures. */
function canvasFrame(projection: 'topdown' | 'orthographic', overrides: Partial<MapView> = {}) {
  const drawn: { what: string; args: number[] }[] = [];
  const state: Record<string, unknown> = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    globalCompositeOperation: 'source-over',
  };
  const ctx = new Proxy(state, {
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
  });
  const backend = new Canvas2DBackend({
    width: 1,
    height: 1,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement);
  const proto = Canvas2DBackend.prototype as unknown as Record<string, (...args: never[]) => void>;
  const quiet = [
    'drawDecor',
    'drawOverlays',
    'drawSteamPuffs',
    'drawPath',
    'drawFxLayer',
    'drawExit',
    'drawClimbMarkers',
    'drawCastShadows',
    'drawUnitRings',
    'flushHealthBars',
    'drawTargetReticle',
    'drawFloaters',
  ];
  for (const name of quiet) vi.spyOn(proto, name).mockImplementation(() => undefined);
  vi.spyOn(proto, 'drawUnits').mockImplementation((v: MapView) => {
    for (const u of v.units) drawn.push({ what: `unit:${u.id}`, args: [] });
  });
  const cam = camera(projection);
  backend.draw({ ...view(), ...overrides }, cam);
  return { drawn, camera: cam };
}

describe('Canvas 2D draws a top-down scene', () => {
  it('lays the ground plate at the identity transform, 40 world px a tile, in place of the terrain', () => {
    artLoaded(true);
    const { drawn, camera: cam } = canvasFrame('topdown');
    const plate = drawn.find(({ what }) => what === GROUND_URL);
    expect(plate?.args).toEqual([
      0,
      0,
      360,
      240,
      -cam.offsetX,
      -cam.offsetY,
      360 * cam.scale,
      240 * cam.scale,
    ]);
    // The plate covers cell (x, y) exactly where the camera draws and picks it.
    const cell = cam.toScreen({ x: 3, y: 2 });
    expect(-cam.offsetX + 3 * 40 * cam.scale).toBeCloseTo(cell.x, 9);
    expect(-cam.offsetY + 2 * 40 * cam.scale).toBeCloseTo(cell.y, 9);
    expect(painted).toEqual([]);
  });

  it('sorts the scenery among the figures by its depth, a level figure in front', () => {
    artLoaded(true);
    const { drawn } = canvasFrame('topdown');
    const order = drawn.filter(({ what }) => what !== GROUND_URL).map(({ what }) => what);
    expect(order).toEqual(['unit:above', 'unit:beside', ROCK_URL, 'unit:level', 'unit:front']);
  });

  it('stands the rock on its box: foot at its depth row, under pan and zoom only', () => {
    artLoaded(true);
    const { drawn, camera: cam } = canvasFrame('topdown');
    const rock = drawn.find(({ what }) => what === ROCK_URL);
    // Drawn inside its own foot transform: up its full height from the foot.
    expect(rock?.args.slice(4)).toEqual([0, -80 * cam.scale, 40 * cam.scale, 80 * cam.scale]);
  });

  it('skips the board-edge falloff over a painted scene, which runs past the grid', () => {
    const proto = Canvas2DBackend.prototype as unknown as Record<string, () => void>;
    const shade = vi.spyOn(proto, 'drawShade').mockImplementation(() => undefined);
    artLoaded(true);
    canvasFrame('topdown', { atmosphere: true });
    expect(shade).not.toHaveBeenCalled();
    // Until the art loads, the procedural board keeps its falloff.
    artLoaded(false);
    canvasFrame('topdown', { atmosphere: true });
    expect(shade).toHaveBeenCalledTimes(1);
  });

  it('keeps the procedural terrain until every plate and piece has loaded', () => {
    artLoaded(false);
    const { drawn, camera: cam } = canvasFrame('topdown');
    expect(drawn.some(({ what }) => what === GROUND_URL || what === ROCK_URL)).toBe(false);
    const shown = cam.visibleBounds(buildGrid(TOPDOWN_FIXTURE));
    expect(painted).toHaveLength((shown.x1 - shown.x0 + 1) * (shown.y1 - shown.y0 + 1));
  });

  it('leaves the orthographic board without a scene, as before', () => {
    artLoaded(true);
    const { drawn } = canvasFrame('orthographic');
    expect(drawn.some(({ what }) => what === GROUND_URL || what === ROCK_URL)).toBe(false);
    expect(painted.length).toBeGreaterThan(0);
    expect(drawn.map(({ what }) => what)).toEqual([
      'unit:above',
      'unit:beside',
      'unit:level',
      'unit:front',
    ]);
  });
});

/** Pixi's scene pass on a bare stage: the real `syncScene`, with no WebGL renderer behind it. */
function pixiScene(projection: 'topdown' | 'orthographic') {
  const backend = Object.create(PixiBackend.prototype) as Record<string, unknown>;
  const sceneGround = new Container();
  const breeze = new Container();
  sceneGround.addChild(breeze);
  const unitLayer = new Container();
  unitLayer.sortableChildren = true;
  const groundChunks = new Map<string, Sprite>();
  const scenerySprites = new Map<string, Sprite>();
  const texture = new Texture({ source: new TextureSource({ width: 40, height: 80 }) });
  Object.assign(backend, {
    sceneGround,
    breeze,
    unitLayer,
    groundChunks,
    scenerySprites,
    breezePools: new Map(),
    flockLayer: new Container(),
    flock: undefined,
    squareFootprints: false,
    viewport: { width: 1000, height: 700, dpr: 1 },
    sceneTextures: {
      begin: () => undefined,
      end: () => undefined,
      get: (piece: { url: string }) => (IMAGES[piece.url] ? texture : null),
    },
  });
  const cam = camera(projection);
  const complete = (
    backend.syncScene as (this: unknown, view: MapView, camera: Camera) => boolean
  ).call(backend, view(), cam);
  return { complete, groundChunks, scenerySprites, camera: cam };
}

describe('Pixi draws a top-down scene', () => {
  it('places the plate and the piece in world px', () => {
    artLoaded(true);
    const { complete, groundChunks, scenerySprites } = pixiScene('topdown');
    expect(complete).toBe(true);
    const plate = groundChunks.get('0');
    expect([plate?.x, plate?.y, plate?.width, plate?.height]).toEqual([0, 0, 360, 240]);
    const rock = scenerySprites.get('fixture.rock');
    expect([rock?.x, rock?.y, rock?.width, rock?.height]).toEqual([200, 120, 40, 80]);
    expect(rock?.anchor.y).toBe(1);
  });

  it('sorts the piece among the figures as Canvas 2D does', () => {
    artLoaded(true);
    const { scenerySprites, camera: cam } = pixiScene('topdown');
    const rockZ = scenerySprites.get('fixture.rock')?.zIndex ?? NaN;
    const piece = TOPDOWN_FIXTURE_SCENE.scenery[0];
    expect(rockZ).toBe(
      sceneryZ(boardDepth(cam.groundPoint(piece?.depth ?? { x: 0, y: 0 }), 'topdown')),
    );
    const behind = (id: string) => {
      const pos = FIGURES.find((f) => f.id === id)?.pos ?? { x: 0, y: 0 };
      return pixiActorDepth(cam, pos, 1, false) < rockZ;
    };
    expect(FIGURES.map(({ id }) => behind(id))).toEqual([true, true, false, false]);
    // Canvas 2D's key for each figure is the very same number.
    for (const { pos } of FIGURES)
      expect(canvasActorDepth(cam, pos, 1, false)).toBe(pixiActorDepth(cam, pos, 1, false));
  });

  it('draws no scene on the orthographic board', () => {
    artLoaded(true);
    const { complete, groundChunks, scenerySprites } = pixiScene('orthographic');
    expect(complete).toBe(false);
    expect(groundChunks.size).toBe(0);
    expect(scenerySprites.size).toBe(0);
  });
});
