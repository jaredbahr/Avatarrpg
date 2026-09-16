import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES } from './abilities';
import {
  ALL_FX,
  FX_AMBIENCE,
  FX_FAMILIES,
  ambienceFx,
  fxPalette,
  fxRecipeSchema,
  particleEmitterSchema,
  resolveFx,
} from './fx';
import { ALL_MAPS } from './index';

/**
 * Effect recipes are content, so they are validated like content: every
 * recipe parses, every budget holds, and every ability's fx key resolves to
 * something that draws.
 */

const PALETTES = ['fire', 'water', 'earth', 'air', 'nonbender', 'enemy', 'neutral'];

describe('effect recipes', () => {
  it('all parse', () => {
    for (const { key, recipe } of ALL_FX) {
      const result = fxRecipeSchema.safeParse(recipe);
      expect(result.success, `${key}: ${result.success ? '' : result.error.message}`).toBe(true);
    }
  });

  it('stay inside the particle budget', () => {
    for (const { key, recipe } of ALL_FX) {
      const parsed = fxRecipeSchema.parse(recipe);
      const emitters = [
        ...parsed.cast,
        ...(parsed.travel?.emitters ?? []),
        ...parsed.impact,
        ...parsed.area,
      ];
      let total = 0;
      for (const emitter of emitters) {
        if (emitter.kind === 'particles') total += emitter.count;
      }
      expect(total, `${key} spawns ${total} particles`).toBeLessThanOrEqual(400);
      // An area emitter plays on every tile of a blast; keep each one light.
      for (const emitter of parsed.area) {
        if (emitter.kind === 'particles') {
          expect(emitter.count, `${key} area emitter`).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it('resolve for every ability, with a palette the renderer knows', () => {
    for (const ability of ALL_ABILITIES) {
      const recipe = resolveFx(ability.fx);
      expect(
        recipe.impact.length,
        `${ability.id} (${ability.fx}) draws nothing on impact`,
      ).toBeGreaterThan(0);
      expect(PALETTES, `${ability.id} palette`).toContain(fxPalette(ability.fx, recipe));
    }
  });

  it('fall back to a family for an unknown key of a known element', () => {
    const recipe = resolveFx('fx.fire.something_new');
    expect(recipe.impact).toEqual(fxRecipeSchema.parse(FX_FAMILIES.fire).impact);
    expect(fxPalette('fx.fire.something_new', recipe)).toBe('fire');
  });

  it('still draw for a key of no known element', () => {
    expect(resolveFx('fx.mystery.thing').impact.length).toBeGreaterThan(0);
  });
});

describe('ambience recipes', () => {
  it('parse, stay light, and know a palette', () => {
    for (const [key, recipe] of Object.entries(FX_AMBIENCE)) {
      expect(PALETTES, `${key} palette`).toContain(recipe.palette);
      let total = 0;
      for (const emitter of recipe.emitters) {
        const result = particleEmitterSchema.safeParse(emitter);
        expect(result.success, `${key}: ${result.success ? '' : result.error.message}`).toBe(true);
        expect(emitter.shape).toBe('drift');
        total += emitter.count;
      }
      // Two loops of every emitter are live at once; keep the air thin.
      expect(total, `${key} spawns ${total} motes`).toBeLessThanOrEqual(40);
    }
  });

  it('resolve for every map, or say the air is still', () => {
    for (const map of ALL_MAPS) {
      const recipe = ambienceFx(map.ambience);
      if (recipe) expect(recipe.emitters.length).toBeGreaterThan(0);
    }
    expect(ambienceFx('a cellar')).toBeNull();
  });
});
