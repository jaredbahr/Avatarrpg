/**
 * Top-down actions in combat (ADR 0104, #587): an ability plays its own pose in the heading the unit aims,
 * drawn and never mirrored, its damage lands on that heading's hit frame, an ability aimed at the unit itself
 * plays in the heading it already faces, and a knockout falls in the unit's own heading and holds its last cel.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Ability, ContentIndex, GameEvent, Unit } from '../../core/types';
import { authoredForBothSides } from '../../content/assets/clips';
import { resolveAsset, useTopDownStyle } from '../../content/assets/manifest';
import { frameIndex, resolveClip } from '../../render/sheets/resolveClip';
import { withActions, type SheetActions, type SheetClips } from '../../render/sheets/store';
import { Animator } from '../animator';
import { choreograph } from './choreography';
import type { PoseTrack } from './timeline';

const read = <T>(path: string): T => JSON.parse(readFileSync(`public/${path}`, 'utf8')) as T;
const loaded = new Map<string, SheetClips>();
const clipsOf = (sprite: string): SheetClips | undefined => loaded.get(sprite);

const ability = (id: string, fx: string, range: number, shape = 'unit') =>
  ({ id, fx, range, targeting: { shape, allow: 'enemy' } }) as unknown as Ability;
const content = {
  abilities: new Map<string, Ability>(
    [
      ability('fire_jab', 'fx.fire.jab', 5),
      ability('flame_arc', 'fx.fire.arc', 4, 'cone'),
      ability('stone_stance', 'fx.earth.stance', 0, 'self'),
      ability('driller_slam', 'fx.enemy.slam', 2, 'cone'),
      ability('merc_crossbow', 'fx.enemy.crossbow', 8),
    ].map((a) => [a.id, a]),
  ),
} as unknown as ContentIndex;

const unit = (id: string, sprite: string, x: number, y: number, faction = 'party'): Unit =>
  ({ id, sprite, pos: { x, y }, faction, size: 1, hp: 20, base: { maxHp: 20 } }) as unknown as Unit;
const kaya = unit('kaya', 'unit.fire.kaya', 5, 5);
const bo = unit('bo', 'unit.earth.bo', 3, 5);
const driller = {
  ...unit('driller', 'unit.enemy.driller', 8, 2, 'enemy'),
  size: 2,
  hp: 80,
} as unknown as Unit;
const roster = [kaya, bo, driller];
const sheetsToLoad = [...roster.map((u) => u.sprite), 'unit.enemy.crossbow'];

const used = (unitId: string, abilityId: string, target: { x: number; y: number }): GameEvent => ({
  type: 'abilityUsed',
  unitId,
  abilityId,
  target,
  tiles: [target],
});
const play = (events: GameEvent[], headingOf?: () => 'southWest') =>
  choreograph({
    content,
    events,
    unitsBefore: roster,
    cursor: 1000,
    rate: 1,
    pushIndex: 0,
    projection: 'topdown',
    clipsOf,
    ...(headingOf ? { headingOf } : {}),
  });
const posesOf = (out: ReturnType<typeof play>, unitId: string) =>
  out.tracks.filter((t): t is PoseTrack => t.kind === 'pose' && t.unitId === unitId);

beforeAll(() => {
  useTopDownStyle();
  for (const sprite of sheetsToLoad) {
    const entry = resolveAsset(sprite);
    if (entry.kind !== 'sheet' || !entry.actions || !entry.clipData) throw new Error(sprite);
    const clips = { ...entry.clips, ...read<SheetClips>(entry.clipData) };
    const actions = read<SheetActions>(entry.actions);
    loaded.set(
      sprite,
      withActions(entry, clips, actions, new Map(), () => undefined),
    );
  }
});

describe('a top-down action', () => {
  it('plays the ability in the heading it aims, never mirrored', () => {
    for (const [target, heading] of [
      [{ x: 5, y: 1 }, 'north'],
      [{ x: 5, y: 9 }, 'south'],
      [{ x: 1, y: 5 }, 'west'],
      [{ x: 8, y: 2 }, 'northEast'],
    ] as const) {
      const poses = posesOf(play([used('kaya', 'fire_jab', target)]), 'kaya');
      expect(poses.length).toBeGreaterThan(0);
      for (const pose of poses) {
        // Fire Jab is Kaya's cast pose, the jab.
        expect(pose.clip).toBe(`cast@${heading}`);
        expect(pose.heading).toBe(heading);
        expect(authoredForBothSides(pose.clip)).toBe(true);
        // The drawing carries the lunge: no code offset or squash slides it off its shadow.
        expect([pose.offset.from, pose.offset.to]).toEqual([
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ]);
        expect(pose.scale ?? { from: 1, to: 1 }).toEqual({ from: 1, to: 1 });
      }
    }
    expect(posesOf(play([used('kaya', 'flame_arc', { x: 5, y: 1 })]), 'kaya')[0]?.clip).toBe(
      'flame_arc@north',
    );
    // Its frames are the pose the sheet maps the ability to: the whip, for Flame Arc.
    expect(clipsOf('unit.fire.kaya')?.['flame_arc@north']?.frames[0]).toMatch(/whipNorth/);
    expect(clipsOf('unit.fire.kaya')?.['cast@north']?.frames[0]).toMatch(/jabNorth/);
  });

  it("lands the damage on the heading's hit frame, every heading of the Driller's slam", () => {
    const slams = read<SheetActions>('art/topdown/driller-actions.json').slam ?? {};
    for (const [target, heading] of [
      [{ x: 8, y: 5 }, 'south'],
      [{ x: 8, y: 0 }, 'north'],
      [{ x: 11, y: 2 }, 'east'],
    ] as const) {
      const victim = unit('victim', 'unit.fire.kaya', target.x, target.y);
      const out = choreograph({
        content,
        events: [
          used('driller', 'driller_slam', target),
          {
            type: 'damaged',
            unitId: 'victim',
            amount: 5,
            crit: false,
            damageType: 'earth',
            sourceId: 'driller',
          },
        ],
        unitsBefore: [driller, victim],
        cursor: 1000,
        rate: 1,
        pushIndex: 0,
        projection: 'topdown',
        clipsOf,
      });
      const slam = slams[heading];
      const hit = slam?.events?.hit ?? -1;
      const contact = (slam?.frameMs ?? []).slice(0, hit).reduce((sum, ms) => sum + ms, 0);
      expect(posesOf(out, 'driller')[0]?.clip).toBe(`cast@${heading}`);
      const flash = out.tracks.find((t) => t.kind === 'flash' && t.unitId === 'victim');
      expect(flash?.start, heading).toBe(1000 + contact);
      const cel = resolveClip(clipsOf(driller.sprite) ?? {}, `cast@${heading}`);
      expect(cel && frameIndex(cel, contact, undefined)).toBe(hit);
    }
  });

  it('plays an ability aimed at the unit itself in the heading it faces', () => {
    const step: GameEvent = {
      type: 'unitMoved',
      unitId: 'bo',
      path: [{ x: 3, y: 4 }],
      cost: 1,
    };
    const moved = posesOf(play([step, used('bo', 'stone_stance', bo.pos)]), 'bo');
    expect(moved[0]?.clip).toBe('stone_stance@north');
    const standing = posesOf(
      play([used('bo', 'stone_stance', bo.pos)], () => 'southWest'),
      'bo',
    );
    expect(standing[0]?.clip).toBe('stone_stance@southWest');
    expect(posesOf(play([used('bo', 'stone_stance', bo.pos)]), 'bo')[0]?.clip).toBe(
      'stone_stance@east',
    );
  });

  it("starts the effect at the drawn action's measured hand, unmirrored", () => {
    const out = play([used('kaya', 'fire_jab', { x: 1, y: 5 })]);
    const from = out.tracks.flatMap((t) =>
      t.kind === 'emitter' && t.attachments?.from?.sprite === kaya.sprite
        ? [t.attachments.from]
        : [],
    );
    expect(from.length).toBeGreaterThan(0);
    for (const actor of from) {
      expect(actor.clip).toBe('cast@west');
      expect(actor.facing).toBe(1);
    }
    expect(clipsOf(kaya.sprite)?.['cast@west']?.hand).toBeDefined();
  });

  it('plays the legacy cast while the actions are not in', () => {
    const out = choreograph({
      content,
      events: [used('kaya', 'fire_jab', { x: 5, y: 1 })],
      unitsBefore: roster,
      cursor: 1000,
      rate: 1,
      pushIndex: 0,
      projection: 'topdown',
      clipsOf: () => undefined,
    });
    expect(posesOf(out, 'kaya').every((pose) => pose.clip === 'cast' && !pose.heading)).toBe(true);
  });
});

describe('a top-down shot (#588)', () => {
  const crossbow = unit('xbow', 'unit.enemy.crossbow', 5, 2, 'enemy');
  const victim = unit('victim', 'unit.fire.kaya', 5, 7);
  const shoot = (rate = 1, projection: 'topdown' | 'oblique' = 'topdown', shots = true) =>
    choreograph({
      content,
      events: [
        used('xbow', 'merc_crossbow', victim.pos),
        {
          type: 'damaged',
          unitId: 'victim',
          amount: 5,
          crit: false,
          damageType: 'physical',
          sourceId: 'xbow',
        } as GameEvent,
      ],
      unitsBefore: [crossbow, victim],
      cursor: 1000,
      rate,
      pushIndex: 0,
      projection,
      clipsOf,
      shots,
    });

  it('flies a bolt from the hand at 440 px/s and lands the hit as it arrives', () => {
    const out = shoot();
    const shot = out.tracks.find((t) => t.kind === 'shot');
    expect(shot?.kind === 'shot' && shot.look).toBe('shot/bolt');
    if (shot?.kind !== 'shot') return;
    const px = Math.hypot(shot.to.x - shot.from.x, shot.to.y - shot.from.y) * 40;
    expect(shot.duration).toBeCloseTo((px / 440) * 1000);
    // Launched from the measured hand, not the tile centre.
    expect(shot.from.x).not.toBe(5.5);
    const flash = out.tracks.find((t) => t.kind === 'flash' && t.unitId === 'victim');
    expect(flash?.start).toBeCloseTo(shot.start + shot.duration);
    // The particle head is replaced by the drawn bolt.
    expect(
      out.tracks.some(
        (t) => t.kind === 'emitter' && t.def.kind === 'particles' && t.def.shape === 'projectile',
      ),
    ).toBe(false);
  });

  it('skips the flight under reduce motion, on the oblique board and before the cels load', () => {
    for (const out of [shoot(0.02), shoot(1, 'oblique'), shoot(1, 'topdown', false)])
      expect(out.tracks.some((t) => t.kind === 'shot')).toBe(false);
  });
});

describe('the animator with top-down actions', () => {
  const animator = () => new Animator(content, { motionReduced: () => false, sheetClips: clipsOf });

  it('draws the action in its heading and keeps facing it afterwards', () => {
    const a = animator();
    a.setProjection('topdown');
    a.push(1000, [used('kaya', 'fire_jab', { x: 5, y: 1 })], roster);
    expect(a.unitPose(1100, 'kaya', kaya.sprite)?.clip).toBe('cast@north');
    expect(a.locomotion(9000, 'kaya', 'stance', kaya.sprite).clip).toBe('stanceNorth');
  });

  it('knocks the Driller out in its own heading and holds the last cel', () => {
    const a = animator();
    a.push(1000, [used('driller', 'driller_slam', { x: 8, y: 5 })], roster);
    a.push(1000, [{ type: 'unitDied', unitId: 'driller' }], roster);
    expect(a.unitPose(4000, 'driller', driller.sprite)?.clip).toBe('ko@south');
    const down = a.fallenPose('driller', driller.sprite, -1);
    expect(down?.clip).toBe('ko@south');
    const ko = resolveClip(clipsOf(driller.sprite) ?? {}, 'ko@south');
    if (!ko || !down) throw new Error('Expected the knockout');
    expect(frameIndex(ko, down.clipTime, undefined)).toBe(ko.def.frames.length - 1);
  });

  it('shudders the Driller in its heading when it is hit', () => {
    const a = animator();
    a.push(1000, [used('driller', 'driller_slam', { x: 8, y: 5 })], roster);
    a.push(
      1000,
      [
        {
          type: 'damaged',
          unitId: 'driller',
          amount: 5,
          crit: false,
          damageType: 'fire',
          sourceId: 'kaya',
        },
      ],
      roster,
    );
    const at = Array.from({ length: 200 }, (_, i) => 1000 + i * 20).find((t) =>
      a.unitPose(t, 'driller', driller.sprite)?.clip.startsWith('hit'),
    );
    expect(at && a.unitPose(at, 'driller', driller.sprite)?.clip).toBe('hitSouth');
  });
});
