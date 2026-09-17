import { describe, expect, it } from 'vitest';
import { choreograph } from './choreography';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { attackMotion } from './attackMotion';

describe('element attack rhythm', () => {
  it('distinguishes a fire snap, flowing water and a planted earth stance', () => {
    const fire = attackMotion('fx.fire.jab', false, false);
    const water = attackMotion('fx.water.whip', false, false);
    const earth = attackMotion('fx.earth.throw', false, false);
    expect(fire.release).toBeLessThan(water.release);
    expect(earth.windUp).toBeGreaterThan(fire.windUp);
    expect(earth.reach).toBeLessThan(fire.reach);
    expect(water.releaseEase(0.1)).toBeLessThan(fire.releaseEase(0.1));
  });

  it('keeps every authored ability continuous through release, hold and recovery', () => {
    const unit = createGame(CONTENT, {
      seed: 'motion',
      startNode: 'village_explore',
      party: [{ characterId: 'kaya' }],
    }).party[0];
    if (!unit) throw new Error('No actor');
    for (const ability of CONTENT.abilities.values()) {
      for (const rate of [1, 0.02]) {
        const result = choreograph({
          content: CONTENT,
          unitsBefore: [unit],
          cursor: 1000,
          rate,
          pushIndex: 0,
          events: [
            {
              type: 'abilityUsed',
              unitId: unit.id,
              abilityId: ability.id,
              target: { x: unit.pos.x + 3, y: unit.pos.y },
              tiles: [],
            },
          ],
        });
        const poses = result.tracks.filter((t) => t.kind === 'pose');
        expect(poses.length, ability.id).toBeGreaterThanOrEqual(3);
        for (let i = 1; i < poses.length; i++) {
          const previous = poses[i - 1];
          const next = poses[i];
          if (!previous || !next) throw new Error('Missing pose');
          expect(next.start, ability.id).toBeCloseTo(previous.start + previous.duration);
          expect(next.offset.from, ability.id).toEqual(previous.offset.to);
        }
        expect(poses.at(-1)?.offset.to, ability.id).toEqual({ x: 0, y: 0 });
        expect(result.sounds.find((s) => s.key === ability.fx)?.at, ability.id).toBe(
          poses[1]?.start,
        );
        if (rate < 1)
          expect(result.tracks.some((t) => t.kind === 'emitter' || t.kind === 'shake')).toBe(false);
      }
    }
  });
});
