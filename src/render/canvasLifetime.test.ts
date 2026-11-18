/**
 * Who gives a canvas back (#525, ADR 0112).
 *
 * A canvas that is dropped keeps its backing store until the collector reaches it, and iPadOS
 * counts it until then. So each owner sizes its canvases to nothing when it lets go of them. These
 * tests hold every owner to that under a fake document that counts the pixels still held; the
 * browser soak (`e2e/long-session.soak.ts`) measures the same thing on the real page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../content/assets/manifest', () => ({
  resolveAsset: () => ({ kind: 'painter', painter: 'test' }),
}));
vi.mock('./painters/registry', () => ({ resolvePainter: () => ({ draw: () => undefined }) }));

import { Canvas2DBackend } from './backends/canvas2d';
import { Texture, type WebGLRenderer } from 'pixi.js';
import { PixiBackend, releaseRenderer } from './backends/pixi';
import { releaseCanvas, releaseCanvasSoon } from './canvasRelease';
import { DecorSheets } from './decorSheets';
import { StrokeRasterer } from './fx/pixelStrokes';
import { RevealLayer } from './reveal';
import { readPagePixels } from './sheets/pagePixels';
import { MAX_SPRITE_BYTES, MAX_SPRITE_PX, SpriteCache } from './spriteCache';

interface FakeCanvas {
  width: number;
  height: number;
  getContext(kind?: string): unknown;
}

let made: FakeCanvas[] = [];
let lostContexts = 0;

/** Every pixel the page still holds, as the tablet counts it. */
const heldPixels = (): number =>
  made.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);

function fakeContext(): unknown {
  const known: Record<string, unknown> = {
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context' ? { loseContext: () => (lostContexts += 1) } : null,
    getParameter: () => 'Apple GPU',
  };
  return new Proxy(known, {
    get: (target, key: string) => (key in target ? target[key] : () => undefined),
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  });
}

beforeEach(() => {
  made = [];
  lostContexts = 0;
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas: FakeCanvas = { width: 300, height: 150, getContext: () => fakeContext() };
      made.push(canvas);
      return canvas;
    },
  });
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        readonly data: Uint8ClampedArray,
        readonly width: number,
        readonly height: number,
      ) {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('releaseCanvas', () => {
  it('sizes the canvas to nothing, which is what frees its store', () => {
    const canvas = { width: 2388, height: 1668 };
    releaseCanvas(canvas);
    expect(canvas).toEqual({ width: 0, height: 0 });
    expect(() => releaseCanvas(null)).not.toThrow();
  });

  it('waits for the frame in hand to finish when asked to release soon', async () => {
    const canvas = { width: 256, height: 256 };
    releaseCanvasSoon(canvas);
    // Still whole for the rest of this task: a sprite handed out this frame is yet to be drawn.
    expect(canvas.width).toBe(256);
    await Promise.resolve();
    expect(canvas).toEqual({ width: 0, height: 0 });
  });
});

describe('the sprite cache', () => {
  it('never holds more than its cap in pixels, however many sizes a pinch walks through', async () => {
    const cache = new SpriteCache();
    const cap = 128 * MAX_SPRITE_PX * MAX_SPRITE_PX;
    for (let n = 0; n < 1000; n++) {
      cache.get(`unit.${n}`, MAX_SPRITE_PX);
      await Promise.resolve();
      expect(heldPixels()).toBeLessThanOrEqual(cap);
    }
    expect(cache.size).toBe(128);
    expect(made).toHaveLength(1000);
    // The 872 evicted sprites gave their stores back; they did not wait for the collector.
    expect(made.filter((canvas) => canvas.width === 0)).toHaveLength(872);
  });

  it('holds the same bytes when every sprite is a four-tile boss', async () => {
    const cache = new SpriteCache();
    for (let n = 0; n < 300; n++) {
      cache.get(`unit.boss${n}`, MAX_SPRITE_PX, {}, 2, 2);
      await Promise.resolve();
      expect(heldPixels() * 4).toBeLessThanOrEqual(MAX_SPRITE_BYTES);
    }
    // 128 of these by count alone were 128 MB; the budget keeps 32 of them.
    expect(cache.size).toBe(32);
  });

  it('gives every sprite back when it is cleared (each scene unmount and resize)', () => {
    const cache = new SpriteCache();
    for (let n = 0; n < 40; n++) cache.get(`unit.${n}`, 96);
    expect(heldPixels()).toBe(40 * 96 * 96);
    cache.clear();
    expect(heldPixels()).toBe(0);
    expect(cache.size).toBe(0);
  });
});

describe('the Canvas 2D backend', () => {
  type Harness = {
    canvas: FakeCanvas;
    destroy(): void;
    sizeShadowCanvases(width: number, height: number): { layer: FakeCanvas; scratch: FakeCanvas };
    flashMask(source: unknown, x: number, y: number, w: number, h: number): FakeCanvas | null;
  };

  function backend(): Harness {
    const harness = Object.create(Canvas2DBackend.prototype) as Harness;
    Object.assign(harness, {
      canvas: { width: 2388, height: 1668, getContext: fakeContext },
      pixelMarkDrawables: { clear: () => undefined },
      fx: { destroy: () => undefined },
      reveal: null,
      shadowLayer: null,
      castScratch: null,
      flashScratch: null,
    });
    made.push(harness.canvas);
    return harness;
  }

  it('keeps one pair of shadow canvases as a pan flips the grid a texel wider and back', () => {
    const harness = backend();
    const first = harness.sizeShadowCanvases(597, 417);
    const createdForTheFirst = made.length;
    for (let frame = 0; frame < 200; frame++) {
      const sized = harness.sizeShadowCanvases(597 + (frame % 2), 417 + ((frame >> 1) % 2));
      expect(sized.layer).toBe(first.layer);
      expect(sized.scratch).toBe(first.scratch);
    }
    // A new pair per flip was 400 canvases here, each left for the collector.
    expect(made).toHaveLength(createdForTheFirst);
  });

  it('draws every hit flash through one scratch canvas, never a copy of the sheet per sheet', () => {
    const harness = backend();
    const before = made.length;
    const driller = { width: 2048, height: 1948 };
    const bandit = { width: 1024, height: 512 };
    for (let frame = 0; frame < 30; frame++) {
      expect(harness.flashMask(driller, 512, 256, 256, 244)).not.toBeNull();
      expect(harness.flashMask(bandit, 96, 0, 96, 96)).not.toBeNull();
    }
    expect(made).toHaveLength(before + 1);
    const scratch = made[made.length - 1];
    // As large as the largest frame flashed (from a new canvas's 300x150), not the 4 megapixel
    // page that frame was cut from.
    expect([scratch?.width, scratch?.height]).toEqual([300, 244]);
  });

  it('gives everything back when the scene leaves, the map canvas included', () => {
    const harness = backend();
    harness.sizeShadowCanvases(597, 417);
    harness.flashMask({ width: 512, height: 512 }, 0, 0, 128, 128);
    expect(heldPixels()).toBeGreaterThan(2388 * 1668);
    harness.destroy();
    expect(heldPixels()).toBe(0);
  });
});

describe('the WebGL backend', () => {
  it('asks the browser whether WebGL is accelerated once a page, and loses the context it asked with', () => {
    Reflect.set(PixiBackend, 'supported', null);
    expect(PixiBackend.isSupported()).toBe(true);
    for (let mount = 0; mount < 50; mount++) PixiBackend.isSupported();
    // One probe, not one a scene: WebKit keeps sixteen contexts and loses the oldest beyond that.
    expect(made).toHaveLength(1);
    expect(lostContexts).toBe(1);
    expect(heldPixels()).toBe(0);
    Reflect.set(PixiBackend, 'supported', null);
  });
});

describe('a destroyed WebGL renderer', () => {
  it('takes with it what Pixi would keep: the filter bind group, the shared pools, its hashes', () => {
    const bindGroup = { destroy: vi.fn() };
    const backBufferShader = { destroy: vi.fn() };
    const destroy = vi.fn();
    const unloaded: string[] = [];
    const onEmpty = (): void => void unloaded.push('empty');
    const onWhite = (): void => void unloaded.push('white');
    Texture.EMPTY.source.once('unload', onEmpty);
    Texture.WHITE.source.once('unload', onWhite);
    releaseRenderer({
      filter: { _globalFilterBindGroup: bindGroup },
      backBuffer: { _bigTriangleShader: backBufferShader },
      destroy,
    } as unknown as WebGLRenderer);
    // Left alive, the bind group stays subscribed to pooled textures and keeps its uniforms: a
    // uniform group and six Float32Arrays per scene mount, measured.
    expect(bindGroup.destroy).toHaveBeenCalledOnce();
    expect(backBufferShader.destroy).toHaveBeenCalledOnce();
    // Each renderer's hashes wait on the unload of the two textures every renderer shares.
    expect(unloaded.sort()).toEqual(['empty', 'white']);
    expect(destroy).toHaveBeenCalledWith({ removeView: false, releaseGlobalResources: true });
  });

  it('survives a Pixi whose internals have moved', () => {
    const destroy = vi.fn();
    expect(() => releaseRenderer({ destroy } as unknown as WebGLRenderer)).not.toThrow();
    expect(destroy).toHaveBeenCalledOnce();
  });
});

describe('scratch and pooled canvases', () => {
  it('reads a sheet page through a canvas it gives straight back', () => {
    const page = readPagePixels({} as CanvasImageSource, 2048, 1948);
    expect(page?.data.length).toBe(2048 * 1948 * 4);
    expect(heldPixels()).toBe(0);
  });

  it('gives the stroke pool back with its owner', () => {
    const rasterer = new StrokeRasterer();
    const stroke = { points: [0, 0, 2, 1], width: 0.2, alpha: 1, closed: false, fill: false };
    for (let slot = 0; slot < 6; slot++) rasterer.raster(slot, [stroke], '#ffffff', null);
    expect(heldPixels()).toBeGreaterThan(0);
    rasterer.release();
    expect(heldPixels()).toBe(0);
  });

  it('gives the reveal layer back with its owner', () => {
    const layer = new RevealLayer();
    expect(heldPixels()).toBeGreaterThan(0);
    layer.release();
    expect(heldPixels()).toBe(0);
  });

  it('gives decor chunks back when they are evicted or the board changes', async () => {
    const sheets = new DecorSheets();
    Reflect.set(sheets, 'bake', () => undefined);
    const grid = { width: 64, height: 64, tiles: [] } as never;
    for (let n = 0; n < 40; n++) sheets.get(grid, n, 0, 128);
    await Promise.resolve();
    expect(made.filter((canvas) => canvas.width > 0)).toHaveLength(16);
    sheets.clear();
    await Promise.resolve();
    expect(heldPixels()).toBe(0);
  });
});
