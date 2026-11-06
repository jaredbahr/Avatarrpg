import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  alphaOf,
  closeHoles,
  crownShadowMask,
  feetBlob,
  floorReaction,
  groundKit,
  hardShadowMask,
  paintMask,
  type CrownShadowOptions,
  type HardShadowOptions,
  type RgbaImage,
  type ShadowMask,
} from './hardShadowMask';

/*
 * The port is held to the prototype's own source: `shadow.js` is read from
 * disk and run, with a small fake canvas for the parts that drew on one, then
 * both are fed the same shapes and compared byte for byte.
 *
 * The fake canvas stores premultiplied bytes like a real one. Its source-over
 * blend was measured against Chromium (see `fillRect` in the port), so tests
 * that go through `fillRect` (groundKit) prove the port's logic and its
 * arithmetic model, and are exact against that model, not against a live
 * browser canvas, where a translucent dot over another translucent dot can
 * differ by 1 in a channel.
 */

interface FakeCtx {
  fillStyle: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
  putImageData(id: { data: Uint8ClampedArray }, x: number, y: number): void;
  createImageData(w: number, h: number): { data: Uint8ClampedArray };
  drawImage(img: { width: number; height: number; data: Uint8ClampedArray }): void;
}

interface FakeCanvas {
  width: number;
  height: number;
  /** Premultiplied bytes, like a real canvas. */
  p: Uint8ClampedArray;
  getContext(): FakeCtx;
}

function parseStyle(s: string): [number, number, number, number] {
  if (s.startsWith('#')) {
    return [
      parseInt(s.slice(1, 3), 16),
      parseInt(s.slice(3, 5), 16),
      parseInt(s.slice(5, 7), 16),
      1,
    ];
  }
  const m = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(s);
  if (!m) throw new Error(`style ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}

function makeCanvas(): FakeCanvas {
  const cv: FakeCanvas = {
    width: 0,
    height: 0,
    p: new Uint8ClampedArray(0),
    getContext() {
      if (cv.p.length !== cv.width * cv.height * 4)
        cv.p = new Uint8ClampedArray(cv.width * cv.height * 4);
      const ctx: FakeCtx = {
        fillStyle: '#000000',
        fillRect(x, y, w, h) {
          const [r, g, b, a] = parseStyle(ctx.fillStyle);
          const sa8 = Math.round(a * 255),
            sa = sa8 / 255;
          for (let yy = Math.max(0, y); yy < Math.min(cv.height, y + h); yy++)
            for (let xx = Math.max(0, x); xx < Math.min(cv.width, x + w); xx++) {
              const j = (yy * cv.width + xx) * 4;
              const d = cv.p;
              d[j] = r * sa + (d[j] ?? 0) * (1 - sa);
              d[j + 1] = g * sa + (d[j + 1] ?? 0) * (1 - sa);
              d[j + 2] = b * sa + (d[j + 2] ?? 0) * (1 - sa);
              d[j + 3] = sa8 + (d[j + 3] ?? 0) * (1 - sa);
            }
        },
        getImageData(x, y, w, h) {
          const data = new Uint8ClampedArray(w * h * 4);
          for (let yy = 0; yy < h; yy++)
            for (let xx = 0; xx < w; xx++) {
              const sx = x + xx,
                sy = y + yy;
              if (sx < 0 || sy < 0 || sx >= cv.width || sy >= cv.height) continue;
              const s = (sy * cv.width + sx) * 4,
                j = (yy * w + xx) * 4,
                a = cv.p[s + 3] ?? 0;
              if (!a) continue;
              for (let k = 0; k < 3; k++) data[j + k] = ((cv.p[s + k] ?? 0) * 255) / a;
              data[j + 3] = a;
            }
          return { data };
        },
        putImageData() {
          throw new Error('replaced by patchSizes');
        },
        createImageData(w, h) {
          const data = new Uint8ClampedArray(w * h * 4);
          return Object.assign({ data }, { w, h }) as { data: Uint8ClampedArray };
        },
        drawImage(img) {
          cv.p.set(img.data);
        },
      };
      return ctx;
    },
  };
  return cv;
}

/** getImageData results remember their size so putImageData can place them. */
function patchSizes(cv: FakeCanvas): FakeCanvas {
  const orig = cv.getContext.bind(cv);
  cv.getContext = () => {
    const ctx = orig();
    const get = ctx.getImageData.bind(ctx);
    ctx.getImageData = (x, y, w, h) => Object.assign(get(x, y, w, h), { w, h });
    ctx.putImageData = (id, x, y) => {
      const { w, h } = id as unknown as { w: number; h: number };
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
          const dx = x + xx,
            dy = y + yy;
          if (dx < 0 || dy < 0 || dx >= cv.width || dy >= cv.height) continue;
          const j = (yy * w + xx) * 4,
            s = (dy * cv.width + dx) * 4,
            a = id.data[j + 3] ?? 0;
          for (let k = 0; k < 3; k++) cv.p[s + k] = ((id.data[j + k] ?? 0) * a) / 255;
          cv.p[s + 3] = a;
        }
    };
    return ctx;
  };
  return cv;
}

interface Original {
  hardShadowMask(
    a: ArrayLike<number>,
    w: number,
    h: number,
    o?: Record<string, unknown>,
  ): ShadowMask;
  crownShadowMask(
    a: ArrayLike<number>,
    w: number,
    h: number,
    o: Record<string, unknown>,
  ): ShadowMask;
  closeHoles(A: Uint8ClampedArray, w: number, h: number, v: number): void;
  alphaOf(img: unknown): Uint8ClampedArray;
  paintMask(g: FakeCtx, m: ShadowMask, dx: number, dy: number, scale?: number): void;
  floorReaction(g: FakeCtx, m: ShadowMask, dx: number, dy: number, seed: number): void;
  groundKit(
    img: unknown,
    seed: number,
    o?: Record<string, unknown>,
  ): { contact: FakeCanvas; fringe: FakeCanvas; m: number } | null;
  feetBlob(w: number, alpha?: number): FakeCanvas;
}

const SOURCE = readFileSync(
  new URL('../../../prototypes/topdown/src/v13/shadow.js', import.meta.url),
  'utf8',
);

function loadOriginal(areaMode?: string): Original {
  const sandbox = {
    window: areaMode ? { AREA: { mode: areaMode } } : {},
    document: { createElement: () => patchSizes(makeCanvas()) },
    Map,
    Math,
    Number,
    Uint8ClampedArray,
    Int32Array,
    Float32Array,
    Uint8Array,
    Array,
    Object,
  };
  return runInNewContext(
    `${SOURCE}\n({ hardShadowMask, crownShadowMask, closeHoles, alphaOf, paintMask, floorReaction, groundKit, feetBlob })`,
    sandbox,
  ) as Original;
}

/** An opaque test image shaped by a predicate; transparent elsewhere. */
function shape(w: number, h: number, inside: (x: number, y: number) => boolean): RgbaImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (inside(x, y)) {
        const j = (y * w + x) * 4;
        data[j] = 90 + ((x * 7) % 60);
        data[j + 1] = 70 + ((y * 5) % 50);
        data[j + 2] = 60;
        data[j + 3] = 255;
      }
  return { width: w, height: h, data };
}

const SHAPES: Record<string, RgbaImage> = {
  box: shape(24, 30, (x, y) => x >= 4 && x < 20 && y >= 6 && y < 28),
  L: shape(
    26,
    32,
    (x, y) => (x >= 3 && x < 10 && y >= 2 && y < 30) || (x >= 3 && x < 23 && y >= 22 && y < 30),
  ),
  disc: shape(30, 30, (x, y) => (x - 15) ** 2 + (y - 15) ** 2 <= 100),
  touchingEdges: shape(20, 20, () => true),
  empty: shape(12, 12, () => false),
  singlePixel: shape(9, 9, (x, y) => x === 4 && y === 6),
  // two stands at different heights plus a floating bar: a group of things on one image
  group: shape(
    40,
    44,
    (x, y) =>
      (x >= 2 && x < 10 && y >= 20 && y < 42) ||
      (x >= 14 && x < 30 && y >= 10 && y < 36) ||
      (x >= 32 && x < 38 && y >= 4 && y < 8),
  ),
  // a thin pole and a handle: lone specks the cleanup pass should drop
  thin: shape(16, 40, (x, y) => (x === 5 && y >= 4 && y < 38) || (x >= 9 && x < 12 && y === 20)),
};

const HARD_OPTIONS: Record<string, HardShadowOptions> = {
  default: {},
  flat: { flat: true, band: 4 },
  bandAndReach: { band: 5, reach: 17, foot: 9 },
  overhang: { overhang: 3 },
  overhangWide: { overhang: 20 },
  baseGiven: { base: 20 },
  groundedOnly: { groundedOnly: true },
  dir: { dir: { x: 0.8, y: 0.35 } },
  dirLeft: { dir: { x: -0.6, y: 0.4 } },
  dirReach: { dir: { x: 1, y: 0.5 }, reach: 14 },
  dirSweep: { dir: { x: 0.9, y: 0.4 }, sweep: 0.6 },
  dirUnder: { dir: { x: 0.7, y: 0.3 }, under: true, overhang: 4 },
  hitch: { hitch: 6 },
  dusk: { dusk: true },
};

function expectSameMask(port: ShadowMask, orig: ShadowMask): void {
  expect(port.width).toBe(orig.width);
  expect(port.height).toBe(orig.height);
  expect(port.pad).toBe(orig.pad);
  expect(port.base).toBe(orig.base);
  expect(port.reach).toBe(orig.reach);
  expect(port.color).toBe(orig.color);
  expect(Array.from(port.alpha)).toEqual(Array.from(orig.alpha));
}

/** The original takes `dusk` from `window.AREA`, so a dusk case loads it in the home area. */
function originalFor(o: HardShadowOptions): Original {
  return loadOriginal(o.dusk ? 'home' : undefined);
}
function stripDusk(o: HardShadowOptions): Record<string, unknown> {
  const { dusk, ...rest } = o;
  void dusk;
  return rest;
}

describe('hardShadowMask is byte-equal to the prototype', () => {
  for (const [shapeName, img] of Object.entries(SHAPES)) {
    for (const [optName, opts] of Object.entries(HARD_OPTIONS)) {
      it(`${shapeName} with ${optName}`, () => {
        const orig = originalFor(opts);
        const a = alphaOf(img);
        const expected = orig.hardShadowMask(a, img.width, img.height, stripDusk(opts));
        const got = hardShadowMask(a, img.width, img.height, opts);
        expectSameMask(got, expected);
      });
    }
  }

  it('an empty mask yields an empty shadow with base -1', () => {
    const img = SHAPES['empty']!;
    const m = hardShadowMask(alphaOf(img), img.width, img.height);
    expect(m.base).toBe(-1);
    expect(m.alpha.every((v) => v === 0)).toBe(true);
  });

  it('a plain box has the seam, the contact band and a cast, and accepts a plain Uint8Array', () => {
    const img = SHAPES['box']!;
    const a = Uint8Array.from(alphaOf(img));
    const m = hardShadowMask(a, img.width, img.height);
    expect(new Set(m.alpha)).toEqual(new Set([0, 175, 150, 140, 125]));
  });
});

describe('crownShadowMask is byte-equal to the prototype', () => {
  const tree = shape(
    40,
    60,
    (x, y) =>
      (y < 30 && (x - 20) ** 2 + (y - 16) ** 2 <= 190) || (x >= 17 && x < 23 && y >= 30 && y < 56),
  );
  const cases: Record<string, CrownShadowOptions> = {
    basic: { dir: { x: 0.9, y: 0.45 }, crownBottom: 30, ground: 55 },
    reach: { dir: { x: 1, y: 0.5 }, crownBottom: 30, ground: 55, reach: 30, lead: 6, overhang: 4 },
    left: { dir: { x: -0.5, y: 0.5 }, crownBottom: 28, ground: 55 },
  };
  for (const [name, o] of Object.entries(cases)) {
    it(name, () => {
      const a = alphaOf(tree);
      expectSameMask(
        crownShadowMask(a, tree.width, tree.height, o),
        loadOriginal().crownShadowMask(
          a,
          tree.width,
          tree.height,
          o as unknown as Record<string, unknown>,
        ),
      );
    });
  }
});

describe('closeHoles is byte-equal to the prototype', () => {
  it('fills single-pixel holes and leaves the border alone', () => {
    const W = 11,
      H = 9;
    const base = new Uint8ClampedArray(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) if ((x * 5 + y * 3) % 4 !== 0) base[y * W + x] = 125;
    const a = base.slice(),
      b = base.slice();
    closeHoles(a, W, H, 99);
    loadOriginal().closeHoles(b, W, H, 99);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a).not.toEqual(base);
  });
});

describe('alphaOf is byte-equal to the prototype', () => {
  it('thresholds the alpha channel at 128', () => {
    const img = shape(6, 3, (x) => x > 1);
    for (let i = 0; i < 18; i++) img.data[i * 4 + 3] = [0, 127, 128, 200, 255, 1][i % 6] ?? 0;
    expect(Array.from(alphaOf(img))).toEqual(Array.from(loadOriginal().alphaOf(img)));
  });
});

/** A canvas-like pair: the original paints on a fake canvas, the port on an RGBA image. */
function backdrop(w: number, h: number): { cv: FakeCanvas; img: RgbaImage } {
  const img: RgbaImage = { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  for (let i = 0; i < w * h; i++) {
    const v = (i * 37) % 200;
    img.data[i * 4] = 40 + (v % 90);
    img.data[i * 4 + 1] = 30 + ((v * 3) % 120);
    img.data[i * 4 + 2] = 20 + ((v * 7) % 100);
    img.data[i * 4 + 3] = 255;
  }
  const cv = patchSizes(makeCanvas());
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext();
  ctx.drawImage(img);
  return { cv, img };
}

function canvasPixels(cv: FakeCanvas): number[] {
  return Array.from(cv.getContext().getImageData(0, 0, cv.width, cv.height).data);
}

describe('paintMask and floorReaction are byte-equal to the prototype (opaque floor)', () => {
  const orig = loadOriginal();
  for (const [shapeName, img] of Object.entries(SHAPES)) {
    for (const scale of [1, 1.3, 1.45]) {
      it(`paintMask ${shapeName} at scale ${scale}, partly off the canvas`, () => {
        const m = orig.hardShadowMask(alphaOf(img), img.width, img.height, {});
        const { cv, img: target } = backdrop(40, 40);
        orig.paintMask(cv.getContext(), m, -3, 5, scale);
        paintMask(target, m, -3, 5, scale);
        expect(Array.from(target.data)).toEqual(canvasPixels(cv));
      });
    }
    it(`floorReaction ${shapeName}, dark and light paving`, () => {
      const m = orig.hardShadowMask(alphaOf(img), img.width, img.height, {});
      for (const level of [20, 200]) {
        const { cv, img: target } = backdrop(40, 50);
        for (let i = 0; i < 40 * 50; i++) {
          const j = i * 4;
          target.data[j] = target.data[j + 1] = target.data[j + 2] = level + (i % 5);
        }
        const ctx = cv.getContext();
        ctx.drawImage(target);
        orig.floorReaction(ctx, m, 4, 2, 4242);
        floorReaction(target, m, 4, 2, 4242);
        expect(Array.from(target.data)).toEqual(canvasPixels(cv));
      }
    });
  }
});

describe('feetBlob matches the prototype (within 1 per channel: a real canvas stores premultiplied bytes)', () => {
  for (const [w, a] of [
    [10, undefined],
    [40, 153],
    [64, 228],
  ] as const) {
    it(`width ${w}`, () => {
      const orig = loadOriginal().feetBlob(w, a);
      const got = feetBlob(w, a);
      expect(got.width).toBe(orig.width);
      expect(got.height).toBe(orig.height);
      const want = orig.getContext().getImageData(0, 0, orig.width, orig.height).data;
      expect(got.data.length).toBe(want.length);
      for (let i = 0; i < want.length; i++)
        expect(Math.abs((got.data[i] ?? 0) - (want[i] ?? 0))).toBeLessThanOrEqual(1);
    });
  }
});

describe('groundKit matches the prototype under the measured canvas blend (within 1 per channel)', () => {
  for (const [shapeName, img] of Object.entries(SHAPES)) {
    for (const [optName, opts] of Object.entries({
      plain: {},
      tall: { tall: 7, density: 0.6 },
      zone: { zone: 12 },
    })) {
      it(`${shapeName} ${optName}`, () => {
        const orig = loadOriginal();
        const expected = orig.groundKit(img, 1234, opts);
        const got = groundKit(img, 1234, opts);
        if (!expected) {
          expect(got).toBeNull();
          return;
        }
        expect(got).not.toBeNull();
        expect(got!.m).toBe(expected.m);
        for (const layer of ['contact', 'fringe'] as const) {
          const cv = expected[layer];
          const want = Array.from(cv.getContext().getImageData(0, 0, cv.width, cv.height).data);
          const have = got![layer];
          expect(have.width).toBe(cv.width);
          expect(have.height).toBe(cv.height);
          expect(have.data.length).toBe(want.length);
          let worst = 0;
          for (let i = 0; i < want.length; i++)
            worst = Math.max(worst, Math.abs((have.data[i] ?? 0) - (want[i] ?? 0)));
          expect(worst).toBeLessThanOrEqual(1);
        }
      });
    }
  }

  it('is deterministic for a seed and varies across seeds', () => {
    const img = SHAPES['box']!;
    const a = groundKit(img, 7)!;
    const b = groundKit(img, 7)!;
    const c = groundKit(img, 8)!;
    expect(Array.from(a.fringe.data)).toEqual(Array.from(b.fringe.data));
    expect(Array.from(a.fringe.data)).not.toEqual(Array.from(c.fringe.data));
  });
});
