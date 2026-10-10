import { describe, expect, it, vi } from 'vitest';
import { Canvas2DBackend, uprightSpriteVisible } from './canvas2d';
import { sheets } from '../sheets/store';
import { sprites } from '../spriteCache';
import {
  CAST_SHADOW_ALPHA,
  DEFAULT_ACTOR_GROUNDING,
  FALLEN_SHADOW_ALPHA,
  type ActorGrounding,
} from '../lighting';

describe('Canvas unit cast shadow', () => {
  // Drives the private mask pass on a stub context: only globalAlpha at each draw matters.
  const drawnAlphas = (
    unit: Record<string, unknown>,
    sheeted = true,
    grounding: ActorGrounding = DEFAULT_ACTOR_GROUNDING,
  ): number[] => drawn(unit, sheeted, grounding).alphas;

  const drawn = (
    unit: Record<string, unknown>,
    sheeted = true,
    grounding: ActorGrounding = DEFAULT_ACTOR_GROUNDING,
  ): { alphas: number[]; levels: number[] } => {
    const alphas: number[] = [];
    const levels: number[] = [];
    const ctx = {
      globalAlpha: 1,
      save: vi.fn(),
      restore: vi.fn(),
      transform: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(() => alphas.push(ctx.globalAlpha)),
    };
    const camera = {
      projection: 'flat',
      viewport: { dpr: 1 },
      spriteBox: () => ({ x: 0, y: 0, size: 64 }),
    };
    const view = {
      grid: { width: 1, height: 1, tiles: [] },
      npcs: [],
      props: [],
      scene: null,
      time: 0,
      units: [{ id: 'u', pos: { x: 0, y: 0 }, size: 1, sprite: 'x', ...unit }],
    };
    const frame = {
      source: {},
      frame: { x: 0, y: 0, w: 8, h: 8 },
      anchor: { x: 0.5, y: 1 },
      pixelsPerTile: 8,
    };
    const spy = vi.spyOn(sheets, 'frame').mockReturnValue(sheeted ? (frame as never) : null);
    const spriteSpy = vi.spyOn(sprites, 'get').mockReturnValue({} as never);
    try {
      const self = {
        squareFootprints: false,
        grounding,
        drawPropShadowMask: () => undefined,
        projectMask: (Canvas2DBackend.prototype as unknown as Record<string, unknown>).projectMask,
        projectContactMask: (Canvas2DBackend.prototype as unknown as Record<string, unknown>)
          .projectContactMask,
        // No scratch: the caster draws straight through, and the level it asked for is recorded.
        castInto: (_layer: unknown, level: number, _b: unknown, draw: (t: unknown) => void) => {
          levels.push(level);
          draw(ctx);
        },
      };
      const draw = (
        Canvas2DBackend.prototype as unknown as {
          drawLiveShadowMask(this: unknown, ...args: unknown[]): void;
        }
      ).drawLiveShadowMask;
      draw.call(self, ctx, view, camera);
    } finally {
      spy.mockRestore();
      spriteSpy.mockRestore();
    }
    return { alphas, levels };
  };

  it('scales the shadow by the unit alpha during a fade, as the Pixi backend does', () => {
    expect(drawnAlphas({})).toEqual([1]);
    expect(drawnAlphas({ alpha: 0.5 })[0]).toBeCloseTo(0.5);
    expect(drawnAlphas({ alpha: 0.5, fallen: true })[0]).toBeCloseTo(0.5 * FALLEN_SHADOW_ALPHA);
  });

  it('applies the same fade when the unit has no sheet frame and falls back to the sprite', () => {
    expect(drawnAlphas({}, false)).toEqual([1]);
    expect(drawnAlphas({ alpha: 0.5 }, false)[0]).toBeCloseTo(0.5);
  });

  it('writes the cast and the contact band at their own strengths', () => {
    const out = drawn({}, true, { cast: 0.5, contact: 0.8 });
    expect(out.levels).toEqual([0.5, 0.8]);
    expect(out.alphas).toEqual([1, 1]);
  });

  it('draws no contact band, and the default level, for a scene that sets nothing', () => {
    const out = drawn({}, true, DEFAULT_ACTOR_GROUNDING);
    expect(out.alphas).toEqual([1]);
    expect(out.levels).toEqual([CAST_SHADOW_ALPHA]);
  });

  it('still gives a painter-fallback unit its band in a contact scene', () => {
    const out = drawn({}, false, { cast: 0.5, contact: 0.8 });
    expect(out.levels).toEqual([0.5, 0.8]);
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
