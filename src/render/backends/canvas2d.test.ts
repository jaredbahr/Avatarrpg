import { afterEach, describe, expect, it, vi } from 'vitest';
import { Canvas2DBackend, uprightSpriteVisible } from './canvas2d';
import { sheets } from '../sheets/store';
import { TILE } from '../camera';
import { figureShadowArt } from '../figureShadowArt';
import { FOOT_LINE } from '../sheets/bake';
import {
  CAST_SHADOW_ALPHA,
  DEFAULT_ACTOR_GROUNDING,
  DEFAULT_CONTACT_ALPHA,
  FALLEN_SHADOW_ALPHA,
  type ActorGrounding,
} from '../lighting';

const BA: ActorGrounding = {
  cast: 0.335,
  contact: 0.535,
  castKey: { x: 0.35, y: 0.16 },
  ink: { r: 0, g: 3, b: 11 },
};

/** A canvas the figure shadow art can be painted into: the unit environment has none. */
const fakeCanvas = () => ({
  width: 0,
  height: 0,
  getContext: () => ({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => undefined,
  }),
});

describe('Canvas figure ground shadow (ADR 0093, figure amendment)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // Drives the private mask pass on a stub context: what is drawn, at which level and alpha.
  const drawn = (
    unit: Record<string, unknown>,
    grounding: ActorGrounding = DEFAULT_ACTOR_GROUNDING,
  ): { alphas: number[]; levels: number[]; rects: number[][]; frames: number } => {
    vi.stubGlobal('document', { createElement: fakeCanvas });
    const alphas: number[] = [];
    const levels: number[] = [];
    const rects: number[][] = [];
    const ctx = {
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn((_s: unknown, ...r: number[]) => {
        alphas.push(ctx.globalAlpha);
        rects.push(r);
      }),
    };
    const camera = {
      projection: 'oblique',
      scale: 2,
      viewport: { dpr: 1 },
      spriteBox: () => ({ x: 0, y: 0, size: 128 }),
    };
    const view = {
      grid: { width: 1, height: 1, tiles: [] },
      npcs: [],
      props: [],
      scene: null,
      time: 0,
      units: [{ id: 'u', pos: { x: 0, y: 0 }, size: 1, sprite: 'x', ...unit }],
    };
    const frame = vi.spyOn(sheets, 'frame');
    const self = {
      squareFootprints: false,
      grounding,
      drawPropShadowMask: () => undefined,
      projectFigureShadow: (Canvas2DBackend.prototype as unknown as Record<string, unknown>)
        .projectFigureShadow,
      // No scratch: the caster draws straight through, and the level it asked for is recorded.
      castInto: (_layer: unknown, level: number, _b: unknown, draw: (t: unknown) => void) => {
        levels.push(level);
        draw(ctx);
      },
    };
    (
      Canvas2DBackend.prototype as unknown as {
        drawLiveShadowMask(this: unknown, ...args: unknown[]): void;
      }
    ).drawLiveShadowMask.call(self, ctx, view, camera);
    return { alphas, levels, rects, frames: frame.mock.calls.length };
  };

  it('writes the pool at the cast level and the core at the contact level', () => {
    expect(drawn({}, BA).levels).toEqual([BA.cast, BA.contact]);
    expect(drawn({}).levels).toEqual([CAST_SHADOW_ALPHA, DEFAULT_CONTACT_ALPHA]);
  });

  it('scales both by the unit alpha during a fade, as the Pixi backend does', () => {
    expect(drawn({}).alphas).toEqual([1, 1]);
    for (const alpha of drawn({ alpha: 0.5 }).alphas) expect(alpha).toBeCloseTo(0.5);
    for (const alpha of drawn({ alpha: 0.5, fallen: true }).alphas)
      expect(alpha).toBeCloseTo(0.5 * FALLEN_SHADOW_ALPHA);
  });

  it('reads no frame: the shadow is the same whatever the clip, cel or bend', () => {
    const still = drawn({ clip: 'idle' }, BA);
    for (const unit of [
      { clip: 'walkSouthEast', clipTime: 333 },
      { clip: 'hit', clipTime: 120 },
      { bend: { heading: 'south', index: 2 } },
    ]) {
      const moving = drawn(unit, BA);
      expect(moving.frames).toBe(0);
      expect(moving.rects).toEqual(still.rects);
    }
  });

  it('lays one canvas pixel on one world pixel, the foot on the ground point', () => {
    const { rects } = drawn({}, BA);
    const art = figureShadowArt(TILE, BA.castKey);
    expect(art).not.toBeNull();
    // spriteBox puts the tile at 0,0 with 128 CSS px a tile (scale 2): the foot is at (64, FOOT_LINE * 128).
    expect(rects[0]).toEqual([
      64 - (art?.footX ?? 0) * 2,
      FOOT_LINE * 128 - (art?.footY ?? 0) * 2,
      (art?.cast.width ?? 0) * 2,
      (art?.cast.height ?? 0) * 2,
    ]);
  });

  it('draws nothing for a figure that casts nothing', () => {
    expect(drawn({ castShadow: false }).levels).toEqual([]);
  });
});

describe('upright Canvas culling', () => {
  const viewport = { width: 800, height: 600 };
  it('keeps a scaled NPC head visible while its entire ground tile is below the viewport', () => {
    expect(uprightSpriteVisible({ x: 300, y: 620, size: 64 }, viewport, 1, 1.5)).toBe(true);
    expect(uprightSpriteVisible({ x: 300, y: 1000, size: 64 }, viewport, 1, 1.5)).toBe(false);
  });
  it('keeps a two-cell marker at the left edge when its first cell is offscreen', () => {
    expect(uprightSpriteVisible({ x: -130, y: 100, size: 64 }, viewport, 2, 1.5)).toBe(true);
    expect(uprightSpriteVisible({ x: -400, y: 100, size: 64 }, viewport, 2, 1.5)).toBe(false);
  });
  it('culls above and right only once the full conservative bounds leave the view', () => {
    expect(uprightSpriteVisible({ x: 900, y: 100, size: 64 }, viewport, 1, 1.25)).toBe(false);
    expect(uprightSpriteVisible({ x: 300, y: -100, size: 64 }, viewport, 1, 1.25)).toBe(false);
  });
});
