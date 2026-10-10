import { describe, expect, it, vi } from 'vitest';
import { Canvas2DBackend } from './canvas2d';
import { sheets } from '../sheets/store';
import { sprites } from '../spriteCache';
import { DEFAULT_ACTOR_GROUNDING, SHADOW_COLOR, groundTreatment } from '../lighting';
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
  ): ((x: number) => number[]) => {
    const layerCanvas = new FakeCanvas(W, H);
    const main = new FakeCanvas(W, H);
    const mainCtx = main.getContext();
    mainCtx.fillStyle = `rgb(${LIT.join(', ')})`;
    mainCtx.fillRect(0, 0, W, H);
    const self = {
      grounding,
      shadowLayer: layerCanvas,
      castScratch: new FakeCanvas(W, H),
      ctx: mainCtx,
      exactMax: proto.exactMax,
      castInto: proto.castInto,
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

  const ba: ActorGrounding = { cast: 0.5, contact: 0.8 };

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
});

describe("what a figure's feet get", () => {
  const contact: ActorGrounding = { cast: 0.5, contact: 0.8 };
  const frame = {
    source: {},
    frame: { x: 0, y: 0, w: 64, h: 96 },
    anchor: { x: 0.5, y: 0.85 },
    pixelsPerTile: 64,
  };
  // The kinds the backends tell apart: what each draws as its radial pool in a default scene.
  const kinds = {
    'sheet frame': { sprite: 'unit.fire.tenzo', frame: true, unit: false, pool: false },
    'painter resident': { sprite: 'npc.guard', frame: true, unit: false, pool: false },
    'single-image resident': { sprite: 'npc.shopkeeper', frame: false, unit: false, pool: true },
    'painter-fallback unit': { sprite: 'unit.fire.tenzo', frame: false, unit: true, pool: true },
  } as const;

  /** Drives the Canvas live mask for one figure and returns the band art it asked for. */
  const bandsFor = (grounding: ActorGrounding, kind: keyof typeof kinds): unknown[][] => {
    const k = kinds[kind];
    const bands: unknown[][] = [];
    const sheetsSpy = vi.spyOn(sheets, 'frame').mockReturnValue(k.frame ? (frame as never) : null);
    const spriteSpy = vi.spyOn(sprites, 'get').mockReturnValue({ width: 64, height: 64 } as never);
    try {
      const self = {
        squareFootprints: false,
        grounding,
        npcWidth: () => 1,
        drawPropShadowMask: () => undefined,
        projectMask: () => undefined,
        projectContactMask: (...a: unknown[]) => bands.push(a),
      };
      const camera = {
        projection: 'flat',
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
    } finally {
      sheetsSpy.mockRestore();
      spriteSpy.mockRestore();
    }
    return bands;
  };

  for (const kind of Object.keys(kinds) as (keyof typeof kinds)[]) {
    it(`gives a ${kind} exactly one of band or pool in a contact scene`, () => {
      const bands = bandsFor(contact, kind).length;
      const { pool } = groundTreatment(contact, { castStrength: 1, defaultPool: kinds[kind].pool });
      expect(bands).toBe(1);
      expect(pool).toBe(false);
    });

    it(`leaves a ${kind} with its old treatment in a default scene`, () => {
      expect(bandsFor(DEFAULT_ACTOR_GROUNDING, kind)).toHaveLength(0);
      const { pool } = groundTreatment(DEFAULT_ACTOR_GROUNDING, {
        castStrength: 1,
        defaultPool: kinds[kind].pool,
      });
      expect(pool).toBe(kinds[kind].pool);
    });
  }

  it("cuts a frameless figure's band from the sprite that is drawn, not from a baked stand-in", () => {
    const [args] = bandsFor(contact, 'painter resident');
    expect((args?.[1] as { source: unknown }).source).toEqual({ width: 64, height: 64 });
  });

  it('keeps a pool for a figure that casts nothing, even in a contact scene', () => {
    expect(groundTreatment(contact, { castStrength: 0, defaultPool: true })).toEqual({
      band: false,
      pool: true,
    });
  });
});
