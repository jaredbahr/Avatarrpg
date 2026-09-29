import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BendEffectDef } from '../../content/bends';
import { BEND_FX } from '../../content/fxCels';
import { bendFxIndex, parseBendFxPage } from './bendFx';
import { BEND_FX_PX_PER_TILE, planBendFx, sampleBendFx } from './bendFxSample';
import type { BendFxShot } from './bendFxSample';
import { aimDeg, bendStep, flightPoint, lerp, whipHead } from './trajectory';
import type { Point } from './trajectory';

const read = (path: string): unknown => JSON.parse(readFileSync(join('public', path), 'utf8'));
const effects = read(BEND_FX.data) as BendEffectDef[];
const fx = bendFxIndex(
  effects,
  BEND_FX.pages.map((path) => parseBendFxPage(read(path), path)),
);
const effect = (id: string): BendEffectDef => {
  const found = effects.find((e) => e.id === id);
  if (!found) throw new Error(id);
  return found;
};
const STEP = bendStep(1);
const TO: Point = { x: 3, y: 0.9 };

function names(shot: BendFxShot, now: number): string[] {
  return sampleBendFx(fx, shot, now).map((s) => {
    const cel = [...fx.effect(shot.effect.id)!.layers]
      .flatMap((l) => l.frameMs.map((_, i) => `${l.sequence}/${i}`))
      .find((name) => {
        const c = fx.cel(name);
        return c && c.frame.x === s.frame.x && c.frame.y === s.frame.y;
      });
    return (cel ?? '?').split('/').slice(1).join('/');
  });
}

describe('sampleBendFx: fire, a jab and a cross', () => {
  const jab = { x: 0.2, y: -1 };
  const cross = { x: 0.3, y: -0.9 };
  const shot: BendFxShot = {
    effect: effect('fx.fire.fireball'),
    releases: [
      { launchAt: 1000, socket: [jab], flash: 0.75 },
      { launchAt: 2500, socket: [cross], flash: 0.75 },
    ],
    from: { x: 0, y: 0 },
    to: TO,
    scale: 1,
    tiles: 3,
  };
  // At 3 tiles the jab flies the prototype's own 280 ms.
  const lands = 1000 + 280;

  it('launches on the socket, turned toward the target, flashed', () => {
    const [launch, ...rest] = sampleBendFx(fx, shot, 1000);
    expect(rest).toEqual([]);
    expect(launch).toMatchObject({ at: jab, flash: 0.75, z: 'underActor', alpha: 1 });
    expect(launch?.turn).toBeCloseTo(aimDeg(jab, TO) - 32, 12);
    expect(launch?.width).toBe((launch?.frame.w ?? 0) / BEND_FX_PX_PER_TILE);
    expect(names(shot, 999)).toEqual([]);
    expect(names(shot, 1109)).toEqual(['jab-launch/0']);
  });

  it('flies the ball on the arc once the launch cel is done, from the launch', () => {
    const [ball] = sampleBendFx(fx, shot, 1200);
    expect(names(shot, 1200)).toEqual(['jab-ball/0']);
    const expected = flightPoint(shot.effect.trajectory, jab, TO, STEP, 200, 280);
    expect(ball?.at.x).toBeCloseTo(expected.x, 12);
    expect(ball?.at.y).toBeCloseTo(expected.y, 12);
    expect(ball).toMatchObject({ flash: 0, z: 'overActor' });
  });

  it('bursts on the target on arrival, the first cel flashed', () => {
    expect(names(shot, lands - 0.01)).toEqual(['jab-ball/0']);
    const [burst] = sampleBendFx(fx, shot, lands);
    expect(names(shot, lands)).toEqual(['burst/0']);
    expect(burst).toMatchObject({ at: TO, flash: 0.75, turn: 0 });
    expect(sampleBendFx(fx, shot, lands + 40)[0]).toMatchObject({ flash: 0 });
    expect(names(shot, lands + 299)).toEqual(['burst/2']);
  });

  it('plays the cross from its own hand, with its own cels', () => {
    expect(names(shot, 2500)).toEqual(['cross-launch/0']);
    expect(sampleBendFx(fx, shot, 2500)[0]?.at).toEqual(cross);
  });
});

describe('sampleBendFx: earth, a stomp and a drive', () => {
  const foot = { x: -0.1, y: 0.05 };
  const hand = { x: 0.25, y: -0.8 };
  const shot: BendFxShot = {
    effect: effect('fx.earth.rock'),
    releases: [
      { launchAt: 1000, socket: [foot], flash: 0.75 },
      { launchAt: 1600, socket: [hand], flash: 0.75 },
    ],
    from: { x: 0, y: 0 },
    to: TO,
    scale: 1,
    tiles: 3,
  };

  it('opens the crack on the ground at the stomp and raises the rock in it', () => {
    expect(sampleBendFx(fx, shot, 1000)[0]).toMatchObject({ at: foot, z: 'ground', flash: 0.75 });
    // The crack's cels are 130, 340, 80, 130 and 90 ms: 560 ms in is its fourth.
    expect(names(shot, 1560)).toEqual(['crack/3', 'emerge/0']);
    expect(sampleBendFx(fx, shot, 1560)[1]).toMatchObject({ at: foot, flash: 0 });
  });

  it('hangs the rock at the drive hand, then tumbles it along the arc', () => {
    expect(names(shot, 1600)).toEqual(['crack/3', 'hang/0']);
    expect(sampleBendFx(fx, shot, 1600)[1]).toMatchObject({ at: hand, flash: 0.75, turn: 0 });
    const tumble = sampleBendFx(fx, shot, 1800).find((s) => s.z === 'overActor');
    const expected = flightPoint(shot.effect.trajectory, hand, TO, STEP, 200, 370);
    expect(tumble?.at.x).toBeCloseTo(expected.x, 12);
    expect(tumble?.at.y).toBeCloseTo(expected.y, 12);
  });
});

describe('sampleBendFx: water, a gather, a whip and a bolt', () => {
  // The launch hand on bend cels 0-5; the launch is cel 5.
  const socket = [0, 1, 2, 3, 4, 5].map((i) => ({ x: i * 0.1, y: -1 - i * 0.01 }));
  const launch = socket[5]!;
  const shot: BendFxShot = {
    effect: effect('fx.water.bolt'),
    releases: [{ launchAt: 1000, socket }],
    from: { x: 0, y: 0 },
    to: TO,
    scale: 1,
    tiles: 3,
  };
  const trajectory = shot.effect.trajectory;
  const head = whipHead(trajectory, launch, TO, STEP);
  // The bolt leaves once the 140 ms lash is out and flies the prototype's 180 ms.
  const lands = 1140 + 180;

  it('trails the palm: the lead spans its last step, the trail the one before', () => {
    // Gather cels are bend cels 2, 3 and 4 (110, 150, 40 ms before the launch).
    const at2 = sampleBendFx(fx, shot, 750);
    expect(names(shot, 750)).toEqual(['gather-lead/0']);
    expect(at2[0]?.at.x).toBeCloseTo(0.15, 12);
    const at3 = sampleBendFx(fx, shot, 850);
    expect(names(shot, 850)).toEqual(['gather-lead/1', 'gather-trail/0']);
    expect(at3[0]?.at.x).toBeCloseTo(0.25, 12);
    expect(at3[1]?.at.x).toBeCloseTo(0.15, 12);
    expect(at3[0]?.turn).toBeCloseTo(aimDeg(socket[2]!, socket[3]!), 12);
    expect(at3[0]?.width).toBeCloseTo(1.356 * Math.hypot(0.1, 0.01), 12);
    const at4 = sampleBendFx(fx, shot, 980);
    expect(names(shot, 980)).toEqual(['gather-lead/2', 'gather-trail/1', 'coil/0']);
    expect(at4[2]).toMatchObject({ at: socket[4], turn: -8 });
  });

  it('whips from the hand to a third of the way, unflashed', () => {
    const [lash] = sampleBendFx(fx, shot, 1000);
    expect(names(shot, 1000)).toEqual(['lash/0']);
    expect(lash?.at.x).toBeCloseTo((launch.x + head.x) / 2, 12);
    expect(lash?.flash).toBe(0);
  });

  it('flies the bolt from the whip head, and never touches the target early', () => {
    const [bolt] = sampleBendFx(fx, shot, 1140);
    expect(names(shot, 1140)).toEqual(['bolt/0']);
    expect(bolt?.at.x).toBeCloseTo(head.x, 12);
    expect(bolt?.at.y).toBeCloseTo(head.y, 12);
    expect(names(shot, lands - 0.01)).toEqual([expect.stringMatching(/^bolt\//)]);
    expect(names(shot, lands)).toEqual(['splash/0']);
    expect(names(shot, lands + 210)).toEqual(['puddle/0']);
    expect(names(shot, lands + 330)).toEqual([]);
  });

  it('never mirrors a cel on a throw to the right', () => {
    for (let t = 600; t < lands + 400; t += 7) {
      for (const s of sampleBendFx(fx, shot, t)) {
        expect(s.width).toBeGreaterThan(0);
        expect(s.height).toBeGreaterThan(0);
        expect(s.flipY).toBeUndefined();
      }
    }
  });
});

describe('sampleBendFx: step 6 follow-ups', () => {
  const fire = effect('fx.fire.fireball');
  const jab = { x: 0.2, y: -1 };

  it('measures the data in character-relative steps, sized with the caster, but not its time', () => {
    // The prototype's step against the character: 2.4 times shorter than an oblique board step.
    expect(Math.hypot(1, 0.5) / bendStep(1)).toBeCloseTo(2.4, 12);
    expect(bendStep(1.25)).toBeCloseTo(bendStep(1) * 1.25, 12);
    const big: BendFxShot = {
      effect: fire,
      releases: [{ launchAt: 0, socket: [jab] }],
      from: { x: 0, y: 0 },
      to: TO,
      scale: 1.25,
      tiles: 3,
    };
    const [launch] = sampleBendFx(fx, big, 0);
    expect(launch?.width).toBeCloseTo(((launch?.frame.w ?? 0) / BEND_FX_PX_PER_TILE) * 1.25, 12);
    expect(planBendFx(fx, big).arrivals[0]).toBe(280);
  });

  it('flips turned cels top to bottom on a throw to the left, never a fixed one', () => {
    const west = { x: -3, y: 0.2 };
    const shot: BendFxShot = {
      effect: fire,
      releases: [{ launchAt: 0, socket: [jab] }],
      from: { x: 0, y: 0 },
      to: west,
      scale: 1,
      tiles: 3,
    };
    const aim = aimDeg(jab, west);
    expect(Math.abs(aim)).toBeGreaterThan(90);
    const [launch] = sampleBendFx(fx, shot, 0);
    expect(launch?.flipY).toBe(true);
    // Mirrored first, the art points at -32 degrees, so it turns by the aim plus 32.
    expect(launch?.turn).toBeCloseTo(aim + 32, 12);
    const [ball] = sampleBendFx(fx, shot, 200);
    expect(ball?.flipY).toBe(true);
    const lands = planBendFx(fx, shot).arrivals[0] ?? 0;
    // The burst has no facing: it is drawn as painted whatever the throw.
    expect(sampleBendFx(fx, shot, lands)[0]?.flipY).toBeUndefined();
    // Straight up is not past it, and neither is a throw to the right.
    expect(sampleBendFx(fx, { ...shot, to: { x: jab.x, y: -4 } }, 0)[0]?.flipY).toBeUndefined();
    expect(sampleBendFx(fx, { ...shot, to: TO }, 0)[0]?.flipY).toBeUndefined();
  });

  it('aims a release thrown at its own launch point along the heading', () => {
    const shot: BendFxShot = {
      effect: fire,
      releases: [{ launchAt: 0, socket: [jab] }],
      from: { x: 0, y: 0 },
      to: jab,
      scale: 1,
      tiles: 3,
      heading: 135,
    };
    const [launch] = sampleBendFx(fx, shot, 0);
    expect(launch?.turn).toBeCloseTo(135 + 32, 12);
    expect(launch?.flipY).toBe(true);
  });

  it('lays a gather with no recorded socket on the launch point, not the board origin', () => {
    const shot: BendFxShot = {
      effect: effect('fx.water.bolt'),
      releases: [{ launchAt: 1000, socket: [] }],
      from: { x: 2, y: 1 },
      to: TO,
      scale: 1,
      tiles: 3,
    };
    // With no socket at all, the launch point is the caster's ground point.
    const coil = sampleBendFx(fx, shot, 980).find((s) => s.turn === -8);
    expect(coil?.at).toEqual({ x: 2, y: 1 });
  });

  it('flies each release from its own previous phase, and plans once a shot', () => {
    const cross = { x: 0.3, y: -0.9 };
    const shot: BendFxShot = {
      effect: fire,
      releases: [
        { launchAt: 0, socket: [jab] },
        { launchAt: 100, socket: [cross] },
      ],
      from: { x: 0, y: 0 },
      to: TO,
      scale: 1,
      tiles: 3,
    };
    const plan = planBendFx(fx, shot);
    expect(planBendFx(fx, shot)).toBe(plan);
    expect(plan.arrivals[0]).toBe(280);
    expect(plan.arrivals[1]).toBe(100 + 330);
    // The cross's burst is 250 ms of cels after it lands.
    expect(plan.endsAt).toBeCloseTo((plan.arrivals[1] ?? 0) + 250, 9);
  });
});

describe('sampleBendFx: flight time by range', () => {
  // clamp(1 + 0.1 (tiles - 3), 0.8, 1.3) of the prototype's flight.
  const RANGES: [number, number][] = [
    [1, 0.8],
    [3, 1],
    [5, 1.2],
    [9, 1.3],
  ];
  const hand = { x: 0.2, y: -1 };
  const shotAt = (id: string, launchAt: readonly number[], tiles: number, to = TO): BendFxShot => ({
    effect: effect(id),
    releases: launchAt.map((at) => ({ launchAt: at, socket: [hand] })),
    from: { x: 0, y: 0 },
    to,
    scale: 1.25,
    tiles,
  });

  it.each(RANGES)('fire at %i tiles: the jab 280 ms and the cross 330 ms, times %d', (tiles, k) => {
    const plan = planBendFx(fx, shotAt('fx.fire.fireball', [0, 440], tiles));
    expect(plan.arrivals[0]).toBeCloseTo(280 * k, 9);
    expect(plan.arrivals[1]).toBeCloseTo(440 + 330 * k, 9);
  });

  it.each(RANGES)('earth at %i tiles: the drive’s rock 370 ms, times %d', (tiles, k) => {
    const plan = planBendFx(fx, shotAt('fx.earth.rock', [330, 510], tiles));
    expect(plan.arrivals[0]).toBeUndefined();
    expect(plan.arrivals[1]).toBeCloseTo(510 + 370 * k, 9);
  });

  it.each(RANGES)('water at %i tiles: the bolt 180 ms after the lash, times %d', (tiles, k) => {
    const plan = planBendFx(fx, shotAt('fx.water.bolt', [430], tiles));
    expect(plan.arrivals[0]).toBeCloseTo(430 + 140 + 180 * k, 9);
  });

  it('takes its speed from the time and the distance on screen, not the other way round', () => {
    const near = shotAt('fx.fire.fireball', [0], 5, { x: 2, y: 0.5 });
    const far = shotAt('fx.fire.fireball', [0], 5, { x: 6, y: 2 });
    expect(planBendFx(fx, near).arrivals[0]).toBeCloseTo(336, 9);
    expect(planBendFx(fx, far).arrivals[0]).toBeCloseTo(336, 9);
    // Half the flight in, each ball is half way along its own chord.
    for (const shot of [near, far]) {
      const [ball] = sampleBendFx(fx, shot, 168);
      expect(ball?.at.x).toBeCloseTo(lerp(hand, shot.to, 0.5).x, 9);
    }
  });
});
