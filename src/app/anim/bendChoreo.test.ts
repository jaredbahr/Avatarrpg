import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Heading } from '../../content/assets/clips';
import type { BendEffectDef, BendSetDef } from '../../content/bends';
import { BEND_FX } from '../../content/fxCels';
import { bendFxIndex, parseBendFxPage } from '../../render/fx/bendFx';
import { BEND_FX_PX_PER_TILE } from '../../render/fx/bendFxSample';
import type { ContentIndex } from '../../core/types';
import { Animator } from '../animator';
import { bendStep, flightDurationMs, whipHead } from '../../render/fx/trajectory';
import type { Point } from '../../render/fx/trajectory';
import { projectGround } from '../../render/projection';
import type { BendCel, BendPlan, BendSpec } from './bendChoreo';
import {
  bendCelAt,
  bendClock,
  bendFxAt,
  bendNudge,
  bendPoseAt,
  bendSceneAt,
  HOLD_MERGE_MS,
  planBend,
} from './bendChoreo';

const read = (path: string): unknown => JSON.parse(readFileSync(join('public', path), 'utf8'));
const effects = read(BEND_FX.data) as BendEffectDef[];
const fx = bendFxIndex(
  effects,
  BEND_FX.pages.map((path) => parseBendFxPage(read(path), path)),
);
const SETS = {
  fire: read('art/units/kaya-bend.json') as BendSetDef,
  earth: read('art/units/bo-bend.json') as BendSetDef,
  water: read('art/units/sura-bend.json') as BendSetDef,
};

/** A caster's foot at grid (1, 6) on the oblique board, and a target `dx, dy` tiles away. */
const board = (x: number, y: number): Point => projectGround({ x: x + 0.5, y: y + 0.5 }, 'oblique');
const FOOT = board(1, 6);

function spec(
  element: keyof typeof SETS,
  heading: Heading,
  target: Point,
  extra: Partial<BendSpec> = {},
): BendSpec {
  const facing = SETS[element].facings[heading];
  const attack = facing.attacks[0]!;
  const effect = effects.find((e) => e.id === attack.effectId)!;
  const cel = (index: number): BendCel | null =>
    index < facing.frames.length
      ? {
          frame: { x: 0, y: 0, w: facing.frameSize.width, h: facing.frameSize.height },
          anchor: facing.anchor,
          pixelsPerTile: 128,
          sockets: facing.socketsPerFrame.find((row) => row.frame === index)?.sockets ?? {},
        }
      : null;
  const scale = extra.scale ?? 1;
  const tiles = extra.tiles ?? 3;
  return {
    heading,
    facing,
    attack,
    effect,
    cel,
    foot: FOOT,
    to: {
      x: target.x + (effect.impact.offsetPx.x / BEND_FX_PX_PER_TILE) * scale,
      y: target.y + (effect.impact.offsetPx.y / BEND_FX_PX_PER_TILE) * scale,
    },
    scale,
    tiles,
    ...extra,
  };
}

const starts = (plan: BendPlan): number[] =>
  plan.facing.frameMs.map((_, i) => plan.facing.frameMs.slice(0, i).reduce((a, b) => a + b, 0));

describe('the freeze clock', () => {
  const plan = planBend(fx, spec('fire', 'southEast', board(4, 6)));

  it('plays the cels on their cumulative frameMs, exactly at each boundary', () => {
    const at = starts(plan);
    // Before any hold, presentation time is scene time.
    for (const [index, start] of at.entries()) {
      if (start >= plan.holds[0]!.at) break;
      expect(bendCelAt(plan, start), `cel ${index}`).toBe(index);
      if (index > 0) expect(bendCelAt(plan, start - 1e-9)).toBe(index - 1);
    }
    // Fire: 60, 60, 110 ... so cel 2 starts at 120 ms, and cel 3 at 230.
    expect(at.slice(0, 4)).toEqual([0, 60, 120, 230]);
    expect(bendCelAt(plan, 119.999)).toBe(1);
    expect(bendCelAt(plan, 120)).toBe(2);
    expect(bendCelAt(plan, 229.999)).toBe(2);
    expect(bendCelAt(plan, 230)).toBe(3);
  });

  it('freezes at the contact cel for its launch hold, then resumes where it stopped', () => {
    const jab = plan.holds[0]!;
    expect(jab).toMatchObject({ at: 120, ms: 60, causes: [{ kind: 'launch', release: 0 }] });
    expect(bendClock(plan, 119.9).p).toBeCloseTo(119.9, 9);
    expect(bendClock(plan, 120)).toEqual({ p: 120, hold: jab });
    expect(bendClock(plan, 179.999)).toEqual({ p: 120, hold: jab });
    expect(bendClock(plan, 180)).toEqual({ p: 120 });
    expect(bendClock(plan, 190).p).toBeCloseTo(130, 9);
    // The held cel is the contact cel, and it says so.
    expect(bendPoseAt(plan, 150)).toEqual({ heading: 'southEast', index: 2, held: true });
    expect(bendPoseAt(plan, 181)).toEqual({ heading: 'southEast', index: 2, held: false });
    // Scene time of a moment counts every hold before it.
    expect(bendSceneAt(plan, 120)).toBe(120);
    expect(bendSceneAt(plan, 121)).toBe(181);
  });

  it('holds everything still for the whole hold: character, effect and kick', () => {
    for (const hold of plan.holds) {
      const begins = bendSceneAt(plan, hold.at);
      const first = {
        pose: bendPoseAt(plan, begins),
        fx: bendFxAt(fx, plan, begins),
        kick: bendNudge(plan, begins),
      };
      for (let t = begins; t < begins + hold.ms; t += 7) {
        expect(bendPoseAt(plan, t)).toEqual(first.pose);
        expect(bendFxAt(fx, plan, t)).toEqual(first.fx);
        expect(bendNudge(plan, t)).toEqual(first.kick);
      }
    }
  });

  it('lasts its presentation time plus every hold, and ends back in the stance', () => {
    const held = plan.holds.reduce((a, h) => a + h.ms, 0);
    expect(plan.duration).toBeCloseTo(plan.ends + held, 9);
    expect(bendClock(plan, plan.duration + 500).p).toBe(plan.ends);
    expect(bendPoseAt(plan, plan.duration)).toBeNull();
    const last = plan.facing.frameMs.length - 1;
    expect(bendCelAt(plan, plan.bendEnds - 1e-6)).toBe(last);
    expect(plan.facing.frames[last]).toBe(plan.facing.frames[0]);
  });
});

describe('fire: two releases, one damage', () => {
  const plan = planBend(fx, spec('fire', 'southEast', board(4, 6)));

  it('throws the jab from the left wrist and the cross from the right, each to the target', () => {
    const { attack } = spec('fire', 'southEast', board(4, 6));
    expect(attack.releases.map((r) => r.socket)).toEqual(['LW', 'RW']);
    expect(attack.damageRelease).toBe(1);
    expect(plan.shot.releases.map((r) => r.launchAt)).toEqual([120, 440]);
    expect(plan.arrivals.every((a) => a !== undefined)).toBe(true);
    expect(plan.arrivals[1]!).toBeGreaterThan(plan.arrivals[0]!);
    // At three tiles the jab lands before the cross launches; each keeps its hold.
    expect(plan.holds.map((h) => [h.causes[0]!.kind, h.causes[0]!.release, h.ms])).toEqual([
      ['launch', 0, 60],
      ['impact', 0, 60],
      ['launch', 1, 100],
      ['impact', 1, 100],
    ]);
  });

  it('lays the one damage on the last impact, when its hold begins', () => {
    const damage = plan.arrivals[1]!;
    const before = plan.holds.filter((h) => h.at < damage).reduce((a, h) => a + h.ms, 0);
    expect(bendSceneAt(plan, damage)).toBeCloseTo(damage + before, 9);
    const hold = bendClock(plan, bendSceneAt(plan, damage) + 1).hold;
    expect(hold?.causes).toEqual([{ kind: 'impact', release: 1 }]);
  });

  it('freezes the cross launch with the five-tile jab impact', () => {
    // At range 5 the jab lands within one frame of the cross launch, so the holds merge.
    const far = planBend(fx, spec('fire', 'southEast', board(6, 6), { tiles: 5 }));
    const jabImpact = far.holds.find((h) =>
      h.causes.some((c) => c.kind === 'impact' && c.release === 0),
    )!;
    expect(jabImpact.at).toBe(far.shot.releases[1]!.launchAt);
    expect(jabImpact.causes).toEqual([
      { kind: 'launch', release: 1 },
      { kind: 'impact', release: 0 },
    ]);
    expect(jabImpact.at).toBeLessThan(far.arrivals[1]!);
    const begins = bendSceneAt(far, jabImpact.at);
    const frozen = bendFxAt(fx, far, begins);
    expect(frozen.length).toBeGreaterThan(0);
    expect(bendFxAt(fx, far, begins + jabImpact.ms - 1)).toEqual(frozen);
    expect(bendFxAt(fx, far, begins + jabImpact.ms + 20)).not.toEqual(frozen);
  });

  it('snaps the merged arrival, impact, damage timing and shake to the hold boundary', () => {
    const far = planBend(fx, spec('fire', 'southEast', board(6, 6), { tiles: 5 }));
    const merged = far.holds.find((h) => h.causes.length > 1)!;
    const arrival = far.arrivals[0]!;
    const scene = bendSceneAt(far, arrival);
    const impact = far.shot.effect.layers.find(
      (layer) => layer.phase === 'impact' && layer.release === 0,
    )!;
    const firstImpactCel = fx.layerCel(impact, 0);
    const damageAt = bendSceneAt(far, arrival);

    expect(arrival).toBe(merged.at);
    expect(scene).toBe(merged.at);
    expect(damageAt).toBe(merged.at);
    expect(
      bendFxAt(fx, far, scene).some(
        (sprite) =>
          sprite.frame.x === firstImpactCel?.frame.x &&
          sprite.frame.y === firstImpactCel?.frame.y,
      ),
    ).toBe(true);
    expect(bendNudge(far, scene + 1)).not.toEqual({ x: 0, y: 0 });
  });
});

describe('the overlapping-hold rule', () => {
  it('merges holds within one frame into one, as long as the longest', () => {
    // At five tiles the 280 ms jab flight stretches to 336 ms and lands at
    // 456, within one 60 Hz frame of the cross's 440 ms contact.
    const plan = planBend(fx, spec('fire', 'southEast', board(6, 6), { tiles: 5 }));
    const merged = plan.holds.find((h) => h.causes.length > 1)!;
    expect(merged.at).toBe(440);
    expect(merged.ms).toBe(100);
    expect(merged.causes).toEqual([
      { kind: 'launch', release: 1 },
      { kind: 'impact', release: 0 },
    ]);
    expect(plan.holds).toHaveLength(3);
  });

  it('plays holds a frame or more apart one after the other, in full', () => {
    const plan = planBend(fx, spec('fire', 'southEast', board(10, 6), { tiles: 9 }));
    for (let i = 1; i < plan.holds.length; i++)
      expect(plan.holds[i]!.at - plan.holds[i - 1]!.at).toBeGreaterThanOrEqual(HOLD_MERGE_MS);
    expect(plan.duration).toBeCloseTo(plan.ends + 60 + 100 + 60 + 100, 9);
  });
});

describe('earth: a stomp that cracks, a drive that throws', () => {
  const plan = planBend(fx, spec('earth', 'southEast', board(4, 6)));
  const at = starts(plan);
  const names = (t: number) =>
    bendFxAt(fx, plan, t).map((s) => {
      for (const layer of plan.shot.effect.layers)
        for (let i = 0; i < layer.frameMs.length; i++) {
          const cel = fx.cel(`${layer.sequence}/${i}`);
          if (cel && cel.frame.x === s.frame.x && cel.frame.y === s.frame.y)
            return `${layer.sequence.split('/')[1]}/${i}`;
        }
      return '?';
    });

  it('holds the stomp and the drive, and only the drive lands', () => {
    expect(plan.arrivals[0]).toBeUndefined();
    expect(plan.arrivals[1]).toBeDefined();
    expect(plan.holds.map((h) => [h.at, h.ms])).toEqual([
      [at[4], 50],
      [at[6], 110],
      [plan.arrivals[1], 110],
    ]);
  });

  it('cracks, raises, hangs, tumbles and shatters, in that order', () => {
    const scene = (p: number) => bendSceneAt(plan, p) + 1;
    expect(names(scene(at[4]!))).toEqual(['crack/0']);
    expect(names(scene(at[5]!))).toEqual(['crack/1', 'emerge/0']);
    expect(names(scene(at[6]!))).toEqual(['crack/1', 'hang/0']);
    const flying = (at[6]! + 170 + plan.arrivals[1]!) / 2;
    expect(names(scene(flying)).some((n) => n.startsWith('tumble/'))).toBe(true);
    expect(names(scene(plan.arrivals[1]!))).toContain('shatter/0');
    expect(names(scene(plan.arrivals[1]! + 400))).toEqual([]);
  });

  it('opens the crack at the stomping ankle', () => {
    const [crack] = bendFxAt(fx, plan, bendSceneAt(plan, at[4]!));
    expect(crack?.z).toBe('ground');
    expect(crack?.at).toEqual(plan.shot.releases[0]!.socket.at(-1));
  });
});

describe('water: one release that never touches the target early', () => {
  const plan = planBend(fx, spec('water', 'southEast', board(6, 6), { tiles: 5 }));
  const to = plan.shot.to;
  const cue = plan.shot.releases[0]!;
  const launch = cue.socket.at(-1)!;
  const lands = plan.arrivals[0]!;

  it('gathers along the launch hand over the cels before the launch', () => {
    // One point a cel up to the launch cel, each the hand on that cel.
    expect(cue.socket).toHaveLength(6);
    const facing = plan.facing;
    const lw = facing.socketsPerFrame.find((r) => r.frame === 3)!.sockets.LW!;
    expect(cue.socket[3]!.x).toBeCloseTo(
      FOOT.x + (lw.x - facing.anchor.x * facing.frameSize.width) / 128,
      12,
    );
  });

  it('draws nothing at the target before the bolt arrives', () => {
    const head = whipHead(plan.shot.effect.trajectory, launch, to, bendStep(1));
    const reach = Math.hypot(head.x - launch.x, head.y - launch.y);
    expect(reach).toBeLessThanOrEqual(1.5 * bendStep(1) + 1e-12);
    const arrival = bendSceneAt(plan, lands);
    for (let t = 0; t < arrival; t += 3) {
      for (const sprite of bendFxAt(fx, plan, t)) {
        expect(sprite.at).not.toEqual(to);
        const gap = Math.hypot(to.x - sprite.at.x, to.y - sprite.at.y);
        expect(gap, `at ${t}`).toBeGreaterThan(0);
      }
    }
    expect(bendFxAt(fx, plan, arrival).some((s) => s.at.x === to.x && s.at.y === to.y)).toBe(true);
    expect(lands).toBeCloseTo(cue.launchAt + 140 + flightDurationMs(180, 5), 9);
  });

  it('holds the follow-through until a long throw lands, then recovers to the stance', () => {
    const recovery = Object.values(plan.facing.keyFrames).find((k) => k.role === 'recovery')!;
    const recoveryAt = starts(plan)[recovery.frame]!;
    expect(lands).toBeGreaterThan(recoveryAt);
    expect(plan.wait).toEqual({
      at: recoveryAt,
      ms: lands - recoveryAt,
      frame: recovery.frame - 1,
    });
    expect(bendCelAt(plan, recoveryAt)).toBe(recovery.frame - 1);
    expect(bendCelAt(plan, lands - 1)).toBe(recovery.frame - 1);
    expect(bendCelAt(plan, lands)).toBe(recovery.frame);
    // A throw that lands before the recovery does not wait.
    const near = planBend(
      fx,
      spec('water', 'southEast', { x: FOOT.x + 0.4, y: FOOT.y - 0.5 }, { tiles: 1 }),
    );
    expect(near.arrivals[0]!).toBeLessThan(near.wait.at);
    expect(near.wait.ms).toBe(0);
  });
});

describe('orientation and the kick', () => {
  it('flips the thrown cels on west and north-west throws, never on east ones', () => {
    for (const [heading, target, flips] of [
      ['west', board(-4, 9), true],
      ['northWest', board(-3, 6), true],
      ['east', board(4, 3), false],
      ['southEast', board(4, 6), false],
    ] as const) {
      const plan = planBend(fx, spec('fire', heading, target));
      const t = bendSceneAt(plan, plan.shot.releases[0]!.launchAt);
      const [launch] = bendFxAt(fx, plan, t);
      expect(launch?.flipY === true, heading).toBe(flips);
    }
  });

  it('kicks toward the throw and up at launch, back at impact, and eases off', () => {
    const plan = planBend(fx, spec('fire', 'southEast', board(4, 6)));
    const jab = bendNudge(plan, 121);
    expect(jab.x).toBeGreaterThan(0);
    expect(jab.y).toBeLessThan(0);
    expect(Math.hypot(jab.x, jab.y)).toBeCloseTo(0.021 * bendStep(1), 12);
    expect(jab.y / jab.x).toBeCloseTo(-2 / 3, 12);
    // Half way through its contact cel (110 ms), after the 60 ms hold, it is half gone.
    const half = bendNudge(plan, 120 + 60 + 55);
    expect(half.x).toBeCloseTo(jab.x / 2, 12);
    expect(bendNudge(plan, 120 + 60 + 110)).toEqual({ x: 0, y: 0 });
    const impact = bendNudge(plan, bendSceneAt(plan, plan.arrivals[0]!) + 1);
    expect(impact.x).toBeLessThan(0);
    expect(impact.y).toBeGreaterThan(0);
    const west = planBend(fx, spec('fire', 'west', board(-4, 9)));
    expect(bendNudge(west, 121).x).toBeLessThan(0);
    expect(bendNudge(west, 121).y).toBeLessThan(0);
  });

  it('never kicks under reduced motion', () => {
    const plan = planBend(fx, spec('fire', 'southEast', board(4, 6), { still: true }));
    expect(plan.kicks).toEqual([]);
    expect(bendNudge(plan, 121)).toEqual({ x: 0, y: 0 });
  });
});

describe('the animator plays a bend', () => {
  it('queues it, stays busy through every hold, and samples it on its own clock', () => {
    const animator = new Animator({} as ContentIndex, { motionReduced: () => false });
    const plan = planBend(fx, spec('fire', 'southEast', board(4, 6)));
    const start = animator.pushBend(1000, 'kaya', plan, fx);
    expect(start).toBe(1000);
    expect(animator.finishesAt).toBeCloseTo(1000 + plan.duration, 9);
    expect(animator.busy(1000 + plan.duration - 1)).toBe(true);
    expect(animator.busy(1000 + plan.duration)).toBe(false);
    expect(animator.bendPose(1150, 'kaya')).toEqual({ heading: 'southEast', index: 2, held: true });
    expect(animator.bendPose(1150, 'sura')).toBeUndefined();
    expect(animator.bendFx(1150)).toEqual(bendFxAt(fx, plan, 150));
    expect(animator.cameraNudge(1121)).toEqual(bendNudge(plan, 121));
    // A second bend waits for the first.
    expect(animator.pushBend(1000, 'kaya', plan, fx)).toBeCloseTo(1000 + plan.duration, 9);
  });
});
