import { describe, expect, it } from 'vitest';
import type { Ability, ContentIndex, GameEvent, Unit } from '../../core/types';
import { resolveFx } from '../../content/fx';
import { TIMING, choreograph } from './choreography';
import { attackMotion } from './attackMotion';
import type { AnyTrack, EmitterTrack, PoseTrack } from './timeline';

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
    ['water_whip', waterWhip],
  ]),
} as unknown as ContentIndex;

const unit = (id: string, x: number, y: number): Unit =>
  ({ id, pos: { x, y }, faction: 'party', size: 1 }) as unknown as Unit;

const roster = [unit('p0', 1, 3), unit('e0', 5, 3)];

function run(events: GameEvent[], rate = 1) {
  return choreograph({ content, events, unitsBefore: roster, cursor: 1000, rate, pushIndex: 0 });
}

const kinds = (tracks: readonly AnyTrack[]) => tracks.map((t) => t.kind);

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
  expect(oblique.tracks.filter((t) => t.kind !== 'pose')).toEqual(
    flat.tracks.filter((t) => t.kind !== 'pose'),
  );
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
