/**
 * Canvas 2D and WebGL draw a bend effect in the same place (ADR 0055, step 5).
 *
 * Runs Canvas 2D's real draw (`drawBendFx`) against a context that records
 * its transform, and the WebGL side's real sync (`syncBendFx`) into Pixi
 * sprites inside a container set up as the backend's camera-scaled layer,
 * then compares the four screen corners of every cel, its source rectangle,
 * opacity and blend, over zooms, pans, turns, stretches and both projections.
 */

import { Container, Rectangle, Sprite, Texture, TextureSource } from 'pixi.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Camera } from '../camera';
import type { BendFxSprite } from '../view';
import { bendFxPages, bendFxSource, drawBendFx } from './bendFxDraw';
import { syncBendFx } from './bendFxPixi';

type Pt = { x: number; y: number };
type M = [number, number, number, number, number, number];

/** A stand-in `Image` that loads on the next tick. */
class LoadingImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  set src(_url: string) {
    setTimeout(() => this.onload?.(), 0);
  }
}

/** A stand-in cel canvas for the flash: only its identity matters here. */
const fakeCanvas = () => ({
  width: 0,
  height: 0,
  getContext: () => ({
    drawImage: () => undefined,
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: () => undefined,
  }),
});

beforeAll(async () => {
  vi.stubGlobal('Image', LoadingImage);
  vi.stubGlobal('document', { createElement: fakeCanvas });
  await bendFxPages.whenLoaded(PAGE);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

const PAGE = 'art/fx/bend-fx.webp';

const mul = (a: M, b: M): M => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const apply = (m: M, p: Pt): Pt => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});

interface Drawn {
  corners: Pt[];
  source: unknown;
  rect: number[];
  alpha: number;
  blend: string;
}

/** What Canvas 2D draws: a context that records the transform at each `drawImage`. */
function canvasDraws(sprites: readonly BendFxSprite[], camera: Camera): Drawn[] {
  const draws: Drawn[] = [];
  let state = { m: [1, 0, 0, 1, 0, 0] as M, alpha: 1, blend: 'source-over' };
  const stack: (typeof state)[] = [];
  const ctx = {
    save: () => stack.push({ ...state }),
    restore: () => {
      state = stack.pop() ?? state;
    },
    translate: (x: number, y: number) => {
      state.m = mul(state.m, [1, 0, 0, 1, x, y]);
    },
    scale: (x: number, y: number) => {
      state.m = mul(state.m, [x, 0, 0, y, 0, 0]);
    },
    rotate: (r: number) => {
      state.m = mul(state.m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
    },
    set globalAlpha(value: number) {
      state.alpha = value;
    },
    set globalCompositeOperation(value: string) {
      state.blend = value;
    },
    drawImage: (...a: [unknown, ...number[]]) => {
      const [image, sx, sy, sw, sh, dx, dy, dw, dh] = a as [unknown, ...number[]] as [
        unknown,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      draws.push({
        corners: [
          { x: dx, y: dy },
          { x: dx + dw, y: dy },
          { x: dx + dw, y: dy + dh },
          { x: dx, y: dy + dh },
        ].map((p) => apply(state.m, p)),
        source: image,
        rect: [sx, sy, sw, sh],
        alpha: state.alpha,
        blend: state.blend === 'lighter' ? 'add' : 'normal',
      });
    },
  } as unknown as CanvasRenderingContext2D;
  drawBendFx(ctx, sprites, camera, false);
  drawBendFx(ctx, sprites, camera, true);
  return draws;
}

/** What WebGL draws: the backend's sync into its layers under the camera-scaled container. */
function pixiDraws(sprites: readonly BendFxSprite[], camera: Camera): Drawn[] {
  const upright = new Container();
  upright.position.set(-camera.offsetX, -camera.offsetY);
  upright.scale.set(camera.scale);
  const under = upright.addChild(new Container());
  const over = upright.addChild(new Container());
  const sources = new Map<unknown, TextureSource>();
  const texture = (sprite: BendFxSprite) => {
    const source = bendFxSource(sprite);
    if (!source) return null;
    let base = sources.get(source.image);
    if (!base) {
      base = new TextureSource({ width: 4096, height: 4096 });
      sources.set(source.image, base);
    }
    const f = source.frame;
    return Object.assign(new Texture({ source: base, frame: new Rectangle(f.x, f.y, f.w, f.h) }), {
      image: source.image,
    });
  };
  syncBendFx(
    under,
    sprites.filter((s) => s.z !== 'overActor'),
    camera,
    texture,
  );
  syncBendFx(
    over,
    sprites.filter((s) => s.z === 'overActor'),
    camera,
    texture,
  );
  return [...under.children, ...over.children]
    .filter((child): child is Sprite => child instanceof Sprite && child.visible)
    .map((sprite) => {
      const { width: w, height: h } = sprite.texture.orig;
      const local = [
        { x: -sprite.anchor.x * w, y: -sprite.anchor.y * h },
        { x: (1 - sprite.anchor.x) * w, y: -sprite.anchor.y * h },
        { x: (1 - sprite.anchor.x) * w, y: (1 - sprite.anchor.y) * h },
        { x: -sprite.anchor.x * w, y: (1 - sprite.anchor.y) * h },
      ];
      const f = sprite.texture.frame;
      return {
        corners: local.map((p) => sprite.toGlobal(p)),
        source: (sprite.texture as Texture & { image: unknown }).image,
        rect: [f.x, f.y, f.width, f.height],
        alpha: sprite.alpha,
        blend: sprite.blendMode === 'add' ? 'add' : 'normal',
      };
    });
}

const sprite = (overrides: Partial<BendFxSprite>): BendFxSprite => ({
  image: PAGE,
  frame: { x: 41, y: 0, w: 53, h: 44 },
  pivot: { x: 26.5, y: 22 },
  at: { x: 1.5, y: 2.25 },
  width: 53 / 128,
  height: 44 / 128,
  turn: 0,
  alpha: 1,
  blend: 'normal',
  flash: 0,
  z: 'overActor',
  ...overrides,
});

/** Ground, under-actor and over-actor cels, turned, stretched, flashed and added. */
const SPRITES: readonly BendFxSprite[] = [
  sprite({
    z: 'ground',
    frame: { x: 396, y: 0, w: 100, h: 64 },
    pivot: { x: 50, y: 32 },
    width: 100 / 128,
    height: 64 / 128,
  }),
  sprite({ z: 'underActor', turn: -5.43, flash: 0.75, at: { x: 0.3, y: 1.1 } }),
  sprite({ turn: 26.565, at: { x: 2.2, y: 2.9 } }),
  sprite({
    frame: { x: 171, y: 85, w: 105, h: 35 },
    pivot: { x: 52.5, y: 17.5 },
    width: 1.63,
    turn: 153.4,
  }),
  sprite({ pivot: { x: 96, y: 24 }, turn: -90, alpha: 0.6, blend: 'add' }),
  // Thrown to the left: mirrored top to bottom about an off-centre pivot, then turned.
  sprite({ pivot: { x: 96, y: 18 }, turn: 191.3, flipY: true, at: { x: 0.8, y: 2.6 } }),
];

const cameras = (): Camera[] => {
  const oblique = new Camera(
    { width: 1368, height: 700, dpr: 1 },
    { width: 12, height: 10 },
    'oblique',
  );
  oblique.fit();
  const zoomed = new Camera(
    { width: 1024, height: 768, dpr: 2 },
    { width: 12, height: 10 },
    'oblique',
  );
  zoomed.fit();
  zoomed.zoomAt({ x: 300, y: 500 }, 2.3);
  zoomed.panBy(-120, 45);
  const square = new Camera({ width: 800, height: 600, dpr: 1 }, { width: 8, height: 8 });
  square.fit();
  return [oblique, zoomed, square];
};

describe('bend effects on Canvas 2D and WebGL', () => {
  it('draw every cel over the same screen quad, from the same pixels, the same way', () => {
    for (const camera of cameras()) {
      const canvas = canvasDraws(SPRITES, camera);
      const pixi = pixiDraws(SPRITES, camera);
      expect(canvas.map((d) => d.rect)).toEqual(pixi.map((d) => d.rect));
      expect(canvas.length).toBe(SPRITES.length);
      canvas.forEach((draw, index) => {
        const other = pixi[index]!;
        expect(draw.source).toBe(other.source);
        expect(draw.alpha).toBeCloseTo(other.alpha, 12);
        expect(draw.blend).toBe(other.blend);
        draw.corners.forEach((corner, k) => {
          expect(corner.x).toBeCloseTo(other.corners[k]!.x, 6);
          expect(corner.y).toBeCloseTo(other.corners[k]!.y, 6);
        });
      });
    }
  });

  it('draws the ground and under-actor cels before the actors and the rest after', () => {
    const [camera] = cameras();
    const order = canvasDraws(SPRITES, camera!).map((d) => d.rect[0]);
    expect(order).toEqual([396, 41, 41, 171, 41, 41].map((x, i) => (i === 1 ? 0 : x)));
  });

  it('mirrors a flipped cel top to bottom about its pivot, on both backends', () => {
    for (const camera of cameras()) {
      const flipped = SPRITES[5]!;
      const plain = { ...flipped, flipY: false };
      for (const draws of [canvasDraws, pixiDraws]) {
        const [a] = draws([flipped], camera);
        const [b] = draws([plain], camera);
        // Pivot fixed; the cel's top edge lands where the plain cel's bottom edge
        // would be mirrored through the pivot's horizontal line (in cel space).
        const pivot = (c: Pt[]) => {
          const [p0, p1, , p3] = c as [Pt, Pt, Pt, Pt];
          const u = 96 / 53;
          const v = 18 / 44;
          return {
            x: p0.x + (p1.x - p0.x) * u + (p3.x - p0.x) * v,
            y: p0.y + (p1.y - p0.y) * u + (p3.y - p0.y) * v,
          };
        };
        expect(pivot(a!.corners).x).toBeCloseTo(pivot(b!.corners).x, 6);
        expect(pivot(a!.corners).y).toBeCloseTo(pivot(b!.corners).y, 6);
        // Same across (top-left to top-right), opposite down (top-left to bottom-left).
        const across = (c: Pt[]) => ({ x: c[1]!.x - c[0]!.x, y: c[1]!.y - c[0]!.y });
        const down = (c: Pt[]) => ({ x: c[3]!.x - c[0]!.x, y: c[3]!.y - c[0]!.y });
        expect(across(a!.corners).x).toBeCloseTo(across(b!.corners).x, 6);
        expect(across(a!.corners).y).toBeCloseTo(across(b!.corners).y, 6);
        expect(down(a!.corners).x).toBeCloseTo(-down(b!.corners).x, 6);
        expect(down(a!.corners).y).toBeCloseTo(-down(b!.corners).y, 6);
      }
    }
  });

  it('lands the pivot on the board point, the quad the cel size at the zoom, never mirrored', () => {
    for (const camera of cameras()) {
      const [ground] = canvasDraws([SPRITES[0]!], camera);
      const tile = 64 * camera.scale;
      const at = camera.boardPoint(SPRITES[0]!.at);
      const [a, b, , d] = ground!.corners;
      expect(a!.x + 50 * (tile / 128)).toBeCloseTo(at.x * camera.scale - camera.offsetX, 6);
      expect(a!.y + 32 * (tile / 128)).toBeCloseTo(at.y * camera.scale - camera.offsetY, 6);
      expect(b!.x - a!.x).toBeCloseTo((100 / 128) * tile, 6);
      expect(d!.y - a!.y).toBeCloseTo((64 / 128) * tile, 6);
    }
  });

  it('draws a flashed cel from its own brightened copy, never the page', () => {
    const [camera] = cameras();
    const [, flashed] = canvasDraws(SPRITES, camera!);
    expect(flashed!.rect).toEqual([0, 0, 53, 44]);
    expect(flashed!.source).not.toBe(canvasDraws(SPRITES, camera!)[0]!.source);
  });
});
