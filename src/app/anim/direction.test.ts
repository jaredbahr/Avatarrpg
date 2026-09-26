import { describe, expect, it } from 'vitest';
import { screenMeleeDirection, walkDirection, walkHeading, directionalClip } from './direction';
import type { WalkDirection } from './direction';
import { ASSETS } from '../../content/assets/manifest';
import type { ClipName } from '../../content/assets/clips';
import type { Vec2 } from '../../core/types';
import { Animator } from '../animator';
import type { ContentIndex } from '../../core/types';

const content = { abilities: new Map() } as unknown as ContentIndex;

/** The eight-way PixelLab G party (ADR 0050, ADR 0051). */
const G_PARTY = ['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo'] as const;
/** A sheet on the legacy four-way contract, fixed 500 ms a tile. */
const FOUR_WAY = 'unit.earth.linmei';

describe('directional walking', () => {
  it('keeps a diagonal corner stable, then turns when the route changes axis', () => {
    expect(walkDirection({ x: 0.68, y: -0.72 }, 'east')).toBe('east');
    expect(walkDirection({ x: 0.72, y: -0.68 }, 'north')).toBe('north');
    expect(walkDirection({ x: 0.2, y: -0.98 }, 'east')).toBe('north');
    expect(walkDirection({ x: -1, y: 0 }, 'north')).toBe('west');
    expect(directionalClip('cast', 'north')).toBe('cast');
    expect(directionalClip('ko', 'south')).toBe('ko');
  });

  for (const [dy, direction] of [
    [-1, 'North'],
    [1, 'South'],
  ] as const) {
    it(`walks ${direction}, preserves facing at rest, and shares the follower's stride`, () => {
      const a = new Animator(content, { motionReduced: () => false });
      for (const [id, x] of [
        ['leader', 4],
        ['follower', 5],
      ] as const)
        a.push(
          0,
          [
            {
              type: 'partyWalked',
              unitId: id,
              from: { x, y: 4 },
              path: [1, 2, 3, 4].map((step) => ({ x, y: 4 + step * dy })),
            },
          ],
          [],
          { alongside: id === 'follower' },
        );
      expect(a.locomotion(400, 'leader')).toEqual({ clip: `walk${direction}`, facing: 1 });
      expect(a.locomotion(400, 'follower')).toEqual(a.locomotion(400, 'leader'));
      expect(a.unitPose(400, 'leader')?.clipTime).toBeCloseTo(
        a.unitPose(400, 'follower')?.clipTime ?? -1,
      );
      a.prune(a.finishesAt + 1);
      // The stop holds the settled pose its facing implies, then the ready
      // stance, and neither loses the walked way.
      expect(a.locomotion(a.finishesAt + 1, 'leader')).toEqual({
        clip: `rest${direction}`,
        facing: 1,
      });
      expect(a.locomotion(a.finishesAt + 300, 'leader')).toEqual({
        clip: `idle${direction}`,
        facing: 1,
      });
      expect(a.locomotion(a.finishesAt + 1, 'leader', 'rest')).toEqual({
        clip: `rest${direction}`,
        facing: 1,
      });
      a.clear();
      expect(a.locomotion(9999, 'leader')).toEqual({ clip: 'idle', facing: 1 });
    });
  }

  it('retains the final turn even if reduced motion skips every intermediate frame', () => {
    const a = new Animator(content, { motionReduced: () => true });
    a.push(
      0,
      [
        {
          type: 'partyWalked',
          unitId: 'p',
          from: { x: 4, y: 4 },
          path: [
            { x: 3, y: 4 },
            { x: 3, y: 3 },
            { x: 3, y: 2 },
          ],
        },
      ],
      [],
    );
    a.prune(100);
    expect(a.locomotion(100, 'p')).toEqual({ clip: 'idleNorth', facing: 1 });
  });
});

describe('screen-facing melee contacts', () => {
  it('maps projected vertical contact to screen-up or screen-down and leaves side contact unchanged', () => {
    expect(screenMeleeDirection({ x: 0, y: -1 })).toBe('screenUp');
    expect(screenMeleeDirection({ x: 0, y: 1 })).toBe('screenDown');
    expect(screenMeleeDirection({ x: 1, y: 0 })).toBeUndefined();
    expect(screenMeleeDirection({ x: -1, y: 0.9 })).toBeUndefined();
  });
});

describe('oblique screen headings', () => {
  for (const reduced of [false, true]) {
    for (const [dx, dy, clip, facing] of [
      [1, 0, 'walk', 1],
      [0, 1, 'walk', -1],
      [-1, 0, 'walk', -1],
      [0, -1, 'walk', 1],
      [1, 1, 'walkSouth', 1],
      [-1, -1, 'walkNorth', 1],
    ] as const) {
      it(`faces screen travel for (${dx},${dy}), reduced=${reduced}`, () => {
        const a = new Animator(content, { motionReduced: () => reduced });
        a.setProjection('oblique');
        a.push(
          0,
          [
            {
              type: 'partyWalked',
              unitId: 'p',
              from: { x: 4, y: 4 },
              path: [1, 2, 3, 4].map((step) => ({ x: 4 + dx * step, y: 4 + dy * step })),
            },
          ],
          [],
        );
        const halfway = a.finishesAt / 2;
        expect(a.locomotion(halfway, 'p')).toEqual({ clip, facing });
        const pos = a.renderPos(halfway, 'p');
        expect(pos).toBeDefined();
        // Positions remain logical, so projection cannot alter the travelled route.
        if (dx === 0) expect(pos?.x).toBe(4);
        if (dy === 0) expect(pos?.y).toBe(4);
        const done = a.finishesAt + 1;
        a.prune(done);
        // The stop settles on the walked heading before the ready stance.
        expect(a.locomotion(done, 'p')).toEqual({ clip: clip.replace('walk', 'rest'), facing });
        expect(a.locomotion(done + 300, 'p')).toEqual({
          clip: clip.replace('walk', 'idle'),
          facing,
        });
      });
    }
  }

  it('changes projection without changing playback duration or logical motion', () => {
    const a = new Animator(content, { motionReduced: () => false });
    a.push(
      0,
      [
        {
          type: 'partyWalked',
          unitId: 'p',
          from: { x: 4, y: 4 },
          path: [
            { x: 4, y: 5 },
            { x: 4, y: 6 },
          ],
        },
      ],
      [],
    );
    const finish = a.finishesAt;
    const pos = a.renderPos(200, 'p');
    expect(a.locomotion(200, 'p').clip).toBe('walkSouth');
    a.setProjection('oblique');
    expect(a.finishesAt).toBe(finish);
    expect(a.renderPos(200, 'p')).toEqual(pos);
    expect(a.locomotion(200, 'p')).toEqual({ clip: 'walk', facing: -1 });
    a.setProjection('orthographic');
    expect(a.locomotion(200, 'p')).toEqual({ clip: 'walkSouth', facing: 1 });
  });
});

/*
 * The four-way choice exactly as it shipped before eight-way sheets existed,
 * kept verbatim as the oracle: a sheet that does not declare eight-way
 * locomotion must keep choosing precisely these clips.
 */
function legacyWalkDirection(tangent: Vec2, previous?: WalkDirection): WalkDirection {
  const x = Math.abs(tangent.x),
    y = Math.abs(tangent.y);
  if (x + y < 0.001) return previous ?? 'east';
  const vertical =
    y > x * 1.15 || (x <= y * 1.15 && (previous === 'north' || previous === 'south'));
  return vertical ? (tangent.y < 0 ? 'north' : 'south') : tangent.x < 0 ? 'west' : 'east';
}
function legacyClip(clip: 'walk' | 'idle' | 'rest', direction?: WalkDirection): ClipName {
  if (direction === 'north')
    return clip === 'walk' ? 'walkNorth' : clip === 'rest' ? 'restNorth' : 'idleNorth';
  if (direction === 'south')
    return clip === 'walk' ? 'walkSouth' : clip === 'rest' ? 'restSouth' : 'idleSouth';
  return clip;
}

describe('heading vocabulary is a declared sheet capability', () => {
  it('quantises eight-way headings and keeps the last one at rest', () => {
    expect(walkHeading({ x: 0.68, y: -0.72 }, 'east')).toBe('northEast');
    expect(walkHeading({ x: 0.72, y: 0.68 }, 'north')).toBe('southEast');
    expect(walkHeading({ x: 0.2, y: -0.98 }, 'east')).toBe('north');
    expect(walkHeading({ x: -1, y: 0 }, 'north')).toBe('west');
    expect(walkHeading({ x: 0, y: 0 }, 'southWest')).toBe('southWest');
  });

  it('only the G party (Kaya, Sura, Bo) declares eight-way locomotion today', () => {
    const eightWay = Object.entries(ASSETS)
      .filter(([, entry]) => entry.kind === 'sheet' && entry.locomotion?.headings === 8)
      .map(([key]) => key);
    expect(eightWay).toEqual(['unit.fire.kaya', 'unit.water.sura', 'unit.earth.bo']);
  });

  // A continuous route of straight legs, each starting where the last ended,
  // so the four-way corner hysteresis sees every previous heading it would in
  // play. Bo's reported tangent (0.8, -0.6), from when his sheet was
  // four-way, is the first leg.
  const legs: readonly Vec2[] = [
    { x: 4, y: -3 },
    { x: 3, y: -4 },
    { x: 0, y: -4 },
    { x: 4, y: -4 },
    { x: 5, y: -4 },
    { x: 4, y: 5 },
    { x: 0, y: 3 },
    { x: -4, y: 3 },
    { x: -5, y: 5 },
    { x: -4, y: 0 },
    { x: -3, y: -4 },
    { x: -4, y: -3 },
    { x: 6, y: 1 },
  ];

  function walkLegs(sprite: string | undefined, check: (leg: Vec2, got: unknown) => void) {
    const a = new Animator(content, { motionReduced: () => false });
    let at = { x: 20, y: 20 };
    let t = 0;
    for (const leg of legs) {
      const to = { x: at.x + leg.x, y: at.y + leg.y };
      a.push(t, [{ type: 'partyWalked', unitId: 'u', from: at, path: [to] }], []);
      const start = t;
      const end = a.finishesAt;
      const mid = (start + end) / 2;
      check(leg, {
        walk: a.locomotion(mid, 'u', 'idle', sprite),
        clipTime: a.unitPose(mid, 'u', sprite)?.clipTime,
      });
      a.prune(end + 1);
      check(leg, {
        rest: a.locomotion(end + 1, 'u', 'idle', sprite),
        idle: a.locomotion(end + 400, 'u', 'idle', sprite),
      });
      t = end + 500;
      at = to;
    }
  }

  for (const sprite of ['unit.earth.linmei', 'unit.water.nilak', 'unit.fire.tenzo', undefined]) {
    it(`keeps the legacy four-way choices exactly for ${sprite ?? 'an unknown sprite'}`, () => {
      let previous: WalkDirection | undefined;
      let facing: 1 | -1 = 1;
      let walking = true;
      walkLegs(sprite, (leg, got) => {
        if (walking) {
          const length = Math.hypot(leg.x, leg.y);
          const tangent = { x: leg.x / length, y: leg.y / length };
          previous = legacyWalkDirection(tangent, previous);
          if (Math.abs(tangent.x) > 0.2) facing = tangent.x > 0 ? 1 : -1;
          const clip = legacyClip('walk', previous);
          const vertical = clip !== 'walk';
          expect(got, `leg ${leg.x},${leg.y}`).toEqual({
            walk: { clip, facing: vertical ? 1 : facing },
            // Legacy gait: 500 ms of clip time per tile.
            clipTime: expect.closeTo(250 * length, 0) as unknown as number,
          });
        } else {
          const rest = legacyClip('rest', previous);
          const idle = legacyClip('idle', previous);
          expect(got, `leg ${leg.x},${leg.y} at rest`).toEqual({
            rest: { clip: rest, facing: rest !== 'rest' ? 1 : facing },
            idle: { clip: idle, facing: idle !== 'idle' ? 1 : facing },
          });
        }
        walking = !walking;
      });
    });
  }

  it("gives a four-way sheet the side walk for Bo's (0.8, -0.6) tangent, and the G party its diagonal", () => {
    const legacy = new Animator(content, { motionReduced: () => false });
    legacy.push(
      0,
      [{ type: 'partyWalked', unitId: 'u', from: { x: 4, y: 4 }, path: [{ x: 8, y: 1 }] }],
      [],
    );
    expect(legacy.locomotion(200, 'u', 'idle', 'unit.earth.linmei')).toEqual({
      clip: 'walk',
      facing: 1,
    });
    for (const sprite of G_PARTY) {
      const g = new Animator(content, { motionReduced: () => false });
      g.push(
        0,
        [{ type: 'partyWalked', unitId: 'u', from: { x: 4, y: 4 }, path: [{ x: 8, y: 1 }] }],
        [],
      );
      expect(g.locomotion(200, 'u', 'idle', sprite)).toEqual({ clip: 'walkNorthEast', facing: 1 });
      g.clear();
      // A cleared animator forgets the eight-way heading with everything else.
      expect(g.locomotion(9999, 'u', 'idle', sprite)).toEqual({ clip: 'idle', facing: 1 });
    }
  });

  for (const sprite of G_PARTY) {
    it(`plays ${sprite}'s eight-way walk at its sheet-declared gait per heading`, () => {
      const sheet = ASSETS[sprite];
      if (sheet?.kind !== 'sheet' || !sheet.locomotion) throw new Error(`${sprite} is eight-way`);
      const a = new Animator(content, { motionReduced: () => false });
      a.push(
        0,
        [{ type: 'partyWalked', unitId: 'u', from: { x: 4, y: 4 }, path: [{ x: 4, y: 8 }] }],
        [],
      );
      const pose = a.unitPose(300, 'u', sprite);
      const legacy = a.unitPose(300, 'u', FOUR_WAY);
      expect(pose?.clipTime).toBeCloseTo(
        ((legacy?.clipTime ?? 0) / 500) * sheet.locomotion.walkMsPerTile.south,
      );
    });

    it(`phases ${sprite}'s oblique eight-way walk by the screen distance a tile covers`, () => {
      const sheet = ASSETS[sprite];
      if (sheet?.kind !== 'sheet' || !sheet.locomotion) throw new Error(`${sprite} is eight-way`);
      const { walkMsPerTile } = sheet.locomotion;
      // Logical +x is screen south-east (1, 0.5); logical (1, 1) is screen south
      // (0, 1) over a route of length sqrt(2); logical (1, -1) is screen east (2, 0).
      for (const [to, expected] of [
        [{ x: 8, y: 4 }, walkMsPerTile.southEast * Math.hypot(1, 0.5)],
        [{ x: 8, y: 8 }, walkMsPerTile.south * Math.SQRT1_2],
        [{ x: 8, y: 0 }, walkMsPerTile.east * Math.SQRT2],
      ] as const) {
        const a = new Animator(content, { motionReduced: () => false });
        a.setProjection('oblique');
        a.push(0, [{ type: 'partyWalked', unitId: 'u', from: { x: 4, y: 4 }, path: [to] }], []);
        const pose = a.unitPose(300, 'u', sprite);
        const legacy = a.unitPose(300, 'u', FOUR_WAY);
        expect(pose?.clipTime).toBeCloseTo(((legacy?.clipTime ?? 0) / 500) * expected);
      }
    });
  }
});

describe('the fighting stance (ADR 0052)', () => {
  it('turns the stance like idle for four-way art, which falls back to its idle', () => {
    expect(directionalClip('stance', 'north')).toBe('stanceNorth');
    expect(directionalClip('stance', 'south')).toBe('stanceSouth');
    expect(directionalClip('stance', 'east')).toBe('stance');
    expect(directionalClip('stance', undefined)).toBe('stance');
  });

  for (const [dx, dy, heading] of [
    [1, 0, ''],
    [1, 1, 'SouthEast'],
    [0, 1, 'South'],
    [-1, 1, 'SouthWest'],
    [-1, 0, 'West'],
    [-1, -1, 'NorthWest'],
    [0, -1, 'North'],
    [1, -1, 'NorthEast'],
  ] as const) {
    it(`walks, settles, then stands guard ${heading || 'East'} for (${dx},${dy})`, () => {
      for (const sprite of G_PARTY) {
        const a = new Animator(content, { motionReduced: () => false });
        a.push(
          0,
          [
            {
              type: 'partyWalked',
              unitId: 'p',
              from: { x: 4, y: 4 },
              path: [1, 2, 3].map((step) => ({ x: 4 + dx * step, y: 4 + dy * step })),
            },
          ],
          [],
        );
        expect(a.locomotion(a.finishesAt / 2, 'p', 'stance', sprite).clip).toBe(`walk${heading}`);
        const done = a.finishesAt + 1;
        a.prune(done);
        expect(a.locomotion(done, 'p', 'stance', sprite).clip).toBe(`rest${heading}`);
        const guard = a.locomotion(done + 300, 'p', 'stance', sprite);
        // Authored for each side, so drawn unflipped whichever way she faces.
        expect(guard.clip).toBe(`stance${heading}`);
        const entry = ASSETS[sprite];
        expect(entry?.kind === 'sheet' && entry.clips[guard.clip]?.frames).toHaveLength(8);
      }
    });
  }

  it('stands a four-way party sheet in its front, back or side idle', () => {
    const a = new Animator(content, { motionReduced: () => false });
    a.push(
      0,
      [{ type: 'partyWalked', unitId: 'p', from: { x: 4, y: 4 }, path: [{ x: 4, y: 3 }] }],
      [],
    );
    const done = a.finishesAt + 400;
    a.prune(done);
    expect(a.locomotion(done, 'p', 'stance', FOUR_WAY).clip).toBe('stanceNorth');
    const entry = ASSETS[FOUR_WAY];
    expect(entry?.kind === 'sheet' && entry.clips.stanceNorth).toBeFalsy();
  });
});

describe('eight-way oblique headings for a declaring sheet', () => {
  for (const [dx, dy, clip] of [
    [1, 0, 'SouthEast'],
    [0, 1, 'SouthWest'],
    [-1, 0, 'NorthWest'],
    [0, -1, 'NorthEast'],
    [1, 1, 'South'],
    [-1, -1, 'North'],
  ] as const) {
    it(`walks, settles and idles ${clip} for (${dx},${dy})`, () => {
      const a = new Animator(content, { motionReduced: () => false });
      a.setProjection('oblique');
      a.push(
        0,
        [
          {
            type: 'partyWalked',
            unitId: 'p',
            from: { x: 4, y: 4 },
            path: [1, 2, 3, 4].map((step) => ({ x: 4 + dx * step, y: 4 + dy * step })),
          },
        ],
        [],
      );
      const kaya = 'unit.fire.kaya';
      expect(a.locomotion(a.finishesAt / 2, 'p', 'idle', kaya).clip).toBe(`walk${clip}`);
      const done = a.finishesAt + 1;
      a.prune(done);
      expect(a.locomotion(done, 'p', 'idle', kaya).clip).toBe(`rest${clip}`);
      expect(a.locomotion(done + 300, 'p', 'idle', kaya).clip).toBe(`idle${clip}`);
    });
  }
});
