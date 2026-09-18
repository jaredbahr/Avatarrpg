import { describe, expect, it } from 'vitest';
import type { ContentIndex, GameEvent, Unit } from '../core/types';
import { Animator } from './animator';
import { CONTENT } from '../content';
import { sampleParticles, PARTICLE_STRIDE } from '../render/fx/simulate';

/**
 * The animator runs in Node here with the reduce-motion lookup injected, so
 * these cover the contract the scenes and the e2e `waitForIdle` rely on:
 * where a unit is drawn mid-move, when playback ends, and which way a unit
 * faces after it has walked.
 */

const content = { abilities: new Map() } as unknown as ContentIndex;

const unit = (id: string, x: number, y: number): Unit =>
  ({ id, pos: { x, y }, faction: 'party', size: 1 }) as unknown as Unit;

const moved = (unitId: string, ...path: [number, number][]): GameEvent => ({
  type: 'unitMoved',
  unitId,
  path: path.map(([x, y]) => ({ x, y })),
  cost: path.length,
});

function animator(reduced = false): Animator {
  return new Animator(content, { motionReduced: () => reduced });
}

describe('Animator', () => {
  it('shows every area cel before debris spends the Canvas particle budget', () => {
    for (const abilityId of ['shockwave', 'tidal_wave', 'tornado']) {
      const a = new Animator(CONTENT, { motionReduced: () => false });
      const tiles = Array.from({ length: 25 }, (_, i) => ({
        x: 3 + (i % 5),
        y: 3 + Math.floor(i / 5),
      }));
      a.push(
        0,
        [{ type: 'abilityUsed', unitId: 'p0', abilityId, target: { x: 5, y: 5 }, tiles }],
        [unit('p0', 2, 5)],
      );
      let used = 0,
        cels = 0,
        drawn = 0;
      for (const instance of a.emitters(650)) {
        const def = instance.def;
        if (def.kind !== 'particles' || def.layer !== 'over') continue;
        const count = sampleParticles(
          def,
          instance.elapsed,
          instance.seed,
          instance.from,
          instance.to,
          new Float32Array(120 * PARTICLE_STRIDE),
        );
        if (def.cel && count) {
          cels++;
          if (used < 96) drawn++;
        }
        used += count;
      }
      expect(cels, abilityId).toBeGreaterThanOrEqual(24);
      expect(drawn, abilityId).toBe(cels);
    }
  });

  for (const reduced of [false, true]) {
    it(`keeps the attack facing after recovery (reduced motion: ${reduced})`, () => {
      const a = new Animator(CONTENT, { motionReduced: () => reduced });
      a.push(0, [moved('p0', [4, 3])], [unit('p0', 4, 4)]);
      a.prune(500);
      expect(a.locomotion(500, 'p0').clip).toBe('idleNorth');
      a.push(
        1000,
        [
          {
            type: 'abilityUsed',
            unitId: 'p0',
            abilityId: 'fire_jab',
            target: { x: 1, y: 3 },
            tiles: [{ x: 1, y: 3 }],
          },
        ],
        [unit('p0', 4, 3)],
      );
      // A queued action cannot turn the character before it starts.
      expect(a.locomotion(999, 'p0').clip).toBe('idleNorth');
      expect(a.unitPose(1000, 'p0')?.facing).toBe(-1);
      a.prune(a.finishesAt + 1);
      expect(a.locomotion(a.finishesAt + 1, 'p0')).toEqual({ clip: 'idle', facing: -1 });
      a.clear();
      expect(a.locomotion(9999, 'p0')).toEqual({ clip: 'idle', facing: 1 });
    });

    it(`resolves skipped walk and attack headings in playback order (reduced motion: ${reduced})`, () => {
      const a = new Animator(CONTENT, { motionReduced: () => reduced });
      a.push(
        0,
        [
          moved('p0', [4, 3]),
          {
            type: 'abilityUsed',
            unitId: 'p0',
            abilityId: 'fire_jab',
            target: { x: 1, y: 3 },
            tiles: [{ x: 1, y: 3 }],
          },
        ],
        [unit('p0', 4, 4)],
      );
      // No intermediate rendered frame, as when returning from a hidden tab.
      a.prune(a.finishesAt + 1);
      expect(a.locomotion(a.finishesAt + 1, 'p0')).toEqual({ clip: 'idle', facing: -1 });
      a.push(a.finishesAt + 10, [moved('p0', [4, 4])], [unit('p0', 4, 3)]);
      a.prune(a.finishesAt + 1);
      expect(a.locomotion(a.finishesAt + 1, 'p0')).toEqual({ clip: 'idleSouth', facing: 1 });
    });
  }

  it('slides backward in the struck stance without a walking bounce or turn', () => {
    const a = animator();
    a.push(0, [moved('p0', [3, 4])], [unit('p0', 4, 4)]);
    a.prune(500);
    a.push(1000, [{ type: 'unitPushed', unitId: 'p0', to: { x: 5, y: 4 } }], [unit('p0', 3, 4)]);
    for (const at of [1000, 1050, 1110, 1210]) {
      expect(a.renderPos(at, 'p0')?.y).toBe(4);
      expect(a.unitPose(at, 'p0')?.clip).toBe('hit');
      expect(a.unitPose(at, 'p0')?.offset).toEqual({ x: 0, y: 0 });
      expect(a.offset(at, 'p0')).toBeUndefined();
      expect(a.locomotion(at, 'p0')).toEqual({ clip: 'idle', facing: -1 });
    }
    a.prune(a.finishesAt + 1);
    expect(a.locomotion(a.finishesAt + 1, 'p0')).toEqual({ clip: 'idle', facing: -1 });
    expect(a.renderPos(a.finishesAt + 1, 'p0')).toBeUndefined();
  });

  it('does not lose the north-facing idle when an unrendered push moves south', () => {
    const a = animator(true);
    a.push(0, [moved('p0', [4, 3])], [unit('p0', 4, 4)]);
    a.push(100, [{ type: 'unitPushed', unitId: 'p0', to: { x: 4, y: 5 } }], [unit('p0', 4, 3)]);
    a.prune(500);
    expect(a.locomotion(500, 'p0')).toEqual({ clip: 'idleNorth', facing: 1 });
  });

  it('settles a diagonal final stride onto the ground before going idle', () => {
    const a = animator();
    a.push(
      1000,
      [{ type: 'partyWalked', unitId: 'p0', from: { x: 1, y: 1 }, path: [{ x: 2, y: 2 }] }],
      [],
    );
    const end = a.finishesAt;
    expect(Math.abs(a.offset(end - 1, 'p0')?.y ?? 1)).toBeLessThan(0.001);
    expect(a.offset(end, 'p0')?.y).toBeCloseTo(0, 9);
    expect(a.unitPose(end, 'p0')?.offset.y).toBeCloseTo(0, 9);
    expect(a.renderPos(end, 'p0')).toEqual({ x: 2, y: 2 });
  });
  it('keeps a strolling follower in formation without duplicating footsteps', () => {
    const heard: string[] = [];
    const a = new Animator(content, {
      motionReduced: () => false,
      onSounds: (cues) => heard.push(...cues.map((cue) => cue.key)),
    });
    for (const [id, start] of [
      ['leader', 1],
      ['follower', 0],
    ] as const) {
      a.push(
        1000,
        [
          {
            type: 'partyWalked',
            unitId: id,
            from: { x: start, y: 3 },
            path: Array.from({ length: 6 }, (_, i) => ({ x: start + i + 1, y: 3 })),
          },
        ],
        [],
        { alongside: id === 'follower' },
      );
    }
    expect(a.finishesAt - 1000).toBeGreaterThan(1500);
    for (const at of [1050, 1400, 1800, 2400]) {
      const leader = a.renderPos(at, 'leader'),
        follower = a.renderPos(at, 'follower');
      expect((leader?.x ?? 0) - (follower?.x ?? 0)).toBeCloseTo(1, 6);
      expect(a.unitPose(at, 'leader')?.clipTime).toBeCloseTo(
        a.unitPose(at, 'follower')?.clipTime ?? 0,
        6,
      );
    }
    expect(heard).toEqual(Array(6).fill('step'));
  });
  it('is idle until something is pushed, then busy for the walk', () => {
    const a = animator();
    expect(a.busy(0)).toBe(false);
    a.push(1000, [moved('p0', [2, 3], [3, 3], [4, 3])], [unit('p0', 1, 3)]);
    expect(a.busy(1000)).toBe(true);
    // Three steps at 110 ms each.
    expect(a.finishesAt).toBe(1000 + 330);
    expect(a.busy(1330)).toBe(false);
  });

  it('draws the walker at its start and at its destination', () => {
    const a = animator();
    a.push(1000, [moved('p0', [2, 3], [3, 3], [3, 4])], [unit('p0', 1, 3)]);
    expect(a.renderPos(1000, 'p0')).toEqual({ x: 1, y: 3 });
    const end = a.renderPos(1330, 'p0');
    expect(end?.x).toBeCloseTo(3, 6);
    expect(end?.y).toBeCloseTo(4, 6);
    expect(a.renderPos(1331, 'p0')).toBeUndefined();
  });

  it('eases along the route rather than hopping tile to tile', () => {
    const a = animator();
    a.push(0, [moved('p0', [1, 0], [2, 0], [3, 0], [4, 0])], [unit('p0', 0, 0)]);
    // A quarter of the way through the time, an eased walk has covered
    // less than a quarter of the distance; halfway through, exactly half.
    const early = a.renderPos(110, 'p0');
    expect(early?.x ?? 0).toBeLessThan(1);
    expect(early?.x ?? 0).toBeGreaterThan(0);
    const mid = a.renderPos(220, 'p0');
    expect(mid?.x).toBeCloseTo(2, 6);
    expect(mid?.y).toBeCloseTo(0, 6);
  });

  it('rounds the corner of a turn without leaving the tiles walked', () => {
    const a = animator();
    a.push(0, [moved('p0', [1, 0], [1, 1])], [unit('p0', 0, 0)]);
    for (let t = 0; t <= 220; t += 10) {
      const p = a.renderPos(t, 'p0');
      if (!p) continue;
      const inside =
        (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 0) ||
        (p.x >= 1 && p.x <= 1 && p.y >= 0 && p.y <= 1) ||
        (p.x >= 0 && p.x <= 1 && Math.abs(p.y) < 1e-9) ||
        (Math.abs(p.x - 1) < 1e-9 && p.y >= 0 && p.y <= 1) ||
        // Inside the triangle of the three centres, in corner coordinates.
        (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= p.x + 1e-9);
      expect(inside, `${p.x},${p.y} at ${t}`).toBe(true);
    }
  });

  it('turns to face the way it walks and keeps facing that way', () => {
    const a = animator();
    expect(a.facing('p0')).toBeUndefined();
    a.push(0, [moved('p0', [1, 5], [0, 5])], [unit('p0', 2, 5)]);
    a.renderPos(50, 'p0');
    expect(a.facing('p0')).toBe(-1);
    a.renderPos(500, 'p0');
    expect(a.facing('p0')).toBe(-1);
    a.push(1000, [moved('p0', [1, 5])], [unit('p0', 0, 5)]);
    a.renderPos(1050, 'p0');
    expect(a.facing('p0')).toBe(1);
  });

  it('bobs once per tile and never offsets a unit that is standing still', () => {
    const a = animator();
    expect(a.offset(0, 'p0')).toBeUndefined();
    a.push(0, [moved('p0', [1, 0], [2, 0])], [unit('p0', 0, 0)]);
    const mid = a.offset(110, 'p0');
    expect(mid?.x).toBe(0);
    // Half a tile of travel is the top of the first bob.
    expect(mid?.y ?? 0).toBeLessThan(0);
    expect(a.offset(221, 'p0')).toBeUndefined();
  });

  it('collapses to a single frame under reduce motion', () => {
    const a = animator(true);
    a.push(1000, [moved('p0', [2, 3], [3, 3], [4, 3])], [unit('p0', 1, 3)]);
    expect(a.finishesAt - 1000).toBeLessThan(10);
  });

  it('slides a pushed unit straight to its tile', () => {
    const a = animator();
    a.push(0, [{ type: 'unitPushed', unitId: 'e0', to: { x: 5, y: 4 } }], [unit('e0', 4, 4)]);
    const p = a.renderPos(110, 'e0');
    expect(p?.y).toBeCloseTo(4, 6);
    expect(p?.x ?? 0).toBeGreaterThan(4);
    expect(p?.x ?? 0).toBeLessThan(5);
  });
});

it('holds a queued move origin without starting its turn, gait or bob early', () => {
  const a = animator();
  a.push(1000, [moved('p', [3, 5], [3, 6])], [unit('p', 3, 4)]);
  expect(a.renderPos(999, 'p')).toEqual({ x: 3, y: 4 });
  expect(a.locomotion(999, 'p')).toEqual({ clip: 'idle', facing: 1 });
  expect(a.offset(999, 'p')).toBeUndefined();
  expect(a.unitPose(999, 'p')).toBeUndefined();
  expect(a.renderPos(999, 'other')).toBeUndefined();
  expect(a.locomotion(1050, 'p').clip).toBe('walkSouth');
  const done = a.finishesAt + 1;
  a.prune(done);
  expect(a.renderPos(done, 'p')).toBeUndefined();
});

it('holds the next route origin through a gap between batches, including after pruning', () => {
  const a = animator();
  a.push(0, [moved('p', [4, 4])], [unit('p', 3, 4)]);
  const firstEnd = a.finishesAt;
  a.push(2000, [moved('p', [4, 5])], [unit('p', 4, 4)]);
  a.prune(firstEnd + 1);
  expect(a.renderPos(1000, 'p')).toEqual({ x: 4, y: 4 });
  expect(a.locomotion(1000, 'p')).toEqual({ clip: 'idle', facing: 1 });
  expect(a.offset(1000, 'p')).toBeUndefined();
  expect(a.renderPos(a.finishesAt + 1, 'p')).toBeUndefined();
});

it('silences a sequential follower batch without moving its start alongside the leader', () => {
  const sounds: string[] = [];
  const a = new Animator(content, {
    motionReduced: () => false,
    onSounds: (cues) => sounds.push(...cues.map((cue) => cue.key)),
  });
  const leader: GameEvent = {
    type: 'partyWalked',
    unitId: 'leader',
    from: { x: 2, y: 4 },
    path: [
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ],
  };
  const follower: GameEvent = {
    type: 'partyWalked',
    unitId: 'follower',
    from: { x: 1, y: 4 },
    path: [
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ],
  };
  a.push(0, [leader], []);
  const firstEnd = a.finishesAt,
    firstSounds = [...sounds];
  expect(firstSounds.length).toBeGreaterThan(0);
  a.push(0, [follower], [], { silentSteps: true });
  expect(a.finishesAt).toBeGreaterThan(firstEnd);
  expect(sounds).toEqual(firstSounds);
  expect(a.renderPos(firstEnd / 2, 'follower')).toEqual({ x: 1, y: 4 });
  expect(a.locomotion(firstEnd / 2, 'follower').clip).toBe('idle');
  expect(a.locomotion(firstEnd + 50, 'follower').clip).toBe('walk');
});
