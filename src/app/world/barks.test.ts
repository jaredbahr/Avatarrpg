import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import type { DayPhase, GameState, MapDef, Vec2 } from '../../core/types';
import { handoverBark } from './barks';

const village = CONTENT.maps.get('ba_dan_village') as MapDef;

/** The party at a tile of the village, at a phase and day, the handover seen or not. */
function at(phase: DayPhase, day: number, pos: Vec2, seen = true): GameState {
  const base = createGame(CONTENT, {
    seed: 'barks',
    party: [{ characterId: 'kaya' }],
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    flags: seen ? { ...base.flags, 'scene.bd03_handover': 'completed' } : base.flags,
    story: { ...base.story, nodeId: 'village_explore', visited: ['mira_intro'] },
    location: { mapId: village.id, pos },
    world: { ...base.world, clock: { day, phase } },
  };
}

const GATE = { x: 20, y: 7 };

describe('handover barks (ADR 0047 §8)', () => {
  it('speak at the gate at dawn and in the evening, once the handover has been seen', () => {
    expect(handoverBark(CONTENT, village, at('dawn', 1, GATE))).toMatch(
      /^Hanru: “.+” Dorin: “.+”$/,
    );
    expect(handoverBark(CONTENT, village, at('evening', 1, GATE))).toMatch(
      /^Dorin: “.+” Hanru: “.+”$/,
    );
    expect(handoverBark(CONTENT, village, at('dawn', 1, GATE, false))).toBeNull();
    for (const phase of ['morning', 'midday', 'afternoon', 'night'] as const)
      expect(handoverBark(CONTENT, village, at(phase, 1, GATE)), phase).toBeNull();
    expect(handoverBark(CONTENT, village, at('dawn', 1, { x: 3, y: 7 }))).toBeNull();
  });

  it('rotate with the day and the watch, and are the same for the same day', () => {
    const lines = [1, 2, 3].map((day) => handoverBark(CONTENT, village, at('dawn', day, GATE)));
    expect(new Set(lines).size).toBe(3);
    expect(handoverBark(CONTENT, village, at('dawn', 2, GATE))).toBe(lines[1]);
    // The evening handover of a day is a different item from its dawn.
    const said = (line: string | null) => line?.split('”')[0]?.split('“')[1];
    expect(said(handoverBark(CONTENT, village, at('evening', 1, GATE)))).not.toBe(
      said(lines[0] ?? null),
    );
  });
});
