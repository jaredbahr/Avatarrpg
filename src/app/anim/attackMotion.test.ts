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
        const sound = result.sounds.find((s) => s.key === ability.fx);
        const release = poses[1];
        if (!sound || !release) throw new Error('Missing release');
        expect(sound.at, ability.id).toBeGreaterThanOrEqual(release.start);
        expect(sound.at, ability.id).toBeLessThanOrEqual(release.start + release.duration);
        if (rate < 1)
          expect(result.tracks.some((t) => t.kind === 'emitter' || t.kind === 'shake')).toBe(false);
      }
    }
  });

  it('launches each element with its sound after the body starts extending', () => {
    const unit = createGame(CONTENT, {
      seed: 'launch',
      startNode: 'village_explore',
      party: [{ characterId: 'kaya' }],
    }).party[0];
    if (!unit) throw new Error('No actor');
    for (const abilityId of ['fire_jab', 'water_whip', 'rock_throw', 'air_blast']) {
      const result = choreograph({
        content: CONTENT,
        unitsBefore: [unit],
        cursor: 0,
        rate: 1,
        pushIndex: 0,
        events: [
          {
            type: 'abilityUsed',
            unitId: unit.id,
            abilityId,
            target: { x: unit.pos.x + 4, y: unit.pos.y },
            tiles: [],
          },
        ],
      });
      const release = result.tracks.filter((t) => t.kind === 'pose')[1];
      const sound = result.sounds[0];
      if (!release || !sound) throw new Error(`Missing ${abilityId}`);
      expect(sound.at).toBeGreaterThan(release.start);
      expect(sound.at).toBeLessThan(release.start + release.duration);
      const flight = result.tracks.filter((t) => t.kind === 'emitter' && t.start === sound.at);
      expect(flight.length, abilityId).toBeGreaterThan(0);
      // Fire/air silhouettes travel once; only a water whip comes back.
      for (const track of flight)
        if (track.kind === 'emitter' && track.def.kind === 'strokes') {
          expect(track.duration).toBe(track.def.duration);
        }
    }
  });
});
