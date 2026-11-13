/**
 * Both backends draw the organic surfaces on the top-down board only (#458): Canvas 2D lays the
 * painted layer in place of the cell painter's surfaces and draws its flames and steam still; Pixi
 * lays the same layer, leaves those surfaces out of its ground shader, and animates the flames and
 * the glow unless motion is reduced.
 */
import { Graphics, Sprite, Texture, TextureSource } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import type { Grid, MapDef, Tile } from '../../core/types';
import { Camera } from '../camera';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import type { MapView } from '../view';
import * as layerModule from './surfaceLayer';
import {
  drawsOrganicSurfaces,
  flameAtlasFrom,
  flameSheet,
  organicOwns,
  setFlameAtlas,
  surfaceArt,
} from './surfaceLayer';
import { glowAlpha } from './surfaces';

const painted = vi.hoisted(() => ({ surfaces: 0 }));
vi.mock('../painters/tiles', () => ({
  paintTerrain: () => undefined,
  // counts only the cells that hold a surface (the painter is asked for every cell)
  paintSurface: (_c: unknown, _b: unknown, tile: { surface: unknown }) =>
    void (tile.surface && painted.surfaces++),
  paintGridLine: () => undefined,
}));
vi.mock('../fx/canvasFx', () => ({ CanvasFxLayer: class {} }));

const { Canvas2DBackend } = await import('../backends/canvas2d');
const { PixiBackend } = await import('../backends/pixi');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setFlameAtlas(undefined);
});

/** The fixture with a burning cell beside its pool. */
function fireGrid(): Grid {
  const grid = buildGrid(TOPDOWN_FIXTURE as MapDef);
  const tiles = grid.tiles.slice();
  for (const i of [4 * 9 + 7, 4 * 9 + 8]) {
    const tile = tiles[i] as Tile;
    tiles[i] = { ...tile, surface: { id: 'fire', duration: 2, spread: 0 } };
  }
  return { ...grid, tiles };
}

function view(extra: Partial<MapView> = {}): MapView {
  return {
    grid: fireGrid(),
    units: [],
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
    ...extra,
  } as unknown as MapView;
}

function fakeDocument(): void {
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { src: 'canvas', width: 0, height: 0 } as Record<string, unknown>;
      const known: Record<string, unknown> = {
        // the board-sized layers are the surfaces' (the fixture board is 360 x 240 px)
        putImageData: (image: { data: Uint8ClampedArray }) =>
          (canvas.src = image.data.length === 360 * 240 * 4 ? 'surfaces' : 'canvas'),
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

function camera(projection: 'topdown' | 'orthographic'): Camera {
  const out = new Camera({ width: 1000, height: 700, dpr: 1 }, { width: 9, height: 6 }, projection);
  out.integerZoom = true;
  out.fitExplore(projection === 'topdown' ? 120 : 96);
  return out;
}

const ATLAS = flameAtlasFrom({
  frames: Object.fromEntries(
    ['a', 'b', 'c'].flatMap((k, s) =>
      [0, 1, 2, 3].map((i) => [
        `vfx13/fire_ground_${k}/${i}`,
        { frame: { x: i * 32, y: s * 48, w: 24, h: 32 } },
      ]),
    ),
  ),
  effects: Object.fromEntries(
    ['a', 'b', 'c'].map((k) => [
      `vfx13/fire_ground_${k}`,
      {
        frames: [0, 1, 2, 3].map((i) => `vfx13/fire_ground_${k}/${i}`),
        pivot: { x: 12, y: 16 },
      },
    ]),
  ),
  meta: { image: 'vfx.webp' },
});

function canvasFrame(projection: 'topdown' | 'orthographic', v: MapView) {
  const drawn: { what: string; args: number[] }[] = [];
  const ops: string[] = [];
  const ctx = new Proxy(
    { globalAlpha: 1, imageSmoothingEnabled: true } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key in target) return target[key];
        if (key === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        if (key === 'drawImage')
          return (image: { src?: string }, ...args: number[]) => {
            drawn.push({ what: image.src ?? '?', args });
            ops.push(
              `${String(target.globalCompositeOperation ?? 'source-over')}:${image.src ?? '?'}`,
            );
          };
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
  for (const name of ['drawDecor', 'drawFxLayer', 'drawCastShadows', 'drawFloaters'])
    vi.spyOn(proto, name).mockImplementation(() => undefined);
  painted.surfaces = 0;
  backend.draw(v, camera(projection));
  return { drawn, ops };
}

describe('which surfaces are organic', () => {
  it('on the top-down board, unless hatched or in High contrast; rubble as its sprite', () => {
    expect(drawsOrganicSurfaces({ hatch: false, crispOverlays: false }, 'topdown')).toBe(true);
    expect(drawsOrganicSurfaces({ hatch: true, crispOverlays: false }, 'topdown')).toBe(false);
    expect(drawsOrganicSurfaces({ hatch: false, crispOverlays: true }, 'topdown')).toBe(false);
    expect(drawsOrganicSurfaces({ hatch: false, crispOverlays: false }, 'orthographic')).toBe(
      false,
    );
    expect(organicOwns(true, 'water')).toBe(true);
    // rubble is not painted into the layer, but its heap sprite replaces the cell drawing (#577)
    expect(organicOwns(true, 'rubble')).toBe(true);
    expect(organicOwns(false, 'water')).toBe(false);
  });

  it('keep a surface the scene paints to the scene', () => {
    const v = view({
      scene: { ground: [], scenery: [], paintedWater: true } as unknown as MapView['scene'],
    });
    // the layer is the board's one buffer, so each state is read as it is drawn
    const withArt = surfaceArt(v, true).layer.data.slice();
    const without = surfaceArt(v, false).layer.data.slice();
    const W = 360;
    const pool = (7 * 40 + 20 + (2 * 40 + 20) * W) * 4 + 3;
    expect(withArt[pool]).toBe(0);
    expect(without[pool]).toBe(255);
  });
});

describe('Canvas 2D draws the organic surfaces', () => {
  it('on the top-down board, in place of the cell painter, with the glow added', () => {
    fakeDocument();
    const { drawn, ops } = canvasFrame('topdown', view());
    expect(drawn.filter(({ what }) => what === 'surfaces').length).toBe(2);
    expect(ops).toContain('lighter:surfaces');
    expect(painted.surfaces).toBe(0);
  });

  it('not on the orthographic board', () => {
    fakeDocument();
    const { drawn } = canvasFrame('orthographic', view());
    expect(drawn.some(({ what }) => what === 'surfaces')).toBe(false);
    expect(painted.surfaces).toBeGreaterThan(0);
  });

  it('stands the flames among the figures, still', () => {
    fakeDocument();
    setFlameAtlas(ATLAS);
    vi.spyOn(layerModule.flameImages, 'get').mockImplementation(
      (url) => ({ src: url, naturalWidth: 128, naturalHeight: 160 }) as HTMLImageElement,
    );
    const frame = (time: number) =>
      canvasFrame('topdown', view({ time, reducedMotion: false }))
        .drawn.filter(({ what }) => what === 'art/topdown/vfx.webp')
        .map(({ args }) => args);
    const a = frame(0);
    expect(a.length).toBeGreaterThan(0);
    expect(frame(400)).toEqual(a);
  });
});

describe('Pixi draws the same surfaces', () => {
  function pixi() {
    const backend = Object.create(PixiBackend.prototype) as Record<string, unknown>;
    const texture = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
    const surfaceSprite = new Sprite();
    const glowSprite = new Sprite();
    Object.assign(backend, {
      surfaceSprite,
      glowSprite,
      topdownSteam: new Graphics(),
      texture: () => texture,
    });
    return { backend, surfaceSprite, glowSprite };
  }

  it('lays the layer at the board origin, nearest, and flickers the glow unless reduced', () => {
    fakeDocument();
    const { backend, surfaceSprite, glowSprite } = pixi();
    const v = view({ reducedMotion: false, time: 30 });
    backend.surfaces = surfaceArt(v, false);
    (backend.syncTopdownSurfaces as (v: MapView) => void).call(backend, v);
    expect([surfaceSprite.visible, surfaceSprite.x, surfaceSprite.y, surfaceSprite.width]).toEqual([
      true,
      0,
      0,
      360,
    ]);
    expect(surfaceSprite.texture.source.scaleMode).toBe('nearest');
    expect(glowSprite.visible).toBe(true);
    expect(glowSprite.alpha).toBeCloseTo(glowAlpha(30), 6);
    (backend.syncTopdownSurfaces as (v: MapView) => void).call(backend, {
      ...v,
      reducedMotion: true,
    });
    expect(glowSprite.alpha).toBe(glowAlpha(null));
    backend.surfaces = null;
    (backend.syncTopdownSurfaces as (v: MapView) => void).call(backend, v);
    expect(surfaceSprite.visible).toBe(false);
  });

  it('leaves organic surfaces out of the ground shader on the top-down board only', () => {
    const backend = Object.create(PixiBackend.prototype) as Record<string, unknown>;
    const writes: number[] = [];
    Object.assign(backend, {
      mapSignature: '',
      mapCanvas: {
        width: 9,
        height: 6,
        getContext: () => ({
          createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
          putImageData: (image: { data: Uint8ClampedArray }) =>
            writes.splice(0, writes.length, ...image.data),
        }),
      },
      mapTexture: { source: { update: () => undefined, resize: () => undefined } },
    });
    const upload = (organic: boolean) => {
      backend.organic = organic;
      backend.mapSignature = '';
      (backend.uploadMap as (v: MapView, p: boolean) => void).call(backend, view(), false);
      // the fire cell's intensity byte
      return writes[(4 * 9 + 7) * 4 + 1];
    };
    expect(upload(false)).toBeGreaterThan(0);
    expect(upload(true)).toBe(0);
  });

  it('freezes flames under reduce motion and lets a fresh catch lick first', () => {
    const site = { x: 10, y: 10, phase: 3, sheet: 'fire_ground_c' as const, cell: '0,0' };
    const burning = new Set(['0,0']);
    expect(flameSheet(site, null, burning)).toBe('fire_ground_c');
    expect(flameSheet(site, 1000, burning)).toBe('fire_ground_b');
    expect(flameSheet(site, 1600, burning)).toBe('fire_ground_c');
  });
});
