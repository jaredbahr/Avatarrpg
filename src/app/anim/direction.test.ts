import { describe, expect, it } from 'vitest';
import { walkDirection, directionalClip } from './direction';
import { Animator } from '../animator';
import type { ContentIndex } from '../../core/types';

const content = { abilities: new Map() } as unknown as ContentIndex;

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
      expect(a.locomotion(a.finishesAt + 1, 'leader')).toEqual({
        clip: `idle${direction}`,
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
