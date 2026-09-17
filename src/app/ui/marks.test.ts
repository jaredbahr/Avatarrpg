import { describe, expect, it } from 'vitest';
import { ALL_ABILITIES } from '../../content/abilities';
import { ABILITY_MARKS, MARK_KINDS, SIGNATURE_MARKS, UI_MARKS, kindFor, markFor } from './marks';

/**
 * Every ability gets a picture, every picture is small, and the signature
 * table names only abilities that exist, so a renamed fx key cannot leave a
 * signature pointing at nothing while the button quietly falls back.
 */

/** Room for a wrapper of about 210 bytes and a path or two. */
const MAX_BYTES = 480;

describe('ability marks', () => {
  it('resolve to a small inline SVG for every ability', () => {
    for (const ability of ALL_ABILITIES) {
      const mark = markFor(ability);
      expect(mark.startsWith('<svg'), ability.id).toBe(true);
      expect(mark.length, `${ability.id} mark is ${mark.length} bytes`).toBeLessThan(MAX_BYTES);
    }
  });

  it('draw every kind and every control in the current colour, hidden from readers', () => {
    for (const [name, mark] of [...Object.entries(ABILITY_MARKS), ...Object.entries(UI_MARKS)]) {
      expect(mark, name).toContain('viewBox="0 0 24 24"');
      expect(mark, name).toContain('aria-hidden="true"');
      expect(mark, name).toContain('stroke="currentColor"');
      expect(mark.length, name).toBeLessThan(MAX_BYTES);
    }
    for (const kind of MARK_KINDS) expect(ABILITY_MARKS[kind], kind).toBeDefined();
  });

  it('name signatures only for fx keys that content has', () => {
    const keys = new Set(ALL_ABILITIES.map((a) => a.fx));
    for (const key of Object.keys(SIGNATURE_MARKS)) {
      expect(keys.has(key), `${key} is not an ability's fx key`).toBe(true);
    }
  });

  it('read the kind off what an ability does before what it targets', () => {
    const byId = new Map(ALL_ABILITIES.map((a) => [a.id, a]));
    const expected: Record<string, ReturnType<typeof kindFor>> = {
      fire_step: 'dash',
      earth_wall: 'wall',
      heat_shield: 'guard',
      seismic_sense: 'sense',
      healing_stream: 'heal',
      water_pull: 'pull',
      shove: 'push',
      smoke_bomb: 'smoke',
      torch_toss: 'torch',
      oil_flask: 'flask',
      raise_rubble: 'rock',
      rally: 'rally',
      flame_arc: 'cone',
      fissure: 'line',
      shatterpoint: 'blast',
      strike: 'fist',
      fire_jab: 'bolt',
    };
    for (const [id, kind] of Object.entries(expected)) {
      const ability = byId.get(id);
      expect(ability, id).toBeDefined();
      if (ability) expect(kindFor(ability), id).toBe(kind);
    }
    // A signature wins over the kind: a rock throw is a rock, not a bolt.
    const rock = byId.get('rock_throw');
    expect(rock && markFor(rock)).toBe(ABILITY_MARKS.rock);
  });
});
