import { afterEach, describe, expect, it, vi } from 'vitest';
import * as sceneArt from '../scene';
import { Canvas2DBackend } from './canvas2d';
import { BA_DAN_ACTOR_GROUNDING } from '../../content/scenes/baDan';
import {
  DEFAULT_ACTOR_GROUNDING,
  DEFAULT_SHADOW_INK,
  SHADOW_COLOR,
  contactBand,
  shadowGrid,
} from '../lighting';
import type { ActorGrounding } from '../lighting';

/*
 * A pixel model of the Canvas 2D compositing the shadow union uses, written from
 * the spec's formulas (Porter-Duff plus the separable blend functions) with the
 * 8-bit rounding a real canvas has. The unit environment has no canvas, so this
 * is what lets the union's arithmetic be checked at all; the browser run in the
 * grounding review reads the same numbers off the real thing.
 */
type Op =
  | 'source-over'
  | 'source-in'
  | 'destination-over'
  | 'multiply'
  | 'lighten'
  | 'difference'
  | 'lighter';
type Rgba = [number, number, number, number];

class FakeCanvas {
  /** Premultiplied RGBA, 0..255. */
  readonly px: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.px = new Uint8ClampedArray(width * height * 4);
  }
  getContext(): FakeContext {
    return new FakeContext(this);
  }
  at(x: number, y: number): number[] {
    const i = (y * this.width + x) * 4;
    return [...this.px.slice(i, i + 4)];
  }
}

function parseColour(style: string): [number, number, number] {
  if (style.startsWith('#')) {
    const n = Number.parseInt(style.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(style);
  if (!m) throw new Error(`colour ${style}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

class FakeContext {
  globalAlpha = 1;
  imageSmoothingEnabled = true;
  globalCompositeOperation: Op = 'source-over';
  fillStyle = '#000000';
  private clipRect: [number, number, number, number] | null = null;
  private path: [number, number, number, number] | null = null;
  private stack: [number, Op, string, [number, number, number, number] | null][] = [];
  constructor(private canvas: FakeCanvas) {}
  save(): void {
    this.stack.push([
      this.globalAlpha,
      this.globalCompositeOperation,
      this.fillStyle,
      this.clipRect,
    ]);
  }
  restore(): void {
    const s = this.stack.pop();
    if (s) [this.globalAlpha, this.globalCompositeOperation, this.fillStyle, this.clipRect] = s;
  }
  /** The union is run at one texel per screen pixel here, so its transforms are all the identity. */
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    if (a !== 1 || b !== 0 || c !== 0 || d !== 1 || e !== 0 || f !== 0)
      throw new Error('this model draws at identity only');
  }
  beginPath(): void {
    this.path = null;
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.path = [x, y, x + w, y + h];
  }
  clip(): void {
    this.clipRect = this.path;
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    this.each(x, y, w, h, () => [0, 0, 0, 0], true);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const [r, g, b] = parseColour(this.fillStyle);
    this.each(x, y, w, h, () => [r, g, b, 255]);
  }
  /** The two shapes the union uses: the whole canvas at 0,0, and a 1:1 sub-rect copy. */
  drawImage(src: FakeCanvas, ...a: number[]): void {
    const [sx = 0, sy = 0, w = src.width, h = src.height, dx = 0, dy = 0] =
      a.length === 8 ? a : [0, 0, src.width, src.height, a[0], a[1]];
    this.each(dx, dy, w, h, (x, y) => {
      const i = ((y - dy + sy) * src.width + (x - dx + sx)) * 4;
      const al = src.px[i + 3] ?? 0;
      // Un-premultiply: the blend functions work on straight colour.
      const c = [0, 1, 2].map((k) =>
        al === 0 ? 0 : Math.min(255, ((src.px[i + k] ?? 0) * 255) / al),
      );
      return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, al];
    });
  }
  private each(
    x: number,
    y: number,
    w: number,
    h: number,
    source: (x: number, y: number) => number[],
    erase = false,
  ): void {
    const c = this.clipRect;
    const x0 = Math.max(0, x, c?.[0] ?? 0);
    const y0 = Math.max(0, y, c?.[1] ?? 0);
    const x1 = Math.min(this.canvas.width, x + w, c?.[2] ?? Infinity);
    const y1 = Math.min(this.canvas.height, y + h, c?.[3] ?? Infinity);
    for (let py = y0; py < y1; py++)
      for (let px = x0; px < x1; px++) {
        const i = (py * this.canvas.width + px) * 4;
        if (erase) {
          this.canvas.px.set([0, 0, 0, 0], i);
          continue;
        }
        this.canvas.px.set(this.composite(source(px, py), i), i);
      }
  }
  private composite(s: number[], i: number): Rgba {
    const as = ((s[3] ?? 0) / 255) * this.globalAlpha;
    const ab = (this.canvas.px[i + 3] ?? 0) / 255;
    const cs = [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0];
    const pb = [0, 1, 2].map((k) => this.canvas.px[i + k] ?? 0);
    const op = this.globalCompositeOperation;
    let out: number[];
    let ar: number;
    if (op === 'source-over') {
      ar = as + ab * (1 - as);
      out = cs.map((v, k) => v * as + (pb[k] ?? 0) * (1 - as));
    } else if (op === 'destination-over') {
      ar = ab + as * (1 - ab);
      out = cs.map((v, k) => (pb[k] ?? 0) + v * as * (1 - ab));
    } else if (op === 'source-in') {
      ar = as * ab;
      out = cs.map((v) => v * ar);
    } else if (op === 'lighter') {
      ar = Math.min(1, as + ab);
      out = cs.map((v, k) => v * as + (pb[k] ?? 0));
    } else {
      const blend = (k: number): number => {
        const b = ab > 0 ? (pb[k] ?? 0) / 255 / ab : 0;
        const v = (cs[k] ?? 0) / 255;
        return (
          255 * (op === 'multiply' ? b * v : op === 'lighten' ? Math.max(b, v) : Math.abs(b - v))
        );
      };
      ar = as + ab - as * ab;
      out = cs.map((v, k) => (1 - as) * (pb[k] ?? 0) + (1 - ab) * as * v + as * ab * blend(k));
    }
    const px = out.map((v) => Math.round(Math.min(255, v)));
    return [px[0] ?? 0, px[1] ?? 0, px[2] ?? 0, Math.round(ar * 255)];
  }
}

const INK = parseColour(SHADOW_COLOR);
const LIT = [200, 180, 150];

describe('Canvas shadow union in a scene with its own grounding', () => {
  const W = 40;
  const H = 12;
  const proto = Canvas2DBackend.prototype as unknown as Record<
    string,
    (...a: unknown[]) => unknown
  >;

  /** Casters are boxes of strength `level`, drawn in a colour the union must ignore. */
  const run = (
    grounding: ActorGrounding,
    casters: { level: number; x: number; w: number; alpha?: number }[],
    background?: (canvas: FakeCanvas) => void,
  ): ((x: number) => number[]) => {
    const layerCanvas = new FakeCanvas(W, H);
    const main = new FakeCanvas(W, H);
    const mainCtx = main.getContext();
    mainCtx.fillStyle = `rgb(${LIT.join(', ')})`;
    mainCtx.fillRect(0, 0, W, H);
    background?.(main);
    const self = {
      grounding,
      shadowLayer: layerCanvas,
      castScratch: new FakeCanvas(W, H),
      ctx: mainCtx,
      // One texel per pixel: the union's arithmetic is what is under test, not the grid.
      shadowGridNow: shadowGrid({ width: W, height: H }, 1, 0, 0),
      castInto: proto.castInto,
      toShadowTexels: proto.toShadowTexels,
      drawShadowTexels: proto.drawShadowTexels,
      compositeExactShadow: proto.compositeExactShadow,
      clipShadowGround: () => undefined,
    };
    const layer = layerCanvas.getContext();
    layer.fillStyle = '#000000';
    layer.fillRect(0, 0, W, H);
    for (const c of casters)
      proto.castInto?.call(
        self,
        layer,
        c.level,
        { x0: c.x, y0: 0, x1: c.x + c.w, y1: H },
        (t: FakeContext) => {
          t.save();
          t.globalAlpha = c.alpha ?? 1;
          t.fillStyle = '#c80a0a';
          t.fillRect(c.x, 0, c.w, H);
          t.restore();
        },
      );
    proto.compositeExactShadow?.call(self, layer, {}, {}, W, H);
    return (x) => main.at(x, 5);
  };

  /** What a tint of strength g over the lit ground comes to. */
  const shaded = (g: number): number[] =>
    [0, 1, 2].map((k) => Math.round((LIT[k] ?? 0) * (1 - g) + (INK[k] ?? 0) * g));
  const near = (got: number[], want: number[]): void =>
    want.forEach((v, k) => expect(Math.abs((got[k] ?? 0) - v)).toBeLessThanOrEqual(1));

  const ba: ActorGrounding = {
    cast: 0.5,
    contact: 0.8,
    castKey: { x: 0.35, y: 0.16 },
    ink: DEFAULT_SHADOW_INK,
  };

  it('leaves an overlap of two equal casters at their strength, not darker', () => {
    const at = run(ba, [
      { level: 0.5, x: 4, w: 20 },
      { level: 0.5, x: 16, w: 20 },
    ]);
    near(at(8), shaded(0.5));
    near(at(20), shaded(0.5)); // inside both
    near(at(30), shaded(0.5));
    near(at(1), LIT); // untouched ground stays lit
    // Source-over would have made the overlap 0.75.
    expect(Math.abs((at(20)[0] ?? 0) - shaded(0.75)[0]!)).toBeGreaterThan(8);
  });

  it('leaves an overlap of a stronger and a weaker caster at the stronger, in either order', () => {
    for (const [first, second] of [
      [0.5, 0.8],
      [0.8, 0.5],
    ] as const) {
      const at = run(ba, [
        { level: first, x: 4, w: 20 },
        { level: second, x: 16, w: 20 },
      ]);
      near(at(8), shaded(first));
      near(at(20), shaded(0.8));
      near(at(30), shaded(second));
    }
  });

  it('scales a caster by its own alpha, so a faded figure is lighter than the level', () => {
    near(run(ba, [{ level: 0.8, x: 4, w: 10, alpha: 0.5 }])(8), shaded(0.4));
  });

  it('takes the maximum for a faded caster over a full one as well', () => {
    const at = run(ba, [
      { level: 0.8, x: 4, w: 20, alpha: 0.5 },
      { level: 0.5, x: 16, w: 20 },
    ]);
    near(at(20), shaded(0.5));
  });

  it("lands Ba Dan's figure shadows on the painting's own shadow tone", () => {
    // objects.py multiplies the ground by SHADOW (0.70) under a cast and CONTACT (0.50) under the
    // contact line, cooled by COOL; on the mean ground its shadows fall on, the runtime ink must agree.
    const ground = [118, 110, 73];
    const cool = [0.93, 0.96, 1.06];
    const grounding = { ...DEFAULT_ACTOR_GROUNDING, ...BA_DAN_ACTOR_GROUNDING };
    const bg = (canvas: FakeCanvas) => {
      const c = canvas.getContext();
      c.fillStyle = `rgb(${ground.join(', ')})`;
      c.fillRect(0, 0, W, H);
    };
    const at = run(
      grounding,
      [
        { level: grounding.cast, x: 4, w: 10 },
        { level: grounding.contact, x: 20, w: 10 },
      ],
      bg,
    );
    const painted = (m: number) => ground.map((v, k) => Math.round(v * m * (cool[k] ?? 1)));
    for (const [x, m] of [
      [8, 0.7],
      [24, 0.5],
    ] as const)
      painted(m).forEach((v, k) => expect(Math.abs((at(x)[k] ?? 0) - v)).toBeLessThanOrEqual(3));
  });
});

describe("what a figure's feet get", () => {
  const contact: ActorGrounding = {
    cast: 0.5,
    contact: 0.8,
    castKey: { x: 0.35, y: 0.16 },
    ink: DEFAULT_SHADOW_INK,
  };
  // The kinds of figure the backends tell apart; each gets the same ground shadow.
  const kinds = {
    'sheet frame': { sprite: 'unit.fire.tenzo', unit: false },
    'painter resident': { sprite: 'npc.hanru', unit: false },
    'single-image resident': { sprite: 'world.tea_station', unit: false },
    'G-sheet resident': { sprite: 'npc.shopkeeper', unit: false },
    'painter-fallback unit': { sprite: 'unit.fire.tenzo', unit: true },
  } as const;

  /** Drives the Canvas live mask for one figure and returns the ground shadows it asked for. */
  const shadowsFor = (grounding: ActorGrounding, kind: keyof typeof kinds): unknown[][] => {
    const k = kinds[kind];
    const shadows: unknown[][] = [];
    const self = {
      squareFootprints: false,
      grounding,
      npcWidth: () => 1,
      drawPropShadowMask: () => undefined,
      projectFigureShadow: (...a: unknown[]) => shadows.push(a),
    };
    const camera = {
      projection: 'flat',
      scale: 1,
      viewport: { dpr: 1 },
      spriteBox: () => ({ x: 0, y: 0, size: 64 }),
    };
    const view = {
      grid: { width: 1, height: 1, tiles: [] },
      props: [],
      scene: null,
      time: 0,
      npcs: k.unit ? [] : [{ id: 'n', pos: { x: 0, y: 0 }, sprite: k.sprite }],
      units: k.unit ? [{ id: 'u', pos: { x: 0, y: 0 }, size: 1, sprite: k.sprite }] : [],
    };
    (
      Canvas2DBackend.prototype as unknown as {
        drawLiveShadowMask(this: unknown, ...a: unknown[]): void;
      }
    ).drawLiveShadowMask.call(self, {}, view, camera);
    return shadows;
  };

  for (const kind of Object.keys(kinds) as (keyof typeof kinds)[]) {
    it(`gives a ${kind} exactly one ground shadow in a contact scene`, () => {
      expect(shadowsFor(contact, kind)).toHaveLength(1);
    });

    it(`gives a ${kind} its ground shadow in a scene that sets nothing (ADR 0093)`, () => {
      expect(shadowsFor(DEFAULT_ACTOR_GROUNDING, kind)).toHaveLength(1);
    });
  }

  it('gives a figure that casts nothing no contact', () => {
    expect(contactBand(contact, 0)).toBe(false);
  });
});

describe('cached static scenery shadow union', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const W = 40;
  const H = 12;
  const proto = Canvas2DBackend.prototype as unknown as {
    drawCachedSceneryShadowMask(this: unknown, ...args: unknown[]): void;
  };

  function fixture() {
    const image = {
      src: 'tree.webp',
      currentSrc: 'tree.webp',
      naturalWidth: 16,
      naturalHeight: 16,
    };
    const images = vi.spyOn(sceneArt, 'sceneImage').mockReturnValue(image as never);
    vi.stubGlobal('document', { createElement: () => new FakeCanvas(W, H) });
    const camera = {
      projection: 'oblique',
      grid: { width: 4, height: 3 },
      viewport: { width: W, height: H, dpr: 1 },
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    };
    const grid = { width: W, height: H, texel: 1, originX: 0, originY: 0 };
    const view = {
      scene: {
        scenery: [
          {
            url: 'tree.webp',
            x: 8,
            y: 2,
            width: 8,
            height: 6,
            castShadow: 0.5,
            flip: false,
            footprint: [{ x: 1, y: 1 }],
          },
        ],
        actorGrounding: { contact: 0.8 },
      },
    };
    const paint = vi.fn((context: FakeContext) => {
      for (const piece of view.scene.scenery) {
        if (!sceneArt.sceneImage(piece as never)) continue;
        const grey = Math.round(piece.castShadow * 255);
        context.fillStyle = 'rgb(' + grey + ', ' + grey + ', ' + grey + ')';
        context.fillRect(
          piece.x * camera.scale - camera.offsetX,
          piece.y * camera.scale - camera.offsetY,
          piece.width * camera.scale,
          piece.height * camera.scale,
        );
      }
    });
    const self = {
      sceneryShadow: null,
      castScratch: new FakeCanvas(W, H),
      // This pixel model covers mask storage/composition at identity. Real
      // transformed pixels are also compared in the browser before publication.
      toShadowTexels: () => undefined,
      drawSceneryShadowMask: paint,
    };
    function frame(cached: boolean, actorX?: number) {
      const canvas = new FakeCanvas(W, H);
      const context = canvas.getContext();
      context.fillStyle = '#000000';
      context.fillRect(0, 0, W, H);
      context.fillStyle = 'rgb(64, 64, 64)';
      context.fillRect(0, 0, 10, H);
      context.globalCompositeOperation = 'lighten';
      if (cached) proto.drawCachedSceneryShadowMask.call(self, context, view, camera, grid);
      else paint(context);
      if (actorX !== undefined) {
        context.fillStyle = 'rgb(200, 200, 200)';
        context.fillRect(actorX, 3, 6, 4);
      }
      return canvas.px;
    }
    return { camera, grid, view, image, images, paint, self, frame };
  }

  it('reuses the static mask with byte-identical maximum overlap and moving live shadows', () => {
    const f = fixture();
    const first = f.frame(true, 12);
    expect(f.paint).toHaveBeenCalledTimes(1);
    expect(f.frame(true, 12)).toEqual(first);
    expect(f.paint).toHaveBeenCalledTimes(1);
    expect(first).toEqual(f.frame(false, 12));
    f.paint.mockClear();
    const moved = f.frame(true, 24);
    expect(f.paint).not.toHaveBeenCalled();
    expect(moved).not.toEqual(first);
    expect(moved).toEqual(f.frame(false, 24));
  });

  const changes: [string, (f: ReturnType<typeof fixture>) => void][] = [
    [
      'mask width',
      (f) => {
        f.grid.width -= 1;
      },
    ],
    [
      'mask height',
      (f) => {
        f.grid.height -= 1;
      },
    ],
    [
      'pan x',
      (f) => {
        f.camera.offsetX = 3;
      },
    ],
    [
      'pan y',
      (f) => {
        f.camera.offsetY = 1;
      },
    ],
    [
      'zoom',
      (f) => {
        f.camera.scale = 2;
      },
    ],
    [
      'viewport width',
      (f) => {
        f.camera.viewport.width -= 1;
      },
    ],
    [
      'viewport height',
      (f) => {
        f.camera.viewport.height -= 1;
      },
    ],
    [
      'DPR',
      (f) => {
        f.camera.viewport.dpr = 2;
      },
    ],
    [
      'grid dimensions',
      (f) => {
        f.camera.grid.width += 1;
      },
    ],
    [
      'mask origin',
      (f) => {
        f.grid.originX = -0.5;
      },
    ],
    [
      'mask texel scale',
      (f) => {
        f.grid.texel = 0.5;
      },
    ],
    [
      'source URL',
      (f) => {
        f.view.scene.scenery[0]!.url = 'other.webp';
      },
    ],
    [
      'in-place geometry',
      (f) => {
        f.view.scene.scenery[0]!.x += 2;
      },
    ],
    [
      'cast strength',
      (f) => {
        f.view.scene.scenery[0]!.castShadow = 0.25;
      },
    ],
    [
      'flip',
      (f) => {
        f.view.scene.scenery[0]!.flip = true;
      },
    ],
    [
      'footprint',
      (f) => {
        f.view.scene.scenery[0]!.footprint[0]!.x += 1;
      },
    ],
    [
      'contact grounding',
      (f) => {
        f.view.scene.actorGrounding.contact = 0.4;
      },
    ],
    [
      'source dimensions',
      (f) => {
        f.image.naturalWidth += 1;
      },
    ],
    [
      'source current URL',
      (f) => {
        f.image.currentSrc = 'reloaded.webp';
      },
    ],
    [
      'source identity',
      (f) => {
        f.images.mockReturnValue({ ...f.image } as never);
      },
    ],
  ];

  for (const [name, change] of changes) {
    it('invalidates on ' + name + ' and agrees with the fresh mask', () => {
      const f = fixture();
      f.frame(true);
      change(f);
      const cached = f.frame(true);
      expect(f.paint).toHaveBeenCalledTimes(2);
      expect(cached).toEqual(f.frame(false));
    });
  }

  it('does not retain an incomplete mask after late art arrives, or old art after eviction', () => {
    const f = fixture();
    f.images.mockReturnValue(null);
    const missing = f.frame(true);
    f.images.mockReturnValue(f.image as never);
    const arrived = f.frame(true);
    expect(arrived).not.toEqual(missing);
    expect(f.paint).toHaveBeenCalledTimes(2);
    expect(arrived).toEqual(f.frame(false));
    f.images.mockReturnValue(null);
    expect(f.frame(true)).toEqual(missing);
  });

  it('invalidates when the grid-filtered scene loses a caster', () => {
    const f = fixture();
    const before = f.frame(true);
    f.view.scene.scenery = [];
    const after = f.frame(true);
    expect(after).not.toEqual(before);
    expect(after).toEqual(f.frame(false));
  });

  it('falls back to the uncached painter if the cache canvas has no 2D context', () => {
    const f = fixture();
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
    expect(f.frame(true)).toEqual(f.frame(false));
    expect(f.self.sceneryShadow).toBeNull();
  });

  it('drops the cached mask while the exact-max scratch context is unavailable and rebuilds on recovery', () => {
    const f = fixture();
    const first = f.frame(true);
    const scratch = vi.spyOn(f.self.castScratch, 'getContext').mockReturnValue(null as never);
    f.frame(true);
    expect(f.self.sceneryShadow).toBeNull();
    expect(f.paint).toHaveBeenCalledTimes(2);
    scratch.mockRestore();
    expect(f.frame(true)).toEqual(first);
    expect(f.paint).toHaveBeenCalledTimes(3);
    expect(f.frame(true)).toEqual(f.frame(false));
  });
});
