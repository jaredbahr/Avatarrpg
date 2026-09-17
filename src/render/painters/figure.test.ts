import { describe, expect, it } from 'vitest';
import { CLIP_FRAME_COUNTS, CLIP_NAMES } from '../../content/assets/clips';
import { ASSETS } from '../../content/assets/manifest';
import { CHARACTERS } from '../../content/characters';
import { paletteFor } from '../palettes';
import { BAKED_CLIPS } from '../sheets/bake';
import { HEROES, figureFor } from './cast';
import { BUILDS, FOOT, POSES, figureScale, poseFor, solve } from './figure';
import { resolvePainter } from './registry';

/**
 * The placeholder rig is pure geometry until it meets a canvas, so the parts
 * that matter to the sheet contract are checked here: one pose per frame of
 * the clip table, every pose standing on the foot line inside the box, and a
 * figure for every unit the manifest names.
 */

describe('placeholder poses', () => {
  it('has one pose per frame of the clip table', () => {
    for (const clip of CLIP_NAMES) {
      expect(POSES[clip].length, clip).toBe(CLIP_FRAME_COUNTS[clip].min);
      expect(POSES[clip].length, clip).toBe(BAKED_CLIPS[clip].count);
    }
  });

  it('stands every pose on the foot line, inside the box, for every build', () => {
    for (const [name, build] of Object.entries(BUILDS)) {
      for (const clip of CLIP_NAMES) {
        for (const [index, pose] of POSES[clip].entries()) {
          const label = `${name} ${clip}/${index}`;
          const joints = solve(pose, build);
          const legs = [...joints.frontLeg, ...joints.backLeg];
          const lowest = Math.max(...legs.map((joint) => joint[1]));
          expect(lowest, `${label} lowest point`).toBeCloseTo(FOOT - pose.lift, 9);
          for (const joint of [
            joints.hip,
            joints.shoulder,
            joints.head,
            ...joints.frontArm,
            ...joints.backArm,
            ...legs,
          ]) {
            expect(joint[0], `${label} x`).toBeGreaterThan(0.05);
            expect(joint[0], `${label} x`).toBeLessThan(0.95);
            expect(joint[1], `${label} y`).toBeGreaterThan(0);
            expect(joint[1], `${label} y`).toBeLessThanOrEqual(FOOT + 0.001);
          }
          expect(joints.head[1] - build.head, `${label} head top`).toBeGreaterThan(0.02);
        }
      }
    }
  });

  it('grows into a frame’s headroom without reaching its top', () => {
    expect(figureScale(0)).toBe(1);
    // The sheet frame leaves 0.415 tile above the box: the figure grows to its cap.
    expect(figureScale(0.415)).toBe(1.35);
    // Less room, less growth; never past the top of the box plus the room.
    const some = figureScale(0.1);
    expect(some).toBeGreaterThan(1);
    expect(FOOT * some).toBeLessThan(FOOT + 0.1);
  });

  it('gives an index past a clip its last pose', () => {
    expect(poseFor('cast', 7)).toBe(POSES.cast[2]);
    expect(poseFor('idle', -3)).toBe(POSES.idle[0]);
  });
});

describe('the cast', () => {
  it('keeps the authored fallback figure for every hero after sheets replace painters', () => {
    for (const character of CHARACTERS) {
      const entry = ASSETS[character.sprite];
      expect(entry, character.id).toBeDefined();
      const fallback = resolvePainter(character.sprite);
      const authoredVariant = character.sprite.slice(character.sprite.lastIndexOf('.') + 1);
      expect(fallback.variant, `${character.id} fallback variant`).toBe(authoredVariant);
      expect(HEROES[fallback.variant ?? ''], `${character.id} needs a figure`).toBeDefined();
    }
  });

  it('draws something for every painter entry in the manifest', () => {
    for (const [key, entry] of Object.entries(ASSETS)) {
      if (entry.kind !== 'painter' || (!key.startsWith('unit.') && !key.startsWith('npc.')))
        continue;
      if (entry.painter === 'driller') continue;
      const spec = figureFor(entry.painter, entry.variant, paletteFor(entry.palette));
      expect(BUILDS[spec.build], key).toBeDefined();
      expect(spec.garment.base, key).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('falls back to a generic figure for an unknown variant', () => {
    const spec = figureFor('bender', 'someone-new', paletteFor('fire'));
    expect(spec.build).toBe('lean');
    expect(spec.garment.base).toBe(paletteFor('fire').base);
    expect(figureFor('mercenary', 'broad', paletteFor('enemy')).build).toBe('broad');
  });
});
