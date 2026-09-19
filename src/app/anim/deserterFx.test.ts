import { expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { GameEvent, Unit } from '../../core/types';
import { choreograph } from './choreography';
import type { EmitterTrack } from './timeline';

const caster = {
  id: 'caster',
  sprite: 'unit.enemy.deserter',
  pos: { x: 8, y: 4 },
  size: 1,
  faction: 'enemy',
  hp: 32,
} as Unit;
const target = {
  id: 'target',
  sprite: 'unit.water.sura',
  pos: { x: 5, y: 4 },
  size: 1,
  faction: 'party',
  hp: 30,
} as Unit;

it.each(['fire_blast', 'oil_flask'])(
  '%s attaches only its source and preserves ground contact clocks',
  (id) => {
    const ability = CONTENT.abilities.get(id)!;
    // Same recipe under an unopted-in test id provides the existing ground-clock
    // contract, without maintaining another set of hardcoded timeline numbers.
    const legacy = { ...ability, id: 'ground-contract' };
    const content = { ...CONTENT, abilities: new Map([...CONTENT.abilities, [legacy.id, legacy]]) };
    for (const x of [5, 11])
      for (const occupied of [false, true]) {
        const victim = { ...target, pos: { x, y: 4 } };
        const unitsBefore = occupied ? [caster, victim] : [caster];
        const play = (abilityId: string, rate = 1) =>
          choreograph({
            content,
            unitsBefore,
            events: [
              {
                type: 'abilityUsed',
                unitId: caster.id,
                abilityId,
                target: victim.pos,
                tiles: [
                  { x, y: 4 },
                  { x: x + 1, y: 4 },
                ],
              } as GameEvent,
            ],
            cursor: 0,
            rate,
            pushIndex: 0,
            projection: 'oblique',
          });
        const current = play(id),
          prior = play(legacy.id);
        expect(current.cursor).toBe(prior.cursor);
        expect(current.sounds).toEqual(prior.sounds);
        const effects = current.tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
        const flight = effects.find(
          (t) => t.def.kind === 'particles' && t.def.shape === 'projectile',
        )!;
        expect(flight.attachments?.from).toMatchObject({
          socket: 'cast-release',
          sprite: caster.sprite,
          pos: caster.pos,
          facing: x < caster.pos.x ? -1 : 1,
        });
        expect(flight.attachments?.to).toBeUndefined();
        expect(flight.to).toEqual({ x: x + 0.5, y: 4.5 });
        expect(
          effects.some(
            (t) => t.attachments?.translateTogether || t.attachments?.from?.socket === 'torso',
          ),
        ).toBe(false);
        const oldFlight = prior.tracks.find(
          (t) => t.kind === 'emitter' && t.def.kind === 'particles' && t.def.shape === 'projectile',
        )!;
        expect([flight.start, flight.duration]).toEqual([oldFlight.start, oldFlight.duration]);
        const afterImpact = (tracks: typeof current.tracks) =>
          tracks.filter((t) => t.kind === 'emitter' && t.start > flight.start);
        expect(afterImpact(current.tracks)).toEqual(afterImpact(prior.tracks));
        expect(afterImpact(current.tracks).length).toBeGreaterThan(0);
        const release = current.tracks.find(
          (t) =>
            t.kind === 'pose' &&
            t.frame === 1 &&
            t.start <= flight.start &&
            t.start + t.duration > flight.start,
        );
        if (release?.kind !== 'pose' || !release.scale) throw new Error('Missing release pose');
        const p = release.ease((flight.start - release.start) / release.duration);
        expect(flight.attachments!.from!.scale).toBeCloseTo(
          release.scale.from + (release.scale.to - release.scale.from) * p,
          9,
        );
        expect(flight.attachments!.from!.offset.x).toBeCloseTo(
          release.offset.from.x + (release.offset.to.x - release.offset.from.x) * p,
          9,
        );
        if (id === 'fire_blast')
          expect(effects.some((t) => t.attachments?.from?.socket === 'cast-gather')).toBe(true);
        const reduced = play(id, 0.02);
        expect(reduced.tracks.some((t) => t.kind === 'emitter')).toBe(false);
        expect(reduced.cursor).toBeCloseTo(current.cursor * 0.02, 7);
      }
  },
);
