import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Ability, ContentIndex, GameEvent, Unit } from '../../core/types';
import { resolveFx } from '../../content/fx';
import type { SheetClips } from '../../render/sheets/store';
import { HIT_SETTLE_MS, TIMING, choreograph, hitSpan, knockoutSpan } from './choreography';
import { HEADINGS, hitClip } from '../../content/assets/clips';
import { attackMotion } from './attackMotion';
import { enemyScale } from './actorScale';
import { Timeline } from './timeline';
import { STROLL_RAMP_MS } from './stroll';
import type { AnyTrack, EmitterTrack, PoseTrack } from './timeline';
import { PARTICLE_STRIDE, sampleParticles } from '../../render/fx/simulate';
import { Animator } from '../animator';
import { frameIndex, resolveClip } from '../../render/sheets/resolveClip';

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
    ['driller_slam', { ...waterWhip, id: 'driller_slam', fx: 'fx.enemy.slam', range: 2 }],
    ['driller_debris', { ...waterWhip, id: 'driller_debris', fx: 'fx.enemy.debris', range: 8 }],
  ]),
} as unknown as ContentIndex;

const unit = (id: string, x: number, y: number): Unit =>
  ({ id, pos: { x, y }, faction: 'party', size: 1 }) as unknown as Unit;

const roster = [unit('p0', 1, 3), unit('e0', 5, 3)];

function run(events: GameEvent[], rate = 1) {
  return choreograph({ content, events, unitsBefore: roster, cursor: 1000, rate, pushIndex: 0 });
}

describe('timed bare legacy clips', () => {
  const holds = {
    cast: [140, 140, 160, 120, 100, 120, 180, 240],
    hit: [100, 120, 140, 180],
    ko: [120, 120, 140, 160, 180, 220, 260, 360],
  } as const;
  const clips = Object.fromEntries(
    Object.entries(holds).map(([clip, frameMs]) => [
      clip,
      {
        frames: frameMs.map((_, index) => `unit.enemy.driller/${clip}/${index}`),
        fps: 8,
        loop: false,
        frameMs,
      },
    ]),
  ) as SheetClips;
  const driller = {
    ...unit('driller', 1, 3),
    faction: 'enemy' as const,
    sprite: 'unit.enemy.driller',
    hp: 80,
    base: { maxHp: 80 },
  } as Unit;
  const victim = { ...unit('victim', 5, 3), hp: 20, base: { maxHp: 20 } } as Unit;
  const play = (events: GameEvent[]) =>
    choreograph({
      content,
      events,
      unitsBefore: [driller, victim],
      cursor: 1000,
      rate: 1,
      pushIndex: 0,
      clipsOf: (sprite) => (sprite === driller.sprite ? clips : undefined),
    });

  it('aligns a no-travel impact with cast frame 3 contact', () => {
    const out = play([
      {
        type: 'abilityUsed',
        unitId: driller.id,
        abilityId: 'driller_slam',
        target: victim.pos,
        tiles: [victim.pos],
      },
      {
        type: 'damaged',
        unitId: victim.id,
        amount: 4,
        crit: false,
        damageType: 'fire',
        sourceId: driller.id,
      },
    ]);
    const cast = out.tracks.filter(
      (track): track is PoseTrack => track.kind === 'pose' && track.unitId === driller.id,
    );
    const flash = out.tracks.find((track) => track.kind === 'flash' && track.unitId === victim.id);
    const duration = holds.cast.reduce((sum, ms) => sum + ms, 0);
    const contact = holds.cast.slice(0, 3).reduce((sum, ms) => sum + ms, 0);
    expect(Math.max(...cast.map((track) => track.start + track.duration))).toBe(1000 + duration);
    expect(flash?.start).toBe(1000 + contact);
    expect(cast.map((track) => track.clipTimeOffset)).toEqual([0, contact, contact + 340]);
  });

  it('lands a travel recipe at arrival and never replays a timed cast cel', () => {
    const events: GameEvent[] = [
      {
        type: 'abilityUsed',
        unitId: driller.id,
        abilityId: 'driller_debris',
        target: victim.pos,
        tiles: [victim.pos],
      },
      {
        type: 'damaged',
        unitId: victim.id,
        amount: 4,
        crit: false,
        damageType: 'earth',
        sourceId: driller.id,
      },
    ];
    const out = play(events);
    const travel = out.tracks.find(
      (track): track is EmitterTrack =>
        track.kind === 'emitter' &&
        track.def.kind === 'particles' &&
        track.def.shape === 'projectile',
    );
    const flash = out.tracks.find((track) => track.kind === 'flash' && track.unitId === victim.id);
    expect(travel).toBeDefined();
    // Within a millisecond: the emitter's duration is rounded, the flash is not.
    expect(flash?.start).toBeCloseTo((travel?.start ?? 0) + (travel?.def.duration ?? 0), 0);

    const animator = new Animator(content, {
      motionReduced: () => false,
      sheetClips: (sprite) => (sprite === driller.sprite ? clips : undefined),
    });
    animator.push(1000, events, [driller, victim]);
    const resolved = resolveClip(clips, 'cast');
    if (!resolved) throw new Error('Expected timed cast');
    const indices = Array.from({ length: 80 }, (_, step) => {
      const pose = animator.unitPose(1000 + step * 25, driller.id, driller.sprite);
      return pose?.clip === 'cast' ? frameIndex(resolved, pose.clipTime, pose.frame) : undefined;
    }).filter((index): index is number => index !== undefined);
    expect(indices.length).toBeGreaterThan(0);
    expect(indices.every((index, i) => i === 0 || index >= indices[i - 1]!)).toBe(true);
  });

  it('keeps timed cast offsets when melee falls back to cast', () => {
    const meleeContent = {
      abilities: new Map<string, Ability>([['strike', strike]]),
    } as unknown as ContentIndex;
    const out = choreograph({
      content: meleeContent,
      events: [
        {
          type: 'abilityUsed',
          unitId: driller.id,
          abilityId: 'strike',
          target: { x: 2, y: 3 },
          tiles: [],
        },
      ],
      unitsBefore: [driller, { ...victim, pos: { x: 2, y: 3 } }],
      cursor: 1000,
      rate: 1,
      pushIndex: 0,
      clipsOf: (sprite) => (sprite === driller.sprite ? clips : undefined),
    });
    const poses = out.tracks.filter(
      (track): track is PoseTrack => track.kind === 'pose' && track.unitId === driller.id,
    );
    expect(poses.map((pose) => pose.clipTimeOffset)).toEqual([0, 440, 780]);
  });

  it('plays a timed hit through and a timed KO through its held last frame', () => {
    const hit = play([
      {
        type: 'damaged',
        unitId: driller.id,
        amount: 4,
        crit: false,
        damageType: 'fire',
        sourceId: victim.id,
      },
    ]).tracks.find((track): track is PoseTrack => track.kind === 'pose' && track.clip === 'hit');
    expect(hit?.duration).toBe(holds.hit.reduce((sum, ms) => sum + ms, 0));
    const ko = play([{ type: 'unitDied', unitId: driller.id }]).tracks.find(
      (track): track is PoseTrack => track.kind === 'pose' && track.clip === 'ko',
    );
    expect(ko?.duration).toBe(holds.ko.reduce((sum, ms) => sum + ms, 0));
    expect(ko?.alpha).toBeUndefined();
  });
});

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

  it('centres damage and status cues on a square size-2 footprint', () => {
    const tracks = play([
      {
        type: 'damaged',
        unitId: boss.id,
        amount: 4,
        crit: false,
        damageType: 'fire',
        sourceId: caster.id,
      },
      { type: 'statusApplied', unitId: boss.id, status: 'burning', duration: 2 },
    ]).tracks;
    const damage = tracks.find((track) => track.kind === 'floater');
    const status = tracks.find((track): track is EmitterTrack => track.kind === 'emitter');

    // Floaters use the equivalent cell-like origin because renderers add half a tile.
    expect(damage?.kind === 'floater' && damage.pos).toEqual({ x: 5.5, y: 3.5 });
    expect(status?.from).toEqual({ x: 6, y: 4 });
    expect(status?.to).toEqual({ x: 6, y: 4 });
  });

  it('matches route enemy torso sockets to the visible adult scale at either motion rate', () => {
    for (const name of ['thug', 'bruiser', 'slinger', 'quarrybender', 'crossbow']) {
      const target = { ...boss, sprite: `unit.enemy.${name}`, size: 1 as const };
      for (const rate of [1, 0.02]) {
        const tracks = play([cast()], [caster, target], rate).tracks;
        if (rate < 1) {
          // Reduced motion intentionally suppresses emitters, retaining the
          // body poses and rule-owned impact instead of launching particles.
          expect(tracks.some((t) => t.kind === 'emitter')).toBe(false);
          continue;
        }
        const travel = tracks.find(
          (t): t is EmitterTrack => t.kind === 'emitter' && t.attachments?.to?.socket === 'torso',
        );
        expect(travel?.attachments?.to).toMatchObject({
          sprite: target.sprite,
          pos: target.pos,
          // A G enemy (ADR 0059, ADR 0062) stands at the party's scale on `play`'s oblique map.
          scale: enemyScale(target.sprite, 1, 'oblique'),
          size: 1,
        });
        expect(travel?.to).toEqual({ x: 5.5, y: 3.5 });
      }
    }
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
    // A puff at each footfall, trailing, so the walk's clock is its own.
    expect(kinds(tracks)).toEqual(['move', 'emitter', 'emitter']);
    for (const puff of tracks.slice(1))
      expect(puff.kind === 'emitter' && puff.trailing, 'a footstep puff trails').toBe(true);
    expect(tracks[0]?.start).toBe(1000);
    const duration = 2 * TIMING.combatWalkStep + STROLL_RAMP_MS;
    expect(tracks[0]?.duration).toBe(duration);
    expect(cursor).toBe(1000 + duration);
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
    expect(move.duration).toBe(TIMING.strollStep * 2 + STROLL_RAMP_MS);
    expect(cursor).toBe(1000 + move.duration);
    expect(move.duration).toBeGreaterThan(TIMING.step * 4);
  });

  it('keeps reduced-motion party footsteps inside the abbreviated walk', () => {
    const path = Array.from({ length: 10 }, (_, i) => ({ x: 4 + i, y: 7 }));
    const { tracks, sounds } = run(
      [
        {
          type: 'partyWalked',
          unitId: 'leader',
          from: { x: 3, y: 7 },
          path,
        },
      ],
      0.02,
    );
    const [move] = tracks;
    if (move?.kind !== 'move') throw new Error('expected a move track');
    expect(move.duration).toBe(TIMING.step * path.length * 0.02);
    expect(sounds).toHaveLength(Math.ceil(move.curve.length));
    for (const sound of sounds) {
      expect(sound.at).toBeGreaterThanOrEqual(move.start);
      expect(sound.at).toBeLessThanOrEqual(move.start + move.duration);
    }
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
        if (rate === 1)
          expect(distanceAt(300) - distanceAt(200)).toBeCloseTo(100 / TIMING.combatWalkStep, 9);
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
      // No footsteps: one thud where the slide stops.
      expect(sounds.map((s) => [s.key, s.at])).toEqual([['land', 1000 + 220 * rate]]);
      // The landing dust trails at full motion and is gone under reduce motion.
      const dust = tracks.filter((t) => t.kind === 'emitter');
      if (rate === 1) {
        expect(dust.length).toBeGreaterThan(0);
        for (const puff of dust) {
          expect(puff.start).toBe(1220);
          expect(puff.kind === 'emitter' && puff.trailing).toBe(true);
        }
      } else expect(dust).toEqual([]);
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

  it('plays a G hit and knockout out in full once the sheet is in, and the legacy ones as before (ADR 0059, ADR 0063)', () => {
    const kaya = { ...unit('p0', 1, 3), sprite: 'unit.fire.kaya', hp: 20 } as Unit;
    const thug = {
      ...unit('e0', 5, 3),
      faction: 'enemy',
      sprite: 'unit.enemy.thug',
      hp: 20,
    } as Unit;
    // Kaya's knockouts arrive with her sheet, as the store fetches them.
    const kayaClips = JSON.parse(
      readFileSync('public/art/units/kaya-g-clips.json', 'utf8'),
    ) as SheetClips;
    const loaded = (sprite: string) => (sprite === kaya.sprite ? kayaClips : undefined);
    const at = (events: GameEvent[], rate = 1, clipsOf: typeof loaded | null = loaded) =>
      choreograph({
        content,
        events,
        unitsBefore: [kaya, thug],
        cursor: 1000,
        rate,
        pushIndex: 0,
        ...(clipsOf ? { clipsOf } : {}),
      });
    const poses = (events: GameEvent[], rate = 1, clipsOf: typeof loaded | null = loaded) =>
      at(events, rate, clipsOf).tracks.filter((t): t is PoseTrack => t.kind === 'pose');
    const end = (tracks: readonly PoseTrack[]) =>
      Math.max(...tracks.map((t) => t.start + t.duration));

    const blow: GameEvent = {
      type: 'damaged',
      unitId: 'p0',
      amount: 4,
      crit: false,
      damageType: 'fire',
      sourceId: 'e0',
    };
    // Kaya's G hit (ADR 0063) plays once, in full, from the contact, feet
    // planted: 400 ms and her 80 ms hit-stop, and no shove.
    expect(hitSpan(kayaClips)).toBe(480);
    expect(hitSpan(undefined)).toBe(0);
    const flinch = poses([blow], 1, loaded);
    expect(flinch).toHaveLength(1);
    expect(flinch[0]).toMatchObject({ clip: 'hit', start: 1000, duration: 480 });
    const flash = at([blow]).tracks.find((track) => track.kind === 'flash');
    expect(flash?.start).toBe(1000);
    expect(flinch[0]?.start).toBeGreaterThanOrEqual(1000);
    expect(flinch[0]?.offset).toEqual({ from: { x: 0, y: 0 }, to: { x: 0, y: 0 } });
    // A push under it does not restart it; a push alone plays one through.
    const shove: GameEvent = { type: 'unitPushed', unitId: 'p0', to: { x: 0, y: 3 } };
    expect(poses([blow, shove])).toHaveLength(1);
    expect(poses([shove])).toMatchObject([{ clip: 'hit', start: 1000, duration: 480 }]);
    expect(poses([shove], 1, null)).toMatchObject([
      { clip: 'hit', start: 1000, duration: TIMING.step * 2 },
    ]);
    // The thug, and Kaya before her sheet is in, keep the legacy hit and recoil.
    for (const [event, clipsOf] of [
      [{ ...blow, unitId: 'e0', sourceId: 'p0' }, loaded],
      [blow, null],
    ] as const) {
      const hit = poses([event], 1, clipsOf);
      expect(hit).toHaveLength(2);
      expect(hit.every((t) => t.clip === 'hit')).toBe(true);
      expect(end(hit)).toBeCloseTo(1000 + (TIMING.recoilOut + TIMING.recoilBack));
    }

    const span = knockoutSpan(kayaClips);
    expect(knockoutSpan(undefined)).toBe(0);
    const died: GameEvent = { type: 'unitDied', unitId: 'p0' };
    const ko = poses([died], 1, loaded).find((t) => t.clip === 'ko');
    expect(ko?.duration).toBe(span);
    expect(ko?.duration).toBeGreaterThan(TIMING.ko);
    // It falls in its own drawing: no sink that would jump back when it ends,
    // at full strength, and is marked fallen, which fades it, once it lies still.
    expect(ko?.offset.to).toEqual({ x: 0, y: 0 });
    expect(ko?.alpha).toBeUndefined();
    const down = at([died]).health.find((h) => h.fallen);
    expect(down?.at).toBe((ko?.start ?? 0) + (ko?.duration ?? 0));

    const lethalG = poses([{ ...blow, amount: 20 }, died], 1, loaded);
    const lethalHit = lethalG.find((track) => track.clip === 'hit');
    const lethalKo = lethalG.find((track) => track.clip === 'ko');
    expect(lethalHit).toMatchObject({ start: 1000, duration: 480 });
    expect(lethalKo?.start).toBe(1480);
    expect(lethalKo?.start).toBeGreaterThan(lethalHit?.start ?? 0);
    // A G knockout remains upright in presentation until its authored fall is
    // complete; delaying its start behind the hit therefore delays `fallen`
    // to the end of both clips, not merely to the new KO start.
    expect(at([{ ...blow, amount: 20 }, died]).health.find((h) => h.fallen)?.at).toBe(
      (lethalKo?.start ?? 0) + (lethalKo?.duration ?? 0),
    );
    // The thug, and Kaya before her sheet is in, keep the legacy knockout.
    for (const [event, clipsOf] of [
      [{ type: 'unitDied', unitId: 'e0' }, loaded],
      [died, null],
    ] as const) {
      const legacy = poses([event], 1, clipsOf).find((t) => t.clip === 'ko');
      expect(legacy?.duration).toBe(TIMING.ko);
      expect(legacy?.alpha).toEqual({ from: 1, to: 0.35 });
      expect(at([event], 1, clipsOf).health.find((h) => h.fallen)?.at).toBe(1000);
    }
    // Reduce motion collapses the clip with everything else.
    const reduced = poses([died], 0.02, loaded).find((t) => t.clip === 'ko');
    expect(reduced?.duration).toBeCloseTo(span * 0.02);
  });

  /* ---------------------------------------------------------------- */
  /* Sound cues                                                        */
  /* ---------------------------------------------------------------- */

  it('lands ledge damage with the shove and keeps a harmless stumble quiet', () => {
    const pushed: GameEvent = { type: 'unitPushed', unitId: 'p0', to: { x: 3, y: 3 } };
    const fall = (amount: number): GameEvent => ({
      type: 'damaged',
      unitId: 'p0',
      amount,
      crit: false,
      damageType: 'pure',
      sourceId: null,
      cause: 'ledgeDrop',
    });

    const harmful = run([fall(3), pushed]);
    const move = harmful.tracks.find((track) => track.kind === 'move');
    const landingAt = (move?.start ?? 0) + (move?.duration ?? 0);
    expect(harmful.health).toContainEqual(expect.objectContaining({ unitId: 'p0', at: landingAt }));
    expect(harmful.sounds).toContainEqual(expect.objectContaining({ key: 'hit', at: landingAt }));
    expect(
      harmful.tracks.find((track) => track.kind === 'flash' && track.unitId === 'p0')?.start,
    ).toBe(landingAt);

    const harmless = run([fall(0), pushed]);
    expect(harmless.sounds.some((sound) => sound.key === 'hit')).toBe(false);
    expect(
      harmless.tracks.some(
        (track) => (track.kind === 'flash' || track.kind === 'pose') && track.unitId === 'p0',
      ),
    ).toBe(false);
  });

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
    expect(sounds.map((s) => s.at)).toEqual([
      1000,
      1000 + TIMING.combatWalkStep + STROLL_RAMP_MS / 2,
    ]);
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

describe('G hit timing', () => {
  const kayaClips = JSON.parse(
    readFileSync('public/art/units/kaya-g-clips.json', 'utf8'),
  ) as SheetClips;
  const kaya = {
    ...unit('p0', 1, 3),
    sprite: 'unit.fire.kaya',
    hp: 20,
    base: { maxHp: 20 },
  } as Unit;
  const attacker = {
    ...unit('e0', 5, 3),
    faction: 'enemy' as const,
    sprite: 'unit.enemy.thug',
    hp: 20,
    base: { maxHp: 20 },
  } as Unit;
  const loaded = (sprite: string) => (sprite === kaya.sprite ? kayaClips : undefined);
  const play = (events: GameEvent[], rate = 1) =>
    choreograph({
      content,
      events,
      unitsBefore: [kaya, attacker],
      cursor: 1000,
      rate,
      pushIndex: 0,
      clipsOf: loaded,
    });
  const attack = (): GameEvent => ({
    type: 'abilityUsed',
    unitId: attacker.id,
    abilityId: 'fire_jab',
    target: kaya.pos,
    tiles: [kaya.pos],
  });
  const damage = (amount: number): GameEvent => ({
    type: 'damaged',
    unitId: kaya.id,
    amount,
    crit: false,
    damageType: 'fire',
    sourceId: attacker.id,
  });
  const pose = (tracks: readonly AnyTrack[], clip: string) =>
    tracks.find(
      (track): track is PoseTrack =>
        track.kind === 'pose' && track.unitId === kaya.id && track.clip === clip,
    );

  it('pre-rolls a pending lethal G hit after the attack wind-up and starts KO at the hit end', () => {
    const out = play([attack(), damage(20), { type: 'unitDied', unitId: kaya.id }]);
    const hit = pose(out.tracks, 'hit');
    const ko = pose(out.tracks, 'ko');
    const flash = out.tracks.find((track) => track.kind === 'flash' && track.unitId === kaya.id);
    expect(hit).toBeDefined();
    expect(flash).toBeDefined();
    // The lead is the clip's own first-frame (stance) time, not a fixed number.
    const lead = Math.max(
      ...HEADINGS.map((heading) => kayaClips[hitClip(heading)]?.frameMs?.[0] ?? 0),
    );
    expect(lead).toBeGreaterThan(0);
    expect(hit?.start).toBe((flash?.start ?? 0) - lead);
    expect(hit?.start).toBeGreaterThan(1000);
    expect(ko?.start).toBe((hit?.start ?? 0) + (hit?.duration ?? 0));
  });

  it('bounds lethal G post-contact delay by the hit span after hit-stop', () => {
    const out = play([attack(), damage(20), { type: 'unitDied', unitId: kaya.id }]);
    const ko = pose(out.tracks, 'ko')!;
    const flash = out.tracks.find((track) => track.kind === 'flash' && track.unitId === kaya.id)!;
    const hitStop = resolveFx('fx.fire.jab').hitStop;
    const delay = ko.start - (flash.start + hitStop);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(hitSpan(kayaClips) - hitStop);
  });

  it('keeps the legacy damaged-plus-death KO start at the exact pre-PR time', () => {
    const out = choreograph({
      content,
      events: [damage(4), { type: 'unitDied', unitId: kaya.id }],
      unitsBefore: [kaya, attacker],
      cursor: 1000,
      rate: 1,
      pushIndex: 0,
      clipsOf: () => undefined,
    });
    const ko = out.tracks.find(
      (track): track is PoseTrack =>
        track.kind === 'pose' && track.unitId === kaya.id && track.clip === 'ko',
    );
    // The damage advances the cursor to 1000 + gap; the death then uses
    // max(cursor, hit.at + hitStop), exactly as the pre-PR rule did.
    expect(ko?.start).toBe(1000 + TIMING.gap);
  });

  it('scales the lethal G hit extra delay with reduced motion', () => {
    const extraAt = (rate: number) => {
      const out = play([attack(), damage(20), { type: 'unitDied', unitId: kaya.id }], rate);
      const hit = pose(out.tracks, 'hit')!;
      const ko = pose(out.tracks, 'ko')!;
      const flash = out.tracks.find((track) => track.kind === 'flash' && track.unitId === kaya.id)!;
      expect(ko.start).toBeCloseTo(hit.start + hit.duration, 7);
      return ko.start - (flash.start + resolveFx('fx.fire.jab').hitStop * rate);
    };
    const full = extraAt(1);
    const reduced = extraAt(0.02);
    expect(full).toBeGreaterThan(0);
    expect(reduced).toBeCloseTo(full * 0.02, 7);
    expect(reduced).toBeLessThanOrEqual(10);
  });

  it('shows a plain melee hit for at least 100 ms on each G party sheet', () => {
    const partySheets = [
      ['unit.fire.kaya', 'public/art/units/kaya-g-clips.json'],
      ['unit.water.sura', 'public/art/units/sura-g-clips.json'],
      ['unit.earth.bo', 'public/art/units/bo-g-clips.json'],
    ] as const;

    for (const [sprite, path] of partySheets) {
      const clips = JSON.parse(readFileSync(path, 'utf8')) as SheetClips;
      const victim = {
        ...unit(sprite, 5, 3),
        sprite,
        hp: 20,
        base: { maxHp: 20 },
      } as Unit;
      const loaded = (requested: string) => (requested === sprite ? clips : undefined);
      const blow: GameEvent = {
        type: 'damaged',
        unitId: victim.id,
        amount: 4,
        crit: false,
        damageType: 'physical',
        sourceId: attacker.id,
      };
      const out = choreograph({
        content,
        events: [blow],
        unitsBefore: [victim, attacker],
        cursor: 1000,
        rate: 1,
        pushIndex: 0,
        clipsOf: loaded,
      });
      const track = out.tracks.find(
        (candidate): candidate is PoseTrack =>
          candidate.kind === 'pose' && candidate.unitId === victim.id && candidate.clip === 'hit',
      );
      expect(track?.duration, `${sprite} plain hit track`).toBeGreaterThanOrEqual(100);

      const animator = new Animator(content, {
        motionReduced: () => false,
        sheetClips: loaded,
      });
      animator.push(1000, [blow], [victim, attacker]);
      const at100ms = animator.unitPose(1100, victim.id, sprite);
      expect(at100ms?.clip, `${sprite} reaction clip`).toBe('hitEast');
      const clip = resolveClip(clips, at100ms?.clip ?? 'hit');
      expect(clip).toBeDefined();
      expect(frameIndex(clip!, at100ms?.clipTime ?? 0, at100ms?.frame)).toBeGreaterThan(0);
    }
  });
});

describe('one-cel hit settle', () => {
  const staticHits = { hit: { frames: ['hit/0'], fps: 8, loop: false } } as unknown as SheetClips;
  const victim = {
    ...unit('victim', 5, 3),
    faction: 'enemy' as const,
    sprite: 'unit.enemy.static',
    hp: 20,
    base: { maxHp: 20 },
  } as Unit;
  const attacker = { ...unit('attacker', 1, 3), hp: 20, base: { maxHp: 20 } } as Unit;
  const events = (lethal = false): GameEvent[] => [
    {
      type: 'abilityUsed',
      unitId: attacker.id,
      abilityId: 'fire_jab',
      target: victim.pos,
      tiles: [victim.pos],
    },
    {
      type: 'damaged',
      unitId: victim.id,
      amount: lethal ? 20 : 4,
      crit: false,
      damageType: 'fire',
      sourceId: attacker.id,
    },
    ...(lethal ? ([{ type: 'unitDied', unitId: victim.id }] as GameEvent[]) : []),
  ];
  const play = (rate = 1, lethal = false) =>
    choreograph({
      content,
      events: events(lethal),
      unitsBefore: [attacker, victim],
      cursor: 1000,
      rate,
      pushIndex: 0,
      clipsOf: (sprite) => (sprite === victim.sprite ? staticHits : undefined),
    });

  it('holds after recoil only inside existing recovery and does not lengthen the batch', () => {
    const baseline = choreograph({
      content,
      events: events(),
      unitsBefore: [attacker, victim],
      cursor: 1000,
      rate: 1,
      pushIndex: 0,
    });
    const out = play();
    const hits = out.tracks.filter(
      (track): track is PoseTrack =>
        track.kind === 'pose' && track.unitId === victim.id && track.clip === 'hit',
    );
    const settle = hits.find(
      (track) => track.offset.from.x === 0 && track.start > (hits[1]?.start ?? Infinity),
    );
    expect(settle?.duration).toBeLessThanOrEqual(HIT_SETTLE_MS);
    expect(settle?.duration).toBeGreaterThan(0);
    expect(out.cursor).toBe(baseline.cursor);
    expect(Math.max(...out.tracks.map((track) => track.start + track.duration))).toBe(
      Math.max(...baseline.tracks.map((track) => track.start + track.duration)),
    );
  });

  it('adds no settle to a sheet with authored directional hit cels', () => {
    const directional = Object.fromEntries([
      ['hit', { frames: ['hit/0'], fps: 8, loop: false }],
      ...HEADINGS.map((heading) => [
        hitClip(heading),
        { frames: ['a', 'b', 'c'], fps: 8, loop: false },
      ]),
    ]) as unknown as SheetClips;
    const run = (clipsOf?: (sprite: string) => SheetClips | undefined) =>
      choreograph({
        content,
        events: events(),
        unitsBefore: [attacker, victim],
        cursor: 1000,
        rate: 1,
        pushIndex: 0,
        ...(clipsOf ? { clipsOf } : {}),
      }).tracks.length;
    expect(run(() => directional)).toBe(run());
    expect(run((sprite) => (sprite === victim.sprite ? staticHits : undefined))).toBe(run() + 1);
  });

  it('adds no settle for reduced motion or a lethal hit', () => {
    const hasPostRecoilSettle = (tracks: readonly AnyTrack[]) => {
      const hits = tracks.filter(
        (track): track is PoseTrack =>
          track.kind === 'pose' && track.unitId === victim.id && track.clip === 'hit',
      );
      return hits.some(
        (track) =>
          track.frame === 0 &&
          track.offset.from.x === 0 &&
          track.offset.from.y === 0 &&
          track.offset.to.x === 0 &&
          track.offset.to.y === 0 &&
          track.start > (hits[1]?.start ?? Infinity),
      );
    };

    expect(hasPostRecoilSettle(play(0.02).tracks)).toBe(false);
    expect(hasPostRecoilSettle(play(1, true).tracks)).toBe(false);
  });
});

describe('feel pass: every table beat is heard, and dust never holds the turn', () => {
  const foe = { ...unit('e0', 5, 3), faction: 'enemy' as const };
  const units = [unit('p0', 1, 3), foe];
  const play = (events: GameEvent[], rate = 1) =>
    choreograph({ content, events, unitsBefore: units, cursor: 1000, rate, pushIndex: 0 });
  const keys = (sounds: readonly { key: string }[]) => sounds.map((s) => s.key);

  it('lands a critical bigger, with a snap and a camera kick; a graze gets neither', () => {
    const hit = (crit: boolean): GameEvent => ({
      type: 'damaged',
      unitId: 'e0',
      amount: 6,
      crit,
      damageType: 'physical',
      sourceId: 'p0',
    });
    const crit = play([hit(true)]);
    expect(keys(crit.sounds)).toEqual(['hit', 'crit']);
    expect(crit.tracks.filter((t) => t.kind === 'shake')).toHaveLength(1);
    const number = crit.tracks.find((t) => t.kind === 'floater');
    expect(number?.kind === 'floater' && number.emphasis).toBeGreaterThan(1);

    const plain = play([hit(false)]);
    expect(keys(plain.sounds)).toEqual(['hit']);
    expect(plain.tracks.some((t) => t.kind === 'shake')).toBe(false);
    const graze = plain.tracks.find((t) => t.kind === 'floater');
    expect(graze?.kind === 'floater' && graze.emphasis).toBeFalsy();

    // Reduce motion keeps the sound and drops the kick.
    const still = play([hit(true)], 0.02);
    expect(keys(still.sounds)).toEqual(['hit', 'crit']);
    expect(still.tracks.some((t) => t.kind === 'shake')).toBe(false);
  });

  it('says whose turn it is: a chime and a ring for the party, a knock for a foe, with the gong', () => {
    const { sounds, tracks, cursor } = play([
      { type: 'roundStarted', round: 2 },
      { type: 'turnStarted', unitId: 'p0', round: 2 },
    ]);
    expect(sounds.map((s) => [s.key, s.at])).toEqual([
      ['round', 1000],
      ['turn', 1000],
    ]);
    const ring = tracks.filter((t): t is EmitterTrack => t.kind === 'emitter');
    expect(ring.length).toBeGreaterThan(0);
    // The ring is the turn beginning, not a flourish after the gong: it starts
    // at the turn's own moment and only trails, so it cannot hold the batch.
    expect(ring.every((t) => t.trailing && t.start === 1000 && t.def.layer === 'under')).toBe(true);
    // Trailing: the turn is playable the moment it starts.
    expect(cursor).toBe(1000);

    const enemy = play([{ type: 'turnStarted', unitId: 'e0', round: 2 }]);
    expect(enemy.sounds.map((s) => [s.key, s.at])).toEqual([['turnEnemy', 1000]]);
    expect(play([{ type: 'turnStarted', unitId: 'e0', round: 2 }], 0.02).tracks).toEqual([]);
  });

  it('never schedules the turn beat past the moment the next action can start', () => {
    const { tracks, sounds, cursor } = play([
      { type: 'roundStarted', round: 2 },
      { type: 'turnStarted', unitId: 'p0', round: 2 },
    ]);
    // Replay the batch as the animator does: every track, then the cursor as a
    // floor. Input opens at `finishesAt`; the AI waits a further 260 ms
    // (`maybeRunAi`). A trailing ring cannot push `finishesAt` out, so any beat
    // scheduled after it lands under an action that has already begun.
    const timeline = new Timeline();
    for (const track of tracks) timeline.add(track);
    timeline.holdUntil(cursor);

    const ring = tracks.find((t): t is EmitterTrack => t.kind === 'emitter');
    if (!ring) throw new Error('expected a turn ring');
    expect(ring.trailing).toBe(true);
    expect(ring.start).toBeLessThanOrEqual(timeline.finishesAt);

    // The chime sounds no later than input opens, so no tap or foe's action
    // pre-empts the sound that says whose turn it is.
    const turn = sounds.find((s) => s.key === 'turn');
    if (!turn) throw new Error('expected a turn chime');
    expect(turn.at).toBeLessThanOrEqual(timeline.finishesAt);
  });

  it('gives statuses, surfaces and the end of a fight a voice', () => {
    const { sounds } = play([
      { type: 'statusApplied', unitId: 'e0', status: 'burning', duration: 2 },
      { type: 'surfaceChanged', pos: { x: 5, y: 3 }, from: null, to: 'fire', label: '' },
      { type: 'surfaceChanged', pos: { x: 6, y: 3 }, from: 'fire', to: null, label: '' },
      { type: 'battleEnded', outcome: 'victory' },
    ]);
    expect(keys(sounds)).toEqual([
      'fx.status.burning',
      'fx.surface.fire',
      'fx.surface.doused',
      'victory',
    ]);
    expect(keys(play([{ type: 'battleEnded', outcome: 'defeat' }]).sounds)).toEqual(['defeat']);
  });

  it('gives lighting and putting out a prop their existing fire and douse cues', () => {
    const events = [
      {
        type: 'propIgnited' as const,
        propId: 'hay-1',
        pos: { x: 5, y: 3 },
        label: 'The Hay Bale catches fire!',
      },
      {
        type: 'propDoused' as const,
        propId: 'hay-1',
        pos: { x: 5, y: 3 },
        label: 'The Hay Bale is put out.',
      },
    ];
    const { sounds, tracks } = play(events);
    const ignition = events[0];
    if (!ignition) throw new Error('expected a prop ignition event');
    const ignitionEmitters = play([ignition]).tracks.filter((track) => track.kind === 'emitter');

    expect(keys(sounds)).toEqual(['fx.surface.fire', 'fx.surface.doused']);
    expect(tracks.filter((track) => track.kind === 'emitter').length).toBeGreaterThanOrEqual(2);
    expect(ignitionEmitters.some((track) => track.def.kind === 'particles')).toBe(true);
    expect(ignitionEmitters.some((track) => track.def.kind === 'strokes')).toBe(false);
  });
});
