import { describe, expect, it } from 'vitest';
import type { ContentIndex, GameEvent, Unit } from '../core/types';
import { Animator } from './animator';
import { CONTENT } from '../content';
import { sampleParticles, PARTICLE_STRIDE } from '../render/fx/simulate';
import { choreograph } from './anim/choreography';

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

const combatUnit = (id: string, x: number, y: number, hp: number, maxHp = 20): Unit =>
  ({
    ...unit(id, x, y),
    hp,
    base: { maxHp },
    sprite: id === 'e0' ? 'unit.enemy.thug' : 'unit.air.nima',
  }) as unknown as Unit;

const airBlast: GameEvent = {
  type: 'abilityUsed',
  unitId: 'p0',
  abilityId: 'air_blast',
  target: { x: 5, y: 3 },
  tiles: [{ x: 5, y: 3 }],
};

describe('Animator', () => {
  it.each([false, true])('holds damage feedback until Air Blast impact, reduced=%s', (reduced) => {
    const before = [combatUnit('p0', 1, 3, 20), combatUnit('e0', 5, 3, 20)];
    const events: GameEvent[] = [
      airBlast,
      { type: 'damaged', unitId: 'e0', amount: 6, crit: false, damageType: 'air', sourceId: 'p0' },
    ];
    const choreography = choreograph({
      content: CONTENT,
      events,
      unitsBefore: before,
      cursor: 1000,
      rate: reduced ? 0.02 : 1,
      pushIndex: 0,
    });
    const impact = choreography.health.find((change) => change.unitId === 'e0');
    if (!impact) throw new Error('expected Air Blast health impact');
    const flash = choreography.tracks.find(
      (track) => track.kind === 'flash' && track.unitId === 'e0',
    );
    const cast = choreography.tracks.find(
      (track) => track.kind === 'pose' && track.unitId === 'p0' && track.clip === 'cast',
    );
    if (!flash || !cast) throw new Error('expected Air Blast impact choreography');
    expect(impact.at).toBe(flash.start);
    expect(impact.at).toBeGreaterThan(cast.start);

    const a = new Animator(CONTENT, { motionReduced: () => reduced });
    a.push(1000, events, before);
    const after = combatUnit('e0', 5, 3, 14);
    expect(a.unitHealth(impact.at - 0.01, after)).toEqual({ hp: 20, fallen: false });
    expect(a.unitHealth(impact.at, after)).toEqual({ hp: 14, fallen: false });
  });

  it('keeps queued damage and healing ordered, delays a KO to its fall, and clears presentation state', () => {
    const a = new Animator(CONTENT, { motionReduced: () => false });
    const roster = [combatUnit('p0', 1, 3, 20), combatUnit('e0', 5, 3, 20)];
    const damage: GameEvent[] = [
      airBlast,
      { type: 'damaged', unitId: 'e0', amount: 6, crit: false, damageType: 'air', sourceId: 'p0' },
    ];
    const first = choreograph({
      content: CONTENT,
      events: damage,
      unitsBefore: roster,
      cursor: 0,
      rate: 1,
      pushIndex: 0,
    }).health[0];
    if (!first) throw new Error('expected damage health timing');
    a.push(0, damage, roster);

    const healedBefore = [combatUnit('p0', 1, 3, 20), combatUnit('e0', 5, 3, 14)];
    a.push(1, [{ type: 'healed', unitId: 'e0', amount: 4 }], healedBefore);
    const healed = combatUnit('e0', 5, 3, 18);
    expect(a.unitHealth(first.at, healed)).toEqual({ hp: 14, fallen: false });
    expect(a.unitHealth(a.finishesAt, healed)).toEqual({ hp: 18, fallen: false });

    const lethalBefore = [combatUnit('p0', 1, 3, 20), combatUnit('e0', 5, 3, 18)];
    const lethal: GameEvent[] = [
      {
        type: 'damaged',
        unitId: 'e0',
        amount: 18,
        crit: false,
        damageType: 'pure',
        sourceId: 'p0',
      },
      { type: 'unitDied', unitId: 'e0' },
    ];
    const lethalTiming = choreograph({
      content: CONTENT,
      events: lethal,
      unitsBefore: lethalBefore,
      cursor: a.finishesAt,
      rate: 1,
      pushIndex: 2,
    }).health;
    const empty = lethalTiming[0],
      fallen = lethalTiming[1];
    if (!empty || !fallen) throw new Error('expected lethal health timing');
    a.push(2, lethal, lethalBefore);
    const dead = combatUnit('e0', 5, 3, 0);
    expect(a.unitHealth(empty.at, dead)).toEqual({ hp: 0, fallen: false });
    expect(a.unitHealth(fallen.at, dead)).toEqual({ hp: 0, fallen: true });
    a.prune(a.finishesAt + 1);
    expect(a.unitHealth(a.finishesAt + 1, dead)).toEqual({ hp: 0, fallen: true });
    const refreshed = combatUnit('e0', 5, 3, 7, 30);
    expect(a.unitHealth(a.finishesAt + 1, refreshed)).toEqual({ hp: 7, fallen: false });
    a.clear();
    expect(a.unitHealth(0, dead)).toEqual({ hp: 0, fallen: true });
  });

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
      // The walk's stop holds the settled pose its facing implies for a beat
      // before the ready stance is selected; reduce motion collapses the beat.
      expect(a.locomotion(500, 'p0').clip).toBe(reduced ? 'idleNorth' : 'restNorth');
      a.prune(600);
      expect(a.locomotion(600, 'p0').clip).toBe('idleNorth');
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
      // The southward stop settles facing south, then keeps that facing at rest.
      expect(a.locomotion(a.finishesAt + 1, 'p0')).toEqual({ clip: 'restSouth', facing: 1 });
      expect(a.locomotion(a.finishesAt + 300, 'p0')).toEqual({ clip: 'idleSouth', facing: 1 });
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
    // Three tiles at cruising pace plus short acceleration and braking.
    expect(a.finishesAt).toBe(1960);
    expect(a.busy(1959)).toBe(true);
    expect(a.busy(1960)).toBe(false);
  });

  it('draws the walker at its start and at its destination', () => {
    const a = animator();
    a.push(1000, [moved('p0', [2, 3], [3, 3], [3, 4])], [unit('p0', 1, 3)]);
    expect(a.renderPos(1000, 'p0')).toEqual({ x: 1, y: 3 });
    const end = a.renderPos(a.finishesAt, 'p0');
    expect(end?.x).toBeCloseTo(3, 6);
    expect(end?.y).toBeCloseTo(4, 6);
    expect(a.renderPos(a.finishesAt + 1, 'p0')).toBeUndefined();
  });

  it('eases along the route rather than hopping tile to tile', () => {
    const a = animator();
    a.push(0, [moved('p0', [1, 0], [2, 0], [3, 0], [4, 0])], [unit('p0', 0, 0)]);
    // A quarter of the way through the time, an eased walk has covered
    // less than a quarter of the distance; halfway through, exactly half.
    const early = a.renderPos(a.finishesAt / 4, 'p0');
    expect(early?.x ?? 0).toBeLessThan(1);
    expect(early?.x ?? 0).toBeGreaterThan(0);
    const mid = a.renderPos(a.finishesAt / 2, 'p0');
    expect(mid?.x).toBeCloseTo(2, 6);
    expect(mid?.y).toBeCloseTo(0, 6);
  });

  it('rounds the corner of a turn without leaving the tiles walked', () => {
    const a = animator();
    a.push(0, [moved('p0', [1, 0], [1, 1])], [unit('p0', 0, 0)]);
    for (let t = 0; t <= a.finishesAt; t += 10) {
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

  it('carries one distance phase across tile boundaries, then settles into combat ready stance', () => {
    const a = animator();
    a.push(0, [moved('p0', [1, 0], [2, 0], [3, 0], [4, 0])], [unit('p0', 0, 0)]);
    let previous = -1;
    for (const at of [200, 339, 341, 619, 621, 900, a.finishesAt]) {
      const x = a.renderPos(at, 'p0')?.x ?? -1;
      const phase = a.unitPose(at, 'p0')?.clipTime ?? -1;
      expect(phase).toBeCloseTo(x * 500, 8);
      expect(phase).toBeGreaterThan(previous);
      previous = phase;
    }
    a.prune(a.finishesAt + 1);
    // The route's end holds the settled stop pose; the ready stance follows it.
    expect(a.locomotion(a.finishesAt + 1, 'p0')).toEqual({ clip: 'rest', facing: 1 });
    expect(a.unitPose(a.finishesAt + 1, 'p0')).toBeUndefined();
    expect(a.locomotion(a.finishesAt + 300, 'p0')).toEqual({ clip: 'idle', facing: 1 });
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
    const mid = a.offset(200, 'p0');
    expect(mid?.x).toBe(0);
    // Half a tile of travel is the top of the first bob.
    expect(mid?.y ?? 0).toBeLessThan(0);
    expect(mid?.y).toBeCloseTo(-0.05, 9);
    expect(a.offset(a.finishesAt + 1, 'p0')).toBeUndefined();
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

describe('delayed movement batches', () => {
  for (const reduced of [false, true]) {
    it(`keeps independent follower delays and queues the next batch after the longest route, reduced=${reduced}`, () => {
      const rate = reduced ? 0.02 : 1;
      const sounds: string[] = [];
      const a = new Animator(content, {
        motionReduced: () => reduced,
        onSounds: (cues) => sounds.push(...cues.map((cue) => cue.key)),
      });
      const walk = (unitId: string, y: number): GameEvent => ({
        type: 'partyWalked',
        unitId,
        from: { x: 2, y },
        path: [
          { x: 3, y },
          { x: 4, y },
        ],
      });
      const base = 1000;
      a.push(base, [walk('leader', 1)], [], { delayMs: 600 });
      const latestEnd = a.finishesAt,
        leaderSounds = [...sounds];
      expect(leaderSounds.length).toBeGreaterThan(0);
      a.push(base, [walk('first', 2)], [], { alongside: true, delayMs: 100, silentSteps: true });
      a.push(base, [walk('second', 3)], [], { alongside: true, delayMs: 300, silentSteps: true });
      expect(a.finishesAt).toBe(latestEnd);
      expect(sounds).toEqual(leaderSounds);
      for (const [id, y, delay] of [
        ['first', 2, 100],
        ['second', 3, 300],
        ['leader', 1, 600],
      ] as const) {
        const start = base + delay * rate;
        expect(a.renderPos(start - 0.01, id)).toEqual({ x: 2, y });
        expect(a.locomotion(start - 0.01, id).clip).toBe('idle');
        expect(a.offset(start - 0.01, id)).toBeUndefined();
        expect(a.locomotion(start + 0.01, id).clip).toBe('walk');
      }
      a.push(base, [walk('next', 4)], [], { silentSteps: true });
      expect(a.finishesAt).toBeGreaterThan(latestEnd);
      expect(a.renderPos(latestEnd - 0.01, 'next')).toEqual({ x: 2, y: 4 });
      expect(a.locomotion(latestEnd - 0.01, 'next').clip).toBe('idle');
      expect(a.locomotion(latestEnd + 0.01, 'next').clip).toBe('walk');
      expect(sounds).toEqual(leaderSounds);
    });

    it(`clamps negative delays and scales the requested delay once, reduced=${reduced}`, () => {
      const baseline = animator(reduced),
        delayed = animator(reduced),
        negative = animator(reduced);
      const events = [moved('p', [3, 4])];
      const roster = [unit('p', 2, 4)];
      baseline.push(100, events, roster);
      negative.push(100, events, roster, { delayMs: -500 });
      delayed.push(100, events, roster, { delayMs: 500 });
      expect(negative.finishesAt).toBe(baseline.finishesAt);
      expect(delayed.finishesAt - baseline.finishesAt).toBeCloseTo(500 * (reduced ? 0.02 : 1));
      expect(delayed.renderPos(100, 'p')).toEqual({ x: 2, y: 4 });
      expect(delayed.locomotion(100, 'p').clip).toBe('idle');
      expect(delayed.offset(100, 'p')).toBeUndefined();
    });
  }
});
