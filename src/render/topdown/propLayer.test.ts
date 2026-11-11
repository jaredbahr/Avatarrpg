/**
 * Runtime object shadows and top-down props (#459): the mask cache is bounded, the layer follows
 * the live props (a broken prop drops its shadow), and both backends stand the props' drawings and
 * their shadow on the top-down board only. The seating rule itself is checked on the real drawings
 * in `scripts/art/topdown/props-seating.test.ts`.
 */
import { Sprite, Texture, TextureSource } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGrid } from '../../core/rules/grid';
import { CONTENT } from '../../content';
import { Camera } from '../camera';
import type { RgbaImage } from '../shadow/hardShadowMask';
import { TOPDOWN_FIXTURE } from '../topdown.fixture';
import type { MapView, RenderProp } from '../view';
import type * as SpriteCache from '../spriteCache';
import { BoundedLru } from './lru';
import { OBJECT_SHADOW_CAP, ObjectShadowCache, objectShadowMask } from './objectShadow';
import * as propLayer from './propLayer';
import { TOPDOWN_PROPS, topdownPropBox, topdownPropUrl } from './props';

/** A 10x12 block on a clear 14x14 canvas, drawn as a decoded image stand-in. */
function block(w = 10, h = 12): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data.set([120, 90, 60, 255], i * 4);
  }
  return { width: w, height: h, data };
}

const fakeImage = (url: string, w: number, h: number) =>
  ({ src: url, naturalWidth: w, naturalHeight: h, width: w, height: h }) as HTMLImageElement;

const LOADED = {
  get: (url: string) => {
    const sprite = Object.values(TOPDOWN_PROPS).find((s) => topdownPropUrl(s) === url);
    return sprite ? fakeImage(url, sprite.w, sprite.h) : null;
  },
};
const pixels = (image: HTMLImageElement) => block(image.naturalWidth, image.naturalHeight);

const barrel = (id: string, x: number, y: number): RenderProp => ({
  id,
  kind: 'water_barrel',
  pos: { x, y },
  sprite: 'prop.barrel',
  name: 'Water barrel',
  hp: 6,
  maxHp: 6,
});

beforeEach(() => propLayer.resetPropShadows());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TOPDOWN_PROPS', () => {
  it('maps every prop the game defines to a drawing', () => {
    expect(Object.keys(TOPDOWN_PROPS).sort()).toEqual([...CONTENT.props.keys()].sort());
  });

  it('stands a prop centred on its cell, its base on the prototype prop line', () => {
    const s = TOPDOWN_PROPS.water_barrel;
    if (!s) throw new Error('no barrel');
    // cellX(x) = 40x + 20, cellY(y) + 4 = 40y + 31 + 4
    expect(topdownPropBox({ x: 2, y: 3 }, s)).toEqual({ x: 89, y: 127, w: 22, h: 28 });
    expect(TOPDOWN_PROPS.oil_flask?.base).toBe(33);
  });
});

describe('the mask cache', () => {
  it('is bounded', () => {
    const cache = new ObjectShadowCache();
    for (let i = 0; i < OBJECT_SHADOW_CAP * 3; i++) cache.get(`img${i}`, () => block());
    expect(cache.size).toBe(OBJECT_SHADOW_CAP);
    const lru = new BoundedLru<string, number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    lru.get('a');
    lru.set('c', 3);
    expect([lru.has('a'), lru.has('b'), lru.has('c')]).toEqual([true, false, true]);
  });

  it('reads an image once and is deterministic', () => {
    const cache = new ObjectShadowCache();
    const read = vi.fn(() => block());
    const a = cache.get('k', read);
    const b = cache.get('k', read);
    expect(read).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(objectShadowMask(block()).alpha).toEqual(a?.alpha);
  });

  it('holds one mask per drawing, however many props share it', () => {
    propLayer.propShadows(
      [barrel('a', 1, 1), barrel('b', 3, 1), barrel('c', 5, 1)],
      undefined,
      LOADED,
      pixels,
    );
    expect(propLayer.cachedMaskCount()).toBe(1);
  });
});

describe('the props shadow layer', () => {
  const alphaAt = (layer: propLayer.PropShadows['layer'], wx: number, wy: number) => {
    if (!layer) return 0;
    const x = wx - layer.x,
      y = wy - layer.y;
    if (x < 0 || y < 0 || x >= layer.image.width || y >= layer.image.height) return 0;
    return layer.image.data[(y * layer.image.width + x) * 4 + 3] ?? 0;
  };
  /** The seam row under the barrel's foot centre at cell (x, y). */
  const seam = (x: number, y: number) => {
    const box = topdownPropBox(
      { x, y },
      TOPDOWN_PROPS.water_barrel ?? { name: '', w: 0, h: 0, base: 0 },
    );
    return { x: box.x + Math.floor(box.w / 2), y: box.y + box.h };
  };

  it('lays a seam under each standing prop', () => {
    const { layer } = propLayer.propShadows(
      [barrel('a', 1, 1), barrel('b', 4, 2)],
      undefined,
      LOADED,
      pixels,
    );
    for (const [x, y] of [
      [1, 1],
      [4, 2],
    ] as const) {
      const at = seam(x, y);
      expect(alphaAt(layer, at.x, at.y)).toBe(175);
    }
  });

  it('drops a broken prop’s shadow, and rebuilds only when the props change', () => {
    const both = propLayer.propShadows(
      [barrel('a', 1, 1), barrel('b', 4, 2)],
      undefined,
      LOADED,
      pixels,
    );
    expect(
      propLayer.propShadows([barrel('a', 1, 1), barrel('b', 4, 2)], undefined, LOADED, pixels),
    ).toBe(both);
    const one = propLayer.propShadows([barrel('a', 1, 1)], undefined, LOADED, pixels);
    expect(one).not.toBe(both);
    const gone = seam(4, 2);
    expect(alphaAt(one.layer, gone.x, gone.y)).toBe(0);
    expect(propLayer.propShadows([], undefined, LOADED, pixels).layer).toBeNull();
  });

  it('casts nothing for a prop that asks for none, or one with no drawing', () => {
    const quiet = { ...barrel('a', 1, 1), castShadow: false as const };
    const crate = { ...barrel('b', 4, 2), kind: 'crate' };
    expect(propLayer.propShadows([quiet, crate], undefined, LOADED, pixels).layer).toBeNull();
  });

  it('is stronger on paving, as the prototype lays it', () => {
    const at = seam(1, 1);
    const soft = propLayer.propShadows([barrel('a', 1, 1)], undefined, LOADED, pixels);
    const paved = propLayer.propShadows([barrel('a', 1, 1)], [{ x: 1, y: 1 }], LOADED, pixels);
    expect(alphaAt(paved.layer, at.x, at.y)).toBeGreaterThan(alphaAt(soft.layer, at.x, at.y));
  });
});

/* ------------------------------------------------------------------ */
/* Both backends                                                       */
/* ------------------------------------------------------------------ */

vi.mock('../painters/tiles', () => ({
  paintTerrain: () => undefined,
  paintSurface: () => undefined,
  paintGridLine: () => undefined,
}));
vi.mock('../fx/canvasFx', () => ({ CanvasFxLayer: class {} }));
type SpriteCacheModule = typeof SpriteCache;
vi.mock('../spriteCache', async (original) => ({
  ...(await original<SpriteCacheModule>()),
  sprites: {
    get: () => ({ src: 'oblique-sprite', width: 64, height: 64 }),
    clear: () => undefined,
  },
}));

/**
 * A DOM stand-in for the two canvases the layer makes: the scratch one that reads a drawing's
 * pixels (every pixel opaque) and the layer's own, which reports itself as `prop-shadows` once
 * its pixels are put in.
 */
function fakeDocument(): void {
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { src: 'canvas', width: 0, height: 0 } as Record<string, unknown>;
      const known: Record<string, unknown> = {
        // Only the layer's canvas has computed pixels put into it.
        // (a board-sized layer is the surfaces', not the props' shadow)
        putImageData: (image: { data: Uint8ClampedArray }) =>
          (canvas.src = image.data.length < 360 * 240 * 4 ? 'prop-shadows' : 'board-layer'),
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          data: block(w, h).data,
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

const { Canvas2DBackend } = await import('../backends/canvas2d');
const { PixiBackend } = await import('../backends/pixi');

function view(props: RenderProp[]): MapView {
  return {
    grid: buildGrid(TOPDOWN_FIXTURE),
    units: [],
    overlays: [],
    npcs: [],
    props,
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

function camera(projection: 'topdown' | 'orthographic' | 'oblique'): Camera {
  const out = new Camera({ width: 1000, height: 700, dpr: 1 }, { width: 9, height: 6 }, projection);
  out.integerZoom = projection !== 'orthographic';
  out.fitExplore(projection === 'topdown' ? 120 : 96);
  return out;
}

function withArt(): void {
  fakeDocument();
  vi.spyOn(propLayer.topdownPropImages, 'get').mockImplementation((url) => LOADED.get(url));
}

/** What a whole Canvas 2D frame drew with `drawImage`, by source. */
function canvasFrame(projection: 'topdown' | 'orthographic' | 'oblique', props: RenderProp[]) {
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
  for (const name of [
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
  ])
    vi.spyOn(proto, name).mockImplementation(() => undefined);
  const cam = camera(projection);
  backend.draw(view(props), cam);
  return { drawn, camera: cam };
}

describe('Canvas 2D stands top-down props on their shadow', () => {
  it('draws the shadow layer, then the drawing on its world-px box', () => {
    withArt();
    const { drawn, camera: cam } = canvasFrame('topdown', [barrel('a', 3, 4)]);
    const shadow = drawn.findIndex(({ what }) => what === 'prop-shadows');
    const url = topdownPropUrl(TOPDOWN_PROPS.water_barrel ?? { name: '', w: 0, h: 0, base: 0 });
    const art = drawn.findIndex(({ what }) => what === url);
    expect(shadow).toBeGreaterThanOrEqual(0);
    expect(art).toBeGreaterThan(shadow);
    const box = topdownPropBox(
      { x: 3, y: 4 },
      TOPDOWN_PROPS.water_barrel ?? { name: '', w: 0, h: 0, base: 0 },
    );
    expect(drawn[art]?.args).toEqual([
      box.x * cam.scale - cam.offsetX,
      box.y * cam.scale - cam.offsetY,
      box.w * cam.scale,
      box.h * cam.scale,
    ]);
  });

  it('draws no top-down art or layer on the other boards', () => {
    withArt();
    for (const projection of ['orthographic', 'oblique'] as const) {
      const { drawn } = canvasFrame(projection, [barrel('a', 3, 4)]);
      expect(
        drawn.some(({ what }) => what === 'prop-shadows' || what.startsWith('art/topdown')),
      ).toBe(false);
    }
  });

  it('keeps the old sprite until the drawing has loaded', () => {
    fakeDocument();
    vi.spyOn(propLayer.topdownPropImages, 'get').mockImplementation(() => null);
    const { drawn } = canvasFrame('topdown', [barrel('a', 3, 4)]);
    expect(drawn.some(({ what }) => what.startsWith('art/topdown'))).toBe(false);
    expect(drawn.some(({ what }) => what === 'prop-shadows')).toBe(false);
  });
});

describe('Pixi lays the same layer', () => {
  function pixi() {
    const backend = Object.create(PixiBackend.prototype) as Record<string, unknown>;
    const sprite = new Sprite();
    const texture = new Texture({ source: new TextureSource({ width: 4, height: 4 }) });
    Object.assign(backend, {
      propShadowSprite: sprite,
      texture: () => texture,
    });
    return {
      sprite,
      sync: (v: MapView, cam: Camera) =>
        (backend.syncTopdownPropShadows as (v: MapView, c: Camera) => void).call(backend, v, cam),
    };
  }

  it('places the layer at the world px Canvas 2D draws it', () => {
    withArt();
    const props = [barrel('a', 3, 4)];
    const { layer } = propLayer.propShadows(props, undefined);
    const { sprite, sync } = pixi();
    sync(view(props), camera('topdown'));
    expect(sprite.visible).toBe(true);
    expect([sprite.x, sprite.y, sprite.width, sprite.height]).toEqual([
      layer?.x,
      layer?.y,
      layer?.image.width,
      layer?.image.height,
    ]);
    expect(sprite.texture.source.scaleMode).toBe('nearest');
  });

  it('hides it on the oblique board and once the props are gone', () => {
    withArt();
    const { sprite, sync } = pixi();
    sync(view([barrel('a', 3, 4)]), camera('oblique'));
    expect(sprite.visible).toBe(false);
    sync(view([barrel('a', 3, 4)]), camera('topdown'));
    expect(sprite.visible).toBe(true);
    sync(view([]), camera('topdown'));
    expect(sprite.visible).toBe(false);
  });
});
