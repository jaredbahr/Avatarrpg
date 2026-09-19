import { describe, expect, it } from 'vitest';
import type { Ability, ContentIndex, GameEvent, Unit } from '../../core/types';
import { resolveFx } from '../../content/fx';
import { TIMING, choreograph } from './choreography';
import { attackMotion } from './attackMotion';
import type { AnyTrack, EmitterTrack, PoseTrack } from './timeline';
import { PARTICLE_STRIDE, sampleParticles } from '../../render/fx/simulate';

/**
 * The choreography is a pure function, so these pin the shape of a playback:
 * which tracks an event produces and when they start relative to each other.
 * Durations come from TIMING so a retune does not rewrite the assertions.
 */

const fireJab = {
  id: 'fire_jab',
  fx: 'fx.fire.jab',
  range: 5,
  targeting: { shape: 'unit', allow: 'enemy' },
} as unknown as Ability;

const strike = {
  id: 'strike',
  fx: 'fx.non.strike',
  range: 1,
  targeting: { shape: 'unit', allow: 'enemy' },
} as unknown as Ability;

const waterWhip = {
  id: 'water_whip',
  fx: 'fx.water.whip',
  range: 3,
  targeting: { shape: 'unit', allow: 'enemy' },
} as unknown as Ability;

const content = {
  abilities: new Map<string, Ability>([
    ['fire_jab', fireJab],
    ['strike', strike],
    ['rock_throw', { ...waterWhip, id: 'rock_throw', fx: 'fx.earth.rock', range: 6 }],
    ['earth_wall', { ...waterWhip, id: 'earth_wall', fx: 'fx.earth.wall', range: 6 }],
    ['water_whip', waterWhip],
    ['air_blast', { ...waterWhip, id: 'air_blast', fx: 'fx.air.blast', range: 6 }],
  ]),
} as unknown as ContentIndex;

const unit = (id: string, x: number, y: number): Unit =>
  ({ id, pos: { x, y }, faction: 'party', size: 1 }) as unknown as Unit;

const roster = [unit('p0', 1, 3), unit('e0', 5, 3)];

function run(events: GameEvent[], rate = 1) {
  return choreograph({ content, events, unitsBefore: roster, cursor: 1000, rate, pushIndex: 0 });
}

const kinds = (tracks: readonly AnyTrack[]) => tracks.map((t) => t.kind);

describe('directed Fire Jab attachments', () => {
  const cast = (targetX = 5, abilityId = 'fire_jab'): GameEvent => ({
    type: 'abilityUsed',
    unitId: 'p0',
    abilityId,
    target: { x: targetX, y: 3 },
    tiles: [{ x: targetX, y: 3 }],
  });
  const caster = { ...unit('p0', 1, 3), sprite: 'unit.fire.kaya', hp: 20 };
  const boss = {
    ...unit('boss', 5, 3),
    faction: 'enemy' as const,
    sprite: 'unit.enemy.driller',
    size: 2 as const,
    hp: 80,
  };
  const play = (events: GameEvent[], units: Unit[] = [caster, boss], rate = 1) =>
    choreograph({
      content,
      events,
      unitsBefore: units,
      cursor: 1000,
      rate,
      pushIndex: 0,
      projection: 'oblique',
    });

  it('attaches either boss footprint cell to the same torso while preserving logical trajectory', () => {
    const first = play([cast(5)]).tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
    const second = play([cast(6)]).tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
    const a = first.find((t) => t.attachments?.from?.socket === 'cast-release');
    const b = second.find((t) => t.attachments?.from?.socket === 'cast-release');
    expect(a?.attachments?.to).toEqual(b?.attachments?.to);
    expect(a?.attachments?.to).toMatchObject({
      pos: { x: 5, y: 3 },
      size: 2,
      socket: 'torso',
      sprite: boss.sprite,
    });
    expect(a?.from).toEqual({ x: 1.5, y: 3.5 });
    expect(a?.to).toEqual({ x: 5.5, y: 3.5 });
    expect(b?.to).toEqual({ x: 6.5, y: 3.5 });
    expect(first.some((t) => t.attachments?.translateTogether)).toBe(true);
  });

  it.each([
    ['water_whip', 'unit.water.nilak'],
    ['water_whip', 'unit.water.sura'],
    ['air_blast', 'unit.air.nima'],
    ['air_blast', 'unit.air.jinu'],
  ])('attaches %s for %s and expires gather before release', (abilityId, sprite) => {
    const tracks = play([cast(5, abilityId)], [{ ...caster, sprite }, boss]).tracks;
    const emitters = tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
    const gather = emitters.filter((t) => t.attachments?.from?.socket === 'cast-gather');
    const flight = emitters.find((t) => t.attachments?.from?.socket === 'cast-release');
    const release = tracks.find(
      (t) => t.kind === 'pose' && t.unitId === caster.id && t.frame === 1,
    );
    expect(gather.length).toBeGreaterThan(0);
    expect(flight?.attachments?.from?.sprite).toBe(sprite);
    expect(flight?.attachments?.to?.socket).toBe('torso');
    expect(
      gather.every(
        (t) =>
          t.start + (t.def.kind === 'particles' ? t.def.delay[1] + t.def.life[1] : t.duration) <=
          release!.start + 0.001,
      ),
    ).toBe(true);
    const pushed = play(
      [cast(5, abilityId), { type: 'unitPushed', unitId: boss.id, to: { x: 7, y: 3 } }],
      [{ ...caster, sprite }, boss],
    );
    const pushedFlight = pushed.tracks.find(
      (t) => t.kind === 'emitter' && t.attachments?.from?.socket === 'cast-release',
    );
    expect(pushedFlight?.kind === 'emitter' && pushedFlight.attachments?.to?.pos).toEqual({
      x: 5,
      y: 3,
    });
    expect(
      play([cast(5, abilityId)], [{ ...caster, sprite }, boss], 0.02).tracks.some(
        (t) => t.kind === 'emitter',
      ),
    ).toBe(false);
  });

  it('holds Water Whip release through its returning tether without postponing contact', () => {
    const tracks = play(
      [cast(5, 'water_whip')],
      [{ ...caster, sprite: 'unit.water.nilak' }, boss],
    ).tracks;
    const whip = tracks.find(
      (t): t is EmitterTrack =>
        t.kind === 'emitter' &&
        t.def.kind === 'strokes' &&
        t.def.shape === 'whip' &&
        t.attachments?.from?.socket === 'cast-release',
    );
    const recovery = tracks.find(
      (t) => t.kind === 'pose' && t.unitId === caster.id && t.frame === 2,
    );
    expect(whip).toBeDefined();
    expect(recovery!.start).toBeGreaterThanOrEqual(whip!.start + whip!.duration);
    const impact = tracks.find(
      (t): t is EmitterTrack => t.kind === 'emitter' && t.attachments?.translateTogether === true,
    );
    expect(impact!.start).toBeLessThan(recovery!.start);
  });

  it('lifts a stone from ground to release while separating body shards from ground debris', () => {
    const tracks = play(
      [cast(5, 'rock_throw')],
      [{ ...caster, sprite: 'unit.earth.bo' }, boss],
    ).tracks;
    const effects = tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
    const lift = effects.find((t) => t.attachments?.from?.socket === 'ground');
    const flight = effects.find((t) => t.attachments?.from?.socket === 'cast-release');
    expect(lift?.attachments?.to).toEqual(flight?.attachments?.from);
    expect(lift?.def.kind === 'particles' && lift.start + lift.def.life[1]).toBeCloseTo(
      flight!.start,
      8,
    );
    const shards = effects.filter((t) => t.attachments?.from?.socket === 'torso');
    expect(shards.length).toBeGreaterThan(0);
    expect(shards.every((t) => t.def.kind === 'particles' && t.def.cell === 'shard')).toBe(true);
    expect(
      effects.some((t) => !t.attachments && t.def.kind === 'strokes' && t.def.shape === 'crack'),
    ).toBe(true);
    expect(
      effects.some(
        (t) => !t.attachments && t.def.kind === 'particles' && t.def.cel === 'earth-rise',
      ),
    ).toBe(true);
  });

  it('places Strike sparks at the body while dust stays grounded', () => {
    const effects = play(
      [cast(5, 'strike')],
      [{ ...caster, sprite: 'unit.non.riko' }, boss],
    ).tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
    expect(
      effects.some(
        (t) =>
          t.attachments?.from?.socket === 'torso' &&
          t.def.kind === 'particles' &&
          t.def.cell === 'spark',
      ),
    ).toBe(true);
    expect(
      effects.some((t) => !t.attachments && t.def.kind === 'particles' && t.def.cell === 'puff'),
    ).toBe(true);
  });

  it('draws from Sura gear only and ends that source before release', () => {
    for (const sprite of ['unit.water.sura', 'unit.water.nilak']) {
      const tracks = play([cast(5, 'water_whip')], [{ ...caster, sprite }, boss]).tracks;
      const source = tracks.find(
        (t): t is EmitterTrack =>
          t.kind === 'emitter' && t.attachments?.from?.socket === 'waterskin',
      );
      if (sprite.endsWith('sura')) {
        expect(source?.attachments?.to?.socket).toBe('cast-gather');
        const release = tracks.find(
          (t) => t.kind === 'pose' && t.unitId === caster.id && t.frame === 1,
        )!;
        expect(
          source?.def.kind === 'particles' && source.start + source.def.life[1],
        ).toBeLessThanOrEqual(release.start);
        for (const track of tracks) {
          if (track.kind !== 'emitter' || track.attachments?.from?.socket !== 'waterskin') continue;
          expect(track.attachments.to?.socket).toBe('cast-gather');
          if (track.def.kind === 'particles')
            expect(track.start + track.def.delay[1] + track.def.life[1]).toBeLessThanOrEqual(
              release.start,
            );
        }
      } else expect(source).toBeUndefined();
    }
  });

  it('starts an actual Air Blast shove after contact hold with no overlapping recoil', () => {
    const damage: GameEvent = {
      type: 'damaged',
      unitId: boss.id,
      amount: 4,
      crit: false,
      damageType: 'air',
      sourceId: caster.id,
    };
    const pushed = play([
      cast(5, 'air_blast'),
      damage,
      { type: 'unitPushed', unitId: boss.id, to: { x: 7, y: 3 } },
    ]);
    const slide = pushed.tracks.find((t) => t.kind === 'move' && t.unitId === boss.id)!;
    expect(slide.start).toBeCloseTo(1000 + 536.8, 8);
    expect(slide.duration).toBe(220);
    const poses = pushed.tracks.filter(
      (t): t is PoseTrack => t.kind === 'pose' && t.unitId === boss.id,
    );
    expect(poses).toHaveLength(2);
    expect(poses.every((t) => t.offset.from.x === 0 && t.offset.to.x === 0)).toBe(true);
    const blocked = play([cast(5, 'air_blast'), damage]);
    expect(blocked.tracks.filter((t) => t.kind === 'pose' && t.unitId === boss.id)).toHaveLength(3);
  });

  it.each([1, 0.02])(
    'keeps clipped Air Blast destinations and forced timing at rate %s',
    (rate) => {
      const events: GameEvent[] = [
        cast(5, 'air_blast'),
        { type: 'unitPushed', unitId: boss.id, to: { x: 6, y: 3 } },
      ];
      const result = play(events, [caster, boss], rate);
      const slide = result.tracks.find((t) => t.kind === 'move');
      expect(slide?.start).toBeCloseTo(1000 + 536.8 * rate, 8);
      expect(slide?.duration).toBeCloseTo(220 * rate, 8);
      expect(result.cursor).toBeGreaterThanOrEqual(slide!.start + slide!.duration);
      const next = play(
        [...events, cast(5, 'strike'), { type: 'unitPushed', unitId: boss.id, to: { x: 7, y: 3 } }],
        [caster, boss],
        rate,
      );
      const moves = next.tracks.filter((t) => t.kind === 'move');
      expect(moves[1]!.start).toBeGreaterThan(moves[0]!.start + moves[0]!.duration);
    },
  );

  it('chooses the living recipient rather than a corpse sharing its tile', () => {
    const corpse = {
      ...unit('corpse', 5, 3),
      sprite: 'unit.enemy.thug',
      hp: 0,
      faction: 'enemy' as const,
    };
    const tracks = play([cast()], [caster, corpse, boss]).tracks;
    const travel = tracks.find(
      (t) => t.kind === 'emitter' && t.attachments?.from?.socket === 'cast-release',
    );
    if (travel?.kind !== 'emitter') throw new Error('Missing flight');
    expect(travel.attachments?.to?.sprite).toBe(boss.sprite);
    expect(travel.attachments?.to?.size).toBe(2);
  });

  it('captures launch scale and position independently of recovery and subsequent movement', () => {
    const origin = { x: 1, y: 3 };
    const tracks = play(
      [cast(), { type: 'unitPushed', unitId: 'p0', to: { x: 0, y: 3 } }],
      [{ ...caster, pos: origin }, boss],
    ).tracks;
    const release = tracks.find(
      (t) => t.kind === 'emitter' && t.attachments?.from?.socket === 'cast-release',
    );
    const gather = tracks.find(
      (t) => t.kind === 'emitter' && t.attachments?.from?.socket === 'cast-gather',
    );
    if (release?.kind !== 'emitter' || gather?.kind !== 'emitter')
      throw new Error('Missing attached effects');
    const snapshot = JSON.stringify(release.attachments);
    const pose = tracks.find(
      (t) => t.kind === 'pose' && t.start <= release.start && t.start + t.duration > release.start,
    );
    if (pose?.kind !== 'pose' || !pose.scale) throw new Error('Missing release pose');
    const fraction = pose.ease((release.start - pose.start) / pose.duration);
    expect(release.attachments?.from?.scale).toBeCloseTo(
      1.25 * (pose.scale.from + (pose.scale.to - pose.scale.from) * fraction),
      9,
    );
    expect(release.attachments?.from?.offset.x).toBeCloseTo(
      pose.offset.from.x + (pose.offset.to.x - pose.offset.from.x) * fraction,
      9,
    );
    expect(release.attachments?.from?.pos).toEqual({ x: 1, y: 3 });
    expect(gather.attachments?.from?.socket).toBe('cast-gather');
    expect(tracks.some((t) => t.kind === 'pose' && t.frame === 2 && t.start > release.start)).toBe(
      true,
    );
    origin.x = 18;
    expect(JSON.stringify(release.attachments)).toBe(snapshot);
  });

  it('does not attach other techniques or revive suppressed reduced-motion emitters', () => {
    for (const ability of ['earth_wall']) {
      const effects = play([cast(5, ability)]).tracks.filter(
        (t): t is EmitterTrack => t.kind === 'emitter',
      );
      expect(effects.length).toBeGreaterThan(0);
      expect(effects.every((t) => t.attachments === undefined)).toBe(true);
    }
    const normal = play([cast()]);
    const reduced = play([cast()], [caster, boss], 0.02);
    expect(reduced.tracks.some((t) => t.kind === 'emitter')).toBe(false);
    expect(reduced.cursor - 1000).toBeCloseTo((normal.cursor - 1000) * 0.02, 7);
  });

  it('uses the same explicit side for the palm and cast pose at vertical screen headings', () => {
    for (const [x, y, facing] of [
      [3, 5, 1],
      [3, 6, -1],
      [1, 5, -1],
    ] as const) {
      const events: GameEvent[] = [
        {
          type: 'abilityUsed',
          unitId: 'p0',
          abilityId: 'fire_jab',
          target: { x, y },
          tiles: [{ x, y }],
        },
      ];
      const tracks = play(events, [caster, { ...boss, pos: { x, y } }]).tracks;
      const poses = tracks.filter(
        (t): t is PoseTrack => t.kind === 'pose' && t.unitId === caster.id,
      );
      expect(poses.every((pose) => pose.facing === facing)).toBe(true);
      const palms = tracks.filter(
        (t): t is EmitterTrack => t.kind === 'emitter' && t.attachments?.from?.socket !== 'torso',
      );
      expect(palms.length).toBeGreaterThan(0);
      expect(palms.every((t) => t.attachments?.from?.facing === facing)).toBe(true);
    }
  });

  it('ends rear-palm gather particles before the extended release pose replaces that hand', () => {
    const tracks = play([cast()]).tracks;
    const release = tracks.find((t) => t.kind === 'pose' && t.unitId === 'p0' && t.frame === 1);
    if (release?.kind !== 'pose') throw new Error('Missing release');
    const gathering = tracks.filter(
      (t): t is EmitterTrack =>
        t.kind === 'emitter' && t.attachments?.from?.socket === 'cast-gather',
    );
    expect(gathering.length).toBeGreaterThan(0);
    for (const track of gathering) {
      if (track.def.kind === 'particles') {
        expect(track.start + track.def.delay[1] + track.def.life[1]).toBeLessThanOrEqual(
          release.start,
        );
        const scratch = new Float32Array(track.def.count * PARTICLE_STRIDE);
        expect(
          sampleParticles(
            track.def,
            release.start - track.start - 1,
            track.seed,
            track.from,
            track.to,
            scratch,
          ),
        ).toBeGreaterThan(0);
        expect(
          sampleParticles(
            track.def,
            release.start - track.start + 1,
            track.seed,
            track.from,
            track.to,
            scratch,
          ),
        ).toBe(0);
      } else expect(track.start + track.duration).toBeLessThanOrEqual(release.start);
    }
  });
});

describe('choreograph', () => {
  it('walks two combat tiles at a readable pace with brief acceleration and braking', () => {
    const { tracks, cursor } = run([
      {
        type: 'unitMoved',
        unitId: 'p0',
        path: [
          { x: 2, y: 3 },
          { x: 3, y: 3 },
        ],
        cost: 2,
      },
    ]);
    expect(kinds(tracks)).toEqual(['move']);
    expect(tracks[0]?.start).toBe(1000);
    expect(tracks[0]?.duration).toBe(680);
    expect(cursor).toBe(1680);
  });

  it('walks the party leader from where it stood, without needing the roster', () => {
    const { tracks, cursor } = run(
      [
        {
          type: 'partyWalked',
          unitId: 'leader',
          from: { x: 3, y: 7 },
          path: [
            { x: 4, y: 7 },
            { x: 5, y: 7 },
          ],
        },
      ],
      1,
    );
    expect(kinds(tracks)).toEqual(['move']);
    const [move] = tracks;
    if (move?.kind !== 'move') throw new Error('expected a move track');
    expect(move.unitId).toBe('leader');
    expect(move.start).toBe(1000);
    expect(move.duration).toBe(TIMING.strollStep * 2 + 120);
    expect(cursor).toBe(1000 + move.duration);
    expect(move.duration).toBeGreaterThan(TIMING.step * 4);
  });

  it('keeps short, long and diagonal combat walks at the same distance pace and sounds at footfalls', () => {
    for (const [count, diagonal] of [
      [2, false],
      [12, false],
      [6, true],
    ] as const) {
      const path = Array.from({ length: count }, (_, i) => ({
        x: 2 + i,
        y: diagonal ? 4 + i : 3,
      }));
      for (const rate of [1, 0.02]) {
        const { tracks, sounds } = run(
          [{ type: 'unitMoved', unitId: 'p0', path, cost: count }],
          rate,
        );
        const [move] = tracks;
        if (move?.kind !== 'move') throw new Error('expected movement');
        const distanceAt = (elapsed: number) =>
          move.ease(elapsed / move.duration) * move.curve.length;
        expect(distanceAt(0)).toBe(0);
        expect(distanceAt(move.duration)).toBeCloseTo(move.curve.length, 9);
        if (rate === 1) expect(distanceAt(300) - distanceAt(200)).toBeCloseTo(100 / 280, 9);
        else expect(move.duration).toBeCloseTo(count * 110 * rate, 9);
        expect(sounds).toHaveLength(Math.ceil(move.curve.length));
        sounds.forEach((sound, i) => {
          expect(sound.key).toBe('step');
          expect(distanceAt(sound.at - move.start)).toBeCloseTo(i, 9);
        });
      }
    }
  });

  it('preserves the forced slide clock, easing and struck stance without footsteps', () => {
    for (const rate of [1, 0.02]) {
      const { tracks, sounds, cursor } = run(
        [{ type: 'unitPushed', unitId: 'p0', to: { x: 4, y: 3 } }],
        rate,
      );
      const [move, hit] = tracks;
      if (move?.kind !== 'move' || hit?.kind !== 'pose') throw new Error('expected slide and hit');
      expect(move.gait).toBe('slide');
      expect(move.duration).toBe(220 * rate);
      expect(move.ease(0.5)).toBe(0.75);
      expect(hit.clip).toBe('hit');
      expect(hit.duration).toBe(move.duration);
      expect(cursor).toBe(1000 + 220 * rate);
      expect(sounds).toEqual([]);
    }
  });

  it('winds up, releases, sends something across and recovers for a ranged cast', () => {
    const { tracks } = run([
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'fire_jab',
        target: { x: 5, y: 3 },
        tiles: [{ x: 5, y: 3 }],
      },
    ]);
    const poses = tracks.filter((t) => t.kind === 'pose');
    expect(poses).toHaveLength(4);
    expect(poses[0]?.start).toBe(1000);
    expect(poses[0]?.duration).toBe(TIMING.windUp);
    expect(poses[1]?.start).toBe(1000 + TIMING.windUp);
    // The caster turns to face the target on the right.
    expect(poses.every((p) => p.facing === 1)).toBe(true);
    // No idle gap while the projectile travels; the extended pose is held
    // through impact before the actor eases back onto their planted feet.
    for (let i = 1; i < poses.length; i++) {
      const previous = poses[i - 1];
      expect(poses[i]?.start).toBe((previous?.start ?? 0) + (previous?.duration ?? 0));
      expect(poses[i]?.offset.from).toEqual(previous?.offset.to);
    }

    const emitters = tracks.filter((t) => t.kind === 'emitter');
    expect(emitters.length).toBeGreaterThan(0);
    // Something travels: an emitter starts at release and covers the flight.
    const fire = attackMotion('fx.fire.jab', false, false);
    const releaseAt = 1000 + TIMING.windUp + TIMING.release * fire.release * fire.launch;
    expect(emitters.some((e) => e.start === releaseAt)).toBe(true);
    // The impact lands after the flight, never before the release.
    const impact = Math.max(...emitters.map((e) => e.start));
    expect(impact).toBeGreaterThan(releaseAt);
    expect(tracks.some((t) => t.kind === 'shake')).toBe(true);
  });

  it('stretches travel particles to the flight and sends a travel stroke out and back', () => {
    const { tracks } = run([
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'water_whip',
        target: { x: 5, y: 3 },
        tiles: [{ x: 5, y: 3 }],
      },
    ]);
    const water = attackMotion('fx.water.whip', false, false);
    const releaseAt = 1000 + TIMING.windUp + TIMING.release * water.release * water.launch;
    const emitters = tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
    const travel = emitters.filter((t) => t.start === releaseAt);
    const heads = travel.filter((t) => t.def.kind === 'particles');
    const whips = travel.filter((t) => t.def.kind === 'strokes');
    expect(heads.length).toBeGreaterThan(0);
    expect(whips.length).toBeGreaterThan(0);
    const flight = heads[0]?.def.duration ?? 0;
    expect(flight).toBeGreaterThanOrEqual(TIMING.travelMin);
    // Particles spawn across the whole flight; the whip reaches the target at its midpoint.
    for (const track of heads) {
      if (track.def.kind !== 'particles') continue;
      expect(track.def.duration).toBe(flight);
      expect(track.def.delay[1]).toBeLessThanOrEqual(flight);
    }
    for (const track of whips) expect(track.def.duration).toBe(flight * 2);
    // The hit lands as the whip arrives: the impact opens half the hold after the flight.
    const impactAt = Math.min(...emitters.filter((t) => t.start > releaseAt).map((t) => t.start));
    const hold = resolveFx('fx.water.whip').hitStop;
    expect(Math.abs(impactAt - (releaseAt + flight + hold / 2))).toBeLessThan(1);
  });

  it('lunges further for a melee hit and faces the target', () => {
    const { tracks } = run([
      { type: 'abilityUsed', unitId: 'p0', abilityId: 'strike', target: { x: 5, y: 3 }, tiles: [] },
    ]);
    const release = tracks.filter((t) => t.kind === 'pose')[1];
    expect(release?.clip).toBe('melee');
    expect(release?.offset.to.x ?? 0).toBeGreaterThan(0.3);
  });

  it.each([
    [{ x: 0, y: -1 }, 'screenUp'],
    [{ x: 0, y: 1 }, 'screenDown'],
  ] as const)(
    'carries the projected %s contact variant through every Riko melee pose',
    (target, meleeDirection) => {
      const tracks = choreograph({
        content,
        events: [{ type: 'abilityUsed', unitId: 'p0', abilityId: 'strike', target, tiles: [] }],
        unitsBefore: [
          { ...unit('p0', 0, 0), sprite: 'unit.non.riko', hp: 20 },
          {
            ...unit('e0', target.x, target.y),
            faction: 'enemy',
            sprite: 'unit.enemy.thug',
            hp: 20,
          },
        ],
        cursor: 1000,
        rate: 1,
        pushIndex: 0,
        projection: 'orthographic',
      }).tracks.filter(
        (track): track is PoseTrack => track.kind === 'pose' && track.unitId === 'p0',
      );
      expect(tracks.length).toBeGreaterThanOrEqual(3);
      expect(tracks.every((track) => track.meleeDirection === meleeDirection)).toBe(true);
    },
  );

  it('flashes and recoils the hit unit at the impact, then pops the number', () => {
    const { tracks } = run([
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'fire_jab',
        target: { x: 5, y: 3 },
        tiles: [{ x: 5, y: 3 }],
      },
      {
        type: 'damaged',
        unitId: 'e0',
        amount: 9,
        crit: false,
        damageType: 'fire',
        sourceId: 'p0',
      },
    ]);
    const flash = tracks.find((t) => t.kind === 'flash');
    const recoil = tracks.filter((t): t is PoseTrack => t.kind === 'pose' && t.unitId === 'e0');
    const number = tracks.find((t) => t.kind === 'floater');
    expect(flash).toBeDefined();
    expect(recoil).toHaveLength(3);
    expect(number?.text).toBe('9');
    // The flash starts at the impact; the recoil and the number wait out the hold.
    expect(recoil[0]?.start).toBe(flash?.start);
    expect(recoil[0]?.clip).toBe('hit');
    expect(recoil[0]?.offset.to).toEqual({ x: 0, y: 0 });
    expect(recoil[1]?.start).toBe((recoil[0]?.start ?? 0) + (recoil[0]?.duration ?? 0));
    expect(number?.start ?? 0).toBeGreaterThan(flash?.start ?? Infinity);
    // The recoil pushes the target away from the caster, to the right.
    expect(recoil[1]?.offset.to.x ?? 0).toBeGreaterThan(0);
  });

  it('holds the cursor for the hit-stop', () => {
    const cast: GameEvent = {
      type: 'abilityUsed',
      unitId: 'p0',
      abilityId: 'fire_jab',
      target: { x: 5, y: 3 },
      tiles: [{ x: 5, y: 3 }],
    };
    const { cursor } = run([cast]);
    const { cursor: reduced } = run([cast], 0.02);
    expect(cursor).toBeGreaterThan(1000 + TIMING.windUp + TIMING.release);
    expect(reduced - 1000).toBeLessThan(40);
  });

  it('spawns no particles under reduce motion but keeps the numbers', () => {
    const { tracks } = run(
      [
        {
          type: 'abilityUsed',
          unitId: 'p0',
          abilityId: 'fire_jab',
          target: { x: 5, y: 3 },
          tiles: [{ x: 5, y: 3 }],
        },
        {
          type: 'damaged',
          unitId: 'e0',
          amount: 9,
          crit: false,
          damageType: 'fire',
          sourceId: 'p0',
        },
      ],
      0.02,
    );
    expect(tracks.some((t) => t.kind === 'emitter')).toBe(false);
    expect(tracks.some((t) => t.kind === 'shake')).toBe(false);
    expect(tracks.some((t) => t.kind === 'floater')).toBe(true);
  });

  it('is deterministic', () => {
    const events: GameEvent[] = [
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'fire_jab',
        target: { x: 5, y: 3 },
        tiles: [{ x: 5, y: 3 }],
      },
    ];
    expect(run(events)).toEqual(run(events));
  });

  it('fades a fallen unit and dusts the ground', () => {
    const { tracks } = run([{ type: 'unitDied', unitId: 'e0' }]);
    const ko = tracks.find((t) => t.kind === 'pose');
    expect(ko?.clip).toBe('ko');
    expect(ko?.alpha?.to).toBe(0.35);
    expect(tracks.some((t) => t.kind === 'emitter')).toBe(true);
    expect(tracks.find((t) => t.kind === 'floater')?.text).toBe('down');
  });

  /* ---------------------------------------------------------------- */
  /* Sound cues                                                        */
  /* ---------------------------------------------------------------- */

  it('cue a footstep a tile along a walk', () => {
    const { sounds } = run([
      {
        type: 'unitMoved',
        unitId: 'p0',
        path: [
          { x: 2, y: 3 },
          { x: 3, y: 3 },
        ],
        cost: 2,
      },
    ]);
    expect(sounds.map((s) => s.key)).toEqual(['step', 'step']);
    expect(sounds.map((s) => s.at)).toEqual([1000, 1340]);
    // Different seeds, or a walk machine-guns one sample.
    expect(sounds[0]?.seed).not.toBe(sounds[1]?.seed);
  });

  it("cue an ability's own fx key at the release, not the wind-up", () => {
    const { sounds } = run([
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'fire_jab',
        target: { x: 5, y: 3 },
        tiles: [],
      },
    ]);
    const cast = sounds.find((s) => s.key === 'fx.fire.jab');
    expect(cast, 'the cast should be cued by its fx key').toBeDefined();
    const fire = attackMotion('fx.fire.jab', false, false);
    expect(cast?.at).toBe(1000 + TIMING.windUp + TIMING.release * fire.release * fire.launch);
  });

  it('cue the hit where the projectile lands, not where it was thrown', () => {
    const { sounds, tracks } = run([
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'fire_jab',
        target: { x: 5, y: 3 },
        tiles: [],
      },
      { type: 'damaged', unitId: 'e0', amount: 6, crit: false, damageType: 'fire', sourceId: 'p0' },
    ]);
    const hit = sounds.find((s) => s.key === 'hit');
    const flash = tracks.find((t) => t.kind === 'flash');
    expect(hit).toBeDefined();
    // The same instant the flash is on: the sound belongs to the impact.
    expect(hit?.at).toBe(flash?.start);
    // And the flight is real, so the hit is later than the cast.
    const cast = sounds.find((s) => s.key === 'fx.fire.jab');
    expect(hit?.at).toBeGreaterThan(cast?.at ?? 0);
  });

  it('cue going down', () => {
    const { sounds } = run([{ type: 'unitDied', unitId: 'e0' }]);
    expect(sounds.map((s) => s.key)).toContain('ko');
  });

  it('stay in time order, so the bus can schedule them as they come', () => {
    const { sounds } = run([
      {
        type: 'abilityUsed',
        unitId: 'p0',
        abilityId: 'fire_jab',
        target: { x: 5, y: 3 },
        tiles: [],
      },
      { type: 'damaged', unitId: 'e0', amount: 6, crit: false, damageType: 'fire', sourceId: 'p0' },
      { type: 'unitDied', unitId: 'e0' },
    ]);
    const times = sounds.map((s) => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('still cue under reduce motion, where the particles do not', () => {
    // Motion is what the setting is about. A silent fight is not an
    // accessibility win, and the bus coalesces the collapsed clump.
    const { sounds, tracks } = run(
      [
        {
          type: 'abilityUsed',
          unitId: 'p0',
          abilityId: 'fire_jab',
          target: { x: 5, y: 3 },
          tiles: [],
        },
      ],
      0.02,
    );
    expect(tracks.some((t) => t.kind === 'emitter')).toBe(false);
    expect(sounds.some((s) => s.key === 'fx.fire.jab')).toBe(true);
  });
});

it('projects attack and reaction poses without changing timing, particles or sound', () => {
  const events: GameEvent[] = [
    {
      type: 'abilityUsed',
      unitId: 'p0',
      abilityId: 'fire_jab',
      target: { x: 4, y: 6 },
      tiles: [{ x: 4, y: 6 }],
    },
    { type: 'damaged', damageType: 'fire', unitId: 'e0', amount: 5, sourceId: 'p0', crit: false },
  ];
  const input = {
    content,
    events,
    unitsBefore: [unit('p0', 4, 4), unit('e0', 4, 6)],
    cursor: 0,
    rate: 1,
    pushIndex: 0,
  };
  const flat = choreograph(input);
  const oblique = choreograph({ ...input, projection: 'oblique' });
  expect(oblique.cursor).toBe(flat.cursor);
  expect(oblique.sounds).toEqual(flat.sounds);
  // Attachments are projected presentation snapshots. Logical particle paths,
  // emitter definitions, seeds and clocks still match exactly.
  const logicalTracks = (tracks: readonly AnyTrack[]) =>
    tracks
      .filter((t) => t.kind !== 'pose')
      .map((t) => (t.kind === 'emitter' ? { ...t, attachments: undefined } : t));
  expect(logicalTracks(oblique.tracks)).toEqual(logicalTracks(flat.tracks));
  const flatPoses = flat.tracks.filter((t) => t.kind === 'pose');
  const poses = oblique.tracks.filter((t) => t.kind === 'pose');
  expect(poses.map(({ offset: _offset, facing: _facing, ...rest }) => rest)).toEqual(
    flatPoses.map(({ offset: _offset, facing: _facing, ...rest }) => rest),
  );
  const attacks = poses.filter((t) => t.unitId === 'p0');
  expect(attacks.every((t) => t.facing === -1)).toBe(true);
  expect(attacks.some((t) => t.offset.to.x < 0 && t.offset.to.y > 0)).toBe(true);
  const recoil = poses.filter((t) => t.unitId === 'e0');
  expect(recoil.some((t) => t.offset.to.x < 0 && t.offset.to.y > 0)).toBe(true);
});
