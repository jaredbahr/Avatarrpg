import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DAY_PHASES, type MapScene } from '../core/types';
import { COMBAT_LIGHT_STRENGTH, DAY_LIGHT, LAMP_GLASS, LAMP_POOL } from '../content/dayLight';
import { topDownSceneSchema } from '../content/topdownSceneSchema';
import { boardLight, boardLightFor, sceneLamps, scaleGrade } from './dayLight';

const URL = 'art/topdown/ba-dan/scene.json';
const badan = (): MapScene => {
  const parsed = topDownSceneSchema(URL).safeParse(
    JSON.parse(readFileSync(`public/${URL}`, 'utf8')) as unknown,
  );
  if (!parsed.success) throw new Error('Ba Dan scene does not parse');
  return parsed.data;
};

describe('the day light, phase by phase (ADR 0121)', () => {
  it('leaves the day as painted: no grade and no lamps from morning to afternoon', () => {
    for (const phase of ['morning', 'midday', 'afternoon'] as const) {
      expect(boardLight(phase, badan(), 'explore')).toBeNull();
      expect(boardLight(phase, badan(), 'combat')).toBeNull();
    }
  });

  it('grades the evening with the table values, lift on the 0..1 scale', () => {
    const light = boardLight('evening', badan(), 'explore');
    const def = DAY_LIGHT.evening.grade;
    expect(def).not.toBeNull();
    expect(light?.grade?.multiply).toEqual(def?.multiply);
    light?.grade?.lift.forEach((v, c) => expect(v).toBeCloseTo((def?.lift[c] ?? 0) / 255, 6));
    expect(light?.pool).toBe(LAMP_POOL);
    expect(light?.glass).toBe(LAMP_GLASS);
  });

  it('gives a fight about half the exploration grade, and the same lamps', () => {
    for (const phase of ['evening', 'night'] as const) {
      const explore = boardLight(phase, badan(), 'explore');
      const combat = boardLight(phase, badan(), 'combat');
      const def = DAY_LIGHT[phase].grade;
      if (!def || !explore?.grade || !combat?.grade) throw new Error(`${phase} has no grade`);
      for (const c of [0, 1, 2] as const) {
        const darkening = 1 - def.multiply[c];
        expect(1 - combat.grade.multiply[c]).toBeCloseTo(darkening * COMBAT_LIGHT_STRENGTH, 6);
        expect(combat.grade.lift[c]).toBeCloseTo(explore.grade.lift[c] * COMBAT_LIGHT_STRENGTH, 6);
      }
      expect(combat.lamps).toEqual(explore.lamps);
    }
    expect(COMBAT_LIGHT_STRENGTH).toBeCloseTo(0.5, 1);
  });

  it('scales a grade to nothing at zero strength and to the table at one', () => {
    const def = { multiply: [0.5, 0.6, 0.7], lift: [51, 0, 255] } as const;
    expect(scaleGrade(def, 0)).toEqual({ multiply: [1, 1, 1], lift: [0, 0, 0] });
    expect(scaleGrade(def, 1)).toEqual({ multiply: [0.5, 0.6, 0.7], lift: [0.2, 0, 1] });
  });

  it('lights the lamps at evening and night only', () => {
    for (const phase of DAY_PHASES) {
      const lamps = boardLight(phase, badan(), 'explore')?.lamps ?? [];
      expect(lamps.length > 0, phase).toBe(phase === 'evening' || phase === 'night');
    }
  });

  it('hands back the same object for the same inputs, so the view stays stable', () => {
    const scene = badan();
    expect(boardLightFor('evening', scene, 'explore')).toBe(
      boardLightFor('evening', scene, 'explore'),
    );
  });
});

describe('the lamps come from the scene (ADR 0121)', () => {
  it('puts a pool under each of Ba Dan’s four lanterns, at the foot of its post', () => {
    const scene = badan();
    const lanterns = scene.ambienceSources?.lanterns ?? [];
    expect(lanterns).toHaveLength(4);
    const lamps = sceneLamps(scene);
    expect(lamps).toHaveLength(4);
    lamps.forEach((lamp, index) => {
      expect(lamp.glass).toBe(lanterns[index]);
      // Straight under the glass, on the ground below it.
      expect(lamp.ground.x).toBe(lamp.glass.x);
      expect(lamp.ground.y).toBeGreaterThan(lamp.glass.y + 1);
      // The lamp piece that holds the glass: its foot is the ground line, its depth the sort.
      const piece = scene.scenery.find((p) => p.depth === lamp.depth);
      expect(piece?.id).toMatch(/lamp/);
      expect(lamp.ground.y * 40).toBe((piece?.y ?? 0) + (piece?.height ?? 0));
    });
  });

  it('leaves a glass no piece holds unlit, and a scene without lanterns dark', () => {
    const scene = badan();
    const stray = {
      ...scene,
      ambienceSources: { steam: [], lanterns: [{ x: -50, y: -50 }] },
    };
    expect(sceneLamps(stray)).toEqual([]);
    expect(sceneLamps({ ...scene, ambienceSources: undefined })).toEqual([]);
    expect(sceneLamps(undefined)).toEqual([]);
    // No lamps, but the evening grade still lands.
    expect(boardLight('evening', undefined, 'explore')?.lamps).toEqual([]);
    expect(boardLight('evening', undefined, 'explore')?.grade).not.toBeNull();
  });
});
