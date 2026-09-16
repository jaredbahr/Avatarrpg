import { describe, expect, it } from 'vitest';
import type { Ability, ContentIndex, GameEvent, Unit } from '../../core/types';
import { resolveFx } from '../../content/fx';
import { TIMING, choreograph } from './choreography';
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
  it('walks a move for a step per tile', () => {
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
    expect(tracks[0]?.duration).toBe(TIMING.step * 2);
    expect(cursor).toBe(1000 + TIMING.step * 2);
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
    expect(move.duration).toBe(TIMING.step * 2);
    expect(cursor).toBe(1000 + TIMING.step * 2);
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
    expect(poses).toHaveLength(3);
    expect(poses[0]?.start).toBe(1000);
    expect(poses[0]?.duration).toBe(TIMING.windUp);
    expect(poses[1]?.start).toBe(1000 + TIMING.windUp);
    // The caster turns to face the target on the right.
    expect(poses.every((p) => p.facing === 1)).toBe(true);

    const emitters = tracks.filter((t) => t.kind === 'emitter');
    expect(emitters.length).toBeGreaterThan(0);
    // Something travels: an emitter starts at release and covers the flight.
    const releaseAt = 1000 + TIMING.windUp;
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
    const releaseAt = 1000 + TIMING.windUp;
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
    expect(recoil).toHaveLength(2);
    expect(number?.text).toBe('9');
    // The flash starts at the impact; the recoil and the number wait out the hold.
    expect(recoil[0]?.start ?? 0).toBeGreaterThanOrEqual(flash?.start ?? Infinity);
    expect(number?.start ?? 0).toBeGreaterThan(flash?.start ?? Infinity);
    // The recoil pushes the target away from the caster, to the right.
    expect(recoil[0]?.offset.to.x ?? 0).toBeGreaterThan(0);
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
});
