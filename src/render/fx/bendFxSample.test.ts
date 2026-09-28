import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BendEffectDef } from '../../content/bends';
import { BEND_FX } from '../../content/fxCels';
import { bendFxIndex, parseBendFxPage } from './bendFx';
import { BEND_FX_PX_PER_TILE, sampleBendFx } from './bendFxSample';
import type { BendFxShot } from './bendFxSample';
import { aimDeg, boardStep, flightMs, flightPoint, whipHead } from './trajectory';
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
const STEP = boardStep('oblique');
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
      { launchAt: 2000, socket: [cross], flash: 0.75 },
    ],
    from: { x: 0, y: 0 },
    to: TO,
    step: STEP,
  };
  const lands = 1000 + flightMs(shot.effect.trajectory, jab, TO, STEP);

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
    const expected = flightPoint(shot.effect.trajectory, jab, TO, STEP, 200);
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
    expect(names(shot, 2000)).toEqual(['cross-launch/0']);
    expect(sampleBendFx(fx, shot, 2000)[0]?.at).toEqual(cross);
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
    step: STEP,
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
    const expected = flightPoint(shot.effect.trajectory, hand, TO, STEP, 200);
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
    step: STEP,
  };
  const trajectory = shot.effect.trajectory;
  const head = whipHead(trajectory, launch, TO, STEP);
  const lands = 1140 + flightMs(trajectory, head, TO, STEP);

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

  it('never mirrors a cel', () => {
    for (let t = 600; t < lands + 400; t += 7) {
      for (const s of sampleBendFx(fx, shot, t)) {
        expect(s.width).toBeGreaterThan(0);
        expect(s.height).toBeGreaterThan(0);
      }
    }
  });
});
