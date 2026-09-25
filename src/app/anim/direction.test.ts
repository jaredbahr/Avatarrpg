import { describe, expect, it } from 'vitest';
import { screenMeleeDirection, walkDirection, directionalClip } from './direction';
import { Animator } from '../animator';
import type { ContentIndex } from '../../core/types';

const content = { abilities: new Map() } as unknown as ContentIndex;

describe('directional walking', () => {
  it('selects each authored octant and retains a heading at rest', () => {
    expect(walkDirection({ x: 0.68, y: -0.72 }, 'east')).toBe('northEast');
    expect(walkDirection({ x: 0.72, y: 0.68 }, 'north')).toBe('southEast');
    expect(walkDirection({ x: 0.2, y: -0.98 }, 'east')).toBe('north');
    expect(walkDirection({ x: -1, y: 0 }, 'north')).toBe('west');
    expect(walkDirection({ x: 0, y: 0 }, 'southWest')).toBe('southWest');
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
      [1, 0, 'walkSouthEast', 1],
      [0, 1, 'walkSouthWest', -1],
      [-1, 0, 'walkNorthWest', -1],
      [0, -1, 'walkNorthEast', 1],
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
    expect(a.locomotion(200, 'p')).toEqual({ clip: 'walkSouthWest', facing: -1 });
    a.setProjection('orthographic');
    expect(a.locomotion(200, 'p')).toEqual({ clip: 'walkSouth', facing: 1 });
  });
});
