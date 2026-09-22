import { describe, expect, it } from 'vitest';
import type { ContentIndex, GameEvent, Unit, Vec2 } from '../../core/types';
import { Animator } from '../animator';

/**
 * Gait and stopping (M1), reproduced from the paired telemetry in
 * `docs/coordination/handoffs/live-candidate-review.md`: a two-cell combat
 * move ran 220 ms, travelled 0.902 tile in the first 40 ms, and "immediately
 * selects ready stance". These drive the real animator with no DOM, sampling
 * the drawn position and pose at fixed times the way `CombatScene` builds its
 * view: a pose track wins, otherwise the locomotion clip.
 *
 * The acceptance row is "Motion and contact": no foot sliding, no unexplained
 * snap, no blank frames.
 */

const content = { abilities: new Map() } as unknown as ContentIndex;

/** Where playback starts in every case, so the numbers read as offsets. */
const START = 1000;

const hero = (id: string, x: number, y: number): Unit =>
  ({
    id,
    pos: { x, y },
    faction: 'party',
    size: 1,
    hp: 20,
    base: { maxHp: 20 },
    sprite: 'unit.fire.kaya',
  }) as unknown as Unit;

const moved = (unitId: string, ...path: [number, number][]): GameEvent => ({
  type: 'unitMoved',
  unitId,
  path: path.map(([x, y]) => ({ x, y })),
  cost: path.length,
});

const pushed = (unitId: string, to: Vec2): GameEvent => ({ type: 'unitPushed', unitId, to });

const play = (events: readonly GameEvent[], before: readonly Unit[], reduced = false): Animator => {
  const animator = new Animator(content, { motionReduced: () => reduced });
  animator.push(START, events, before);
  return animator;
};

interface Drawn {
  readonly pos: Vec2;
  readonly clip: string;
  readonly facing: 1 | -1;
}

/**
 * What the combat scene hands the renderer for a party unit at `now`. The
 * walk bob's pose track carries the side-on walk clip, and the locomotion
 * fields override it with the directional one, so travelling north draws
 * `walkNorth` from the distance-phased clock.
 */
function drawn(animator: Animator, now: number, unitId: string, rest: Vec2): Drawn {
  const pose = animator.unitPose(now, unitId);
  const movement = animator.locomotion(now, unitId);
  return {
    pos: animator.renderPos(now, unitId) ?? rest,
    clip: pose && pose.clip !== 'walk' ? pose.clip : movement.clip,
    facing: pose?.facing ?? animator.facing(unitId) ?? movement.facing,
  };
}

/** The first sample where the ready stance is drawn, scanning at 1 ms. */
function readyStanceAt(animator: Animator, from: number, rest: Vec2, unitId = 'p0'): number {
  for (let now = from; now <= from + 600; now++)
    if (drawn(animator, now, unitId, rest).clip.startsWith('idle')) return now;
  return Infinity;
}

/** The largest step between consecutive 60 fps samples of the drawn position. */
function maxStep(
  animator: Animator,
  end: number,
  rest: Vec2,
  unitId = 'p0',
): { readonly max: number; readonly steps: number } {
  let max = 0;
  let steps = 0;
  let previous = drawn(animator, START, unitId, rest).pos;
  for (let now = START + 16; now <= end + 16; now += 16) {
    const next = drawn(animator, now, unitId, rest).pos;
    max = Math.max(max, Math.hypot(next.x - previous.x, next.y - previous.y));
    previous = next;
    steps++;
  }
  return { max, steps };
}

describe('combat move gait', () => {
  it('travels two cells at the exploration pace instead of hopping tile to tile', () => {
    const a = play([moved('p0', [2, 3], [3, 3])], [hero('p0', 1, 3)]);
    const rest = { x: 3, y: 3 };
    const end = a.finishesAt;
    // Two tiles of stroll at 280 ms, plus the bounded 120 ms ramp.
    expect(end - START).toBe(680);

    // Fixed-time samples: accelerating off the tile, cruising, braking in.
    for (const [at, x] of [
      [0, 1],
      [120, 1.2142857],
      [340, 2],
      [560, 2.7857143],
      [680, 3],
    ] as const)
      expect(drawn(a, START + at, 'p0', rest).pos.x, `${at} ms`).toBeCloseTo(x, 6);

    // The live review measured 0.902 tile inside the first 40 ms of the old
    // 110 ms-per-cell hop; the ramped stroll covers 0.024 tile.
    expect(drawn(a, START + 40, 'p0', rest).pos.x - 1).toBeCloseTo(0.0238, 4);

    // No sample at 60 fps moves further than the cruising pace of one tile
    // per 280 ms, including the frame after the route ends.
    const { max, steps } = maxStep(a, end, rest);
    expect(steps).toBeGreaterThan(40);
    expect(max).toBeLessThanOrEqual(16 / 280 + 1e-9);
    expect(max).toBeCloseTo(16 / 280, 9);
    expect(drawn(a, end, 'p0', rest).pos).toEqual(rest);
    expect(a.renderPos(end + 16, 'p0')).toBeUndefined();
  });

  it('settles on the ground before the ready stance is selected', () => {
    const a = play([moved('p0', [2, 3], [3, 3])], [hero('p0', 1, 3)]);
    const rest = { x: 3, y: 3 };
    const end = a.finishesAt;
    const at = (ms: number) => drawn(a, ms, 'p0', rest);

    // Still walking on the last frame of the route...
    expect(at(end - 1).clip).toBe('walk');
    // ...and holding a settled stance on the next one, not the guard.
    expect(at(end + 1).clip).toBe('rest');
    expect(at(end + 1).pos).toEqual(rest);
    // A real dwell, not a single frame: it is still settled 100 ms later.
    expect(at(end + 100).clip).toBe('rest');
    expect(at(end + 100).pos).toEqual(rest);

    const ready = readyStanceAt(a, end, rest) - end;
    expect(ready).toBeGreaterThanOrEqual(100);
    expect(ready).toBeLessThanOrEqual(400);
    // The settle is a held pose: nothing moves while the unit stops.
    expect(at(end + ready - 1).pos).toEqual(rest);
    expect(at(end + ready).clip).toBe('idle');
    // Facing survives the whole stop and the ready stance keeps it.
    expect(at(end - 1).facing).toBe(1);
    expect(at(end + 1).facing).toBe(1);
    expect(at(end + ready).facing).toBe(1);
    expect(a.unitPose(end + 1, 'p0')).toBeUndefined();
    expect(a.offset(end + 1, 'p0')).toBeUndefined();
  });

  it('turns through a longer route and settles facing the last leg', () => {
    const a = play([moved('p0', [3, 4], [3, 3], [4, 3], [5, 3])], [hero('p0', 3, 5)]);
    const rest = { x: 5, y: 3 };
    const end = a.finishesAt;
    const clips = new Set<string>();
    for (let now = START; now <= end; now += 16) clips.add(drawn(a, now, 'p0', rest).clip);
    // North for the first leg, then the side-on walk after the corner.
    expect(clips.has('walkNorth')).toBe(true);
    expect(clips.has('walk')).toBe(true);

    const { max } = maxStep(a, end, rest);
    expect(max).toBeLessThanOrEqual(16 / 280 + 1e-9);
    expect(max).toBeCloseTo(16 / 280, 9);
    expect(drawn(a, end - 1, 'p0', rest)).toMatchObject({ clip: 'walk', facing: 1 });
    // The stop holds the settled east-facing pose, then the ready stance.
    expect(drawn(a, end + 1, 'p0', rest)).toMatchObject({ clip: 'rest', facing: 1 });
    expect(drawn(a, end + 300, 'p0', rest)).toMatchObject({ clip: 'idle', facing: 1 });
    expect(drawn(a, end + 300, 'p0', rest).pos).toEqual(rest);
  });

  it('keeps the forced-slide and reduced-motion stop contracts', () => {
    // A push takes the stance over: no settled walk-stop pose appears, and the
    // struck figure still slides in its hit pose.
    const slide = play([moved('p0', [4, 4]), pushed('p0', { x: 5, y: 4 })], [hero('p0', 3, 4)]);
    const walkEnd = START + 400;
    expect(slide.finishesAt).toBe(START + 400 + 220);
    // Forced displacement is not a stop the walk settles out of.
    expect(slide.locomotion(walkEnd + 1, 'p0')).toEqual({ clip: 'idle', facing: 1 });
    expect(drawn(slide, walkEnd + 1, 'p0', { x: 5, y: 4 }).clip).toBe('hit');
    expect(slide.offset(walkEnd + 1, 'p0')).toBeUndefined();
    expect(drawn(slide, slide.finishesAt + 1, 'p0', { x: 5, y: 4 })).toMatchObject({
      clip: 'idle',
      facing: 1,
    });

    // Reduced motion collapses the whole stop, dwell included, to a frame.
    const reduced = play([moved('p0', [2, 3], [3, 3])], [hero('p0', 1, 3)], true);
    const end = reduced.finishesAt;
    expect(end - START).toBeCloseTo(4.4, 6);
    const ready = readyStanceAt(reduced, end, { x: 3, y: 3 }) - end;
    expect(ready).toBeLessThanOrEqual(16);
  });
});
