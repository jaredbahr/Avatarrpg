import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import type { DayPhase, GameState, MapDef, Vec2 } from '../../core/types';
import {
  residentCompletionBudgetMs,
  residentCompletionPlan,
  residentPhaseChangeSettled,
  waitWithinResidentBudget,
} from '../../../e2e/resident-completion';
import type {
  PlannedResidentTrack,
  ResidentCompletionFrame,
} from '../../../e2e/resident-completion';
import { planResidentMotion } from './residentMotion';

const VILLAGE = CONTENT.maps.get('ba_dan_village') as MapDef;
const SEAT: Vec2 = { x: 10, y: 5 };

function phaseState(phase: DayPhase): GameState {
  const base = createGame(CONTENT, {
    seed: 'resident-motion',
    party: ['kaya', 'sura'].map((characterId) => ({ characterId })),
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    story: { ...base.story, nodeId: 'village_explore', visited: ['mira_intro'] },
    location: { mapId: VILLAGE.id, pos: SEAT },
    world: { ...base.world, clock: { day: 1, phase } },
  };
}

function phaseChangeTracks(): PlannedResidentTrack[] {
  const before = phaseState('midday');
  const after = apply(CONTENT, before, { type: 'wait', until: 'afternoon' }).state;
  const motions = planResidentMotion({
    content: CONTENT,
    map: VILLAGE,
    before,
    after,
    party: [SEAT, { x: 9, y: 5 }],
  });
  return motions.map((motion) => ({ start: 0, motion }));
}

function shortWalk(enter = false, leave = false): PlannedResidentTrack {
  return {
    start: 0,
    motion: {
      kind: 'walk',
      who: { id: 'test-resident', sprite: 'npc.elder' },
      from: { x: 0, y: 0 },
      path: [{ x: 1, y: 0 }],
      enter,
      leave,
    },
  };
}

const settledFrame = (): ResidentCompletionFrame => ({
  moving: false,
  markers: [{ id: 'lw.npc.dorin', pos: { x: 17, y: 6 }, at: { x: 17, y: 6 }, alpha: 1 }],
});

describe('resident phase-change completion budget', () => {
  it('budgets the authored Mira route beyond the old 16.42-second skip', () => {
    const mira = phaseChangeTracks().filter(
      (track) => track.motion.kind === 'walk' && track.motion.who.id === 'lw.npc.mira',
    );
    expect(mira).toHaveLength(1);
    expect(residentCompletionBudgetMs({ clock: 0, tracks: mira })).toBeGreaterThan(16_420);
  });

  it('accepts ordinary completion within the planned virtual-time allowance', async () => {
    let now = 0;
    const completed = await waitWithinResidentBudget(
      180,
      async (step) => {
        now += step;
      },
      async () => now >= 120,
    );
    expect(completed).toBe(true);
    expect(now).toBe(120);
  });

  it('fails within budget when the resident clock is stale', async () => {
    const staleClock = 0;
    let advances = 0;
    const completed = await waitWithinResidentBudget(
      180,
      async () => {
        advances++;
      },
      async () => staleClock >= 120,
    );
    expect(completed).toBe(false);
    expect(advances).toBe(3);
  });

  it('keeps persistent motion and stale markers as failed completion controls', async () => {
    const good = settledFrame();
    expect(residentPhaseChangeSettled(good)).toBe(true);
    expect(residentPhaseChangeSettled({ ...good, moving: true })).toBe(false);
    expect(
      residentPhaseChangeSettled({
        ...good,
        markers: [
          ...good.markers,
          { id: 'lw.npc.mira', pos: { x: 19, y: 15 }, at: { x: 19, y: 15 }, alpha: 0 },
        ],
      }),
    ).toBe(false);
    expect(
      residentPhaseChangeSettled({
        ...good,
        markers: [{ id: 'lw.npc.dorin', pos: { x: 17, y: 6 }, at: { x: 17, y: 6 }, alpha: 0.5 }],
      }),
    ).toBe(false);

    let samples = 0;
    const completed = await waitWithinResidentBudget(
      120,
      async () => {
        samples++;
      },
      async () => residentPhaseChangeSettled({ ...good, moving: true }),
    );
    expect(completed).toBe(false);
    expect(samples).toBe(2);
  });

  it('consumes a non-multiple poll budget exactly', async () => {
    const steps: number[] = [];
    await waitWithinResidentBudget(
      125,
      async (step) => {
        steps.push(step);
      },
      async () => false,
    );
    expect(steps).toEqual([60, 60, 5]);
  });

  it('subtracts elapsed resident time from the authored route horizon', () => {
    const tracks = phaseChangeTracks().filter(
      (track) => track.motion.kind === 'walk' && track.motion.who.id === 'lw.npc.mira',
    );
    const start = residentCompletionPlan({ clock: 0, tracks });
    const elapsed = residentCompletionPlan({ clock: 5_000, tracks });
    expect(elapsed.authoredRemainingMs).toBe(start.authoredRemainingMs - 5_000);
  });

  it('starts rendered polling before the authored end and keeps finite slack after it', () => {
    const tracks = phaseChangeTracks().filter(
      (track) => track.motion.kind === 'walk' && track.motion.who.id === 'lw.npc.mira',
    );
    const plan = residentCompletionPlan({ clock: 0, tracks });
    expect(plan.interiorMs).toBeLessThanOrEqual(plan.authoredRemainingMs);
    expect(plan.authoredRemainingMs - plan.interiorMs).toBe(240);
    expect(plan.totalBudgetMs).toBe(plan.interiorMs + plan.renderedMs);
    expect(plan.totalBudgetMs).toBe(plan.authoredRemainingMs + 100);
  });

  it('accounts for both entry and exit fades in planned walk duration', () => {
    const base = residentCompletionPlan({ clock: 0, tracks: [shortWalk()] });
    const faded = residentCompletionPlan({ clock: 0, tracks: [shortWalk(true, true)] });
    expect(faded.authoredRemainingMs - base.authoredRemainingMs).toBe(640);
  });

  it('ignores a stale runtime end timestamp when deriving its own route horizon', () => {
    const track = phaseChangeTracks().find(
      (planned) => planned.motion.kind === 'walk' && planned.motion.who.id === 'lw.npc.mira',
    );
    expect(track).toBeDefined();
    const staleEnd = { ...track!, end: Number.POSITIVE_INFINITY } as PlannedResidentTrack;
    expect(residentCompletionPlan({ clock: 0, tracks: [staleEnd] })).toEqual(
      residentCompletionPlan({ clock: 0, tracks: [track!] }),
    );
  });

  it('rejects malformed and non-finite budgets', async () => {
    expect(() => residentCompletionBudgetMs({ clock: Number.NaN, tracks: [] })).toThrow(
      /clock must be finite/,
    );
    expect(() =>
      residentCompletionBudgetMs({
        clock: 0,
        tracks: [{ start: Infinity, motion: { kind: 'fade', from: null, to: null } }],
      }),
    ).toThrow(/start must be finite/);
    expect(() =>
      residentCompletionBudgetMs({
        clock: 0,
        tracks: [{ start: 180_000, motion: { kind: 'fade', from: null, to: null } }],
      }),
    ).toThrow(/exceeds 180000 ms/);
    const invalidWalk = shortWalk();
    if (invalidWalk.motion.kind !== 'walk') throw new Error('Expected walk fixture');
    expect(() =>
      residentCompletionPlan({
        clock: 0,
        tracks: [
          {
            ...invalidWalk,
            motion: { ...invalidWalk.motion, from: { x: Number.NaN, y: 0 } },
          },
        ],
      }),
    ).toThrow(/coordinates must be finite/);
    await expect(
      waitWithinResidentBudget(
        Number.POSITIVE_INFINITY,
        async () => {},
        async () => false,
      ),
    ).rejects.toThrow(/budget must be finite/);
    await expect(
      waitWithinResidentBudget(
        180_001,
        async () => {},
        async () => false,
      ),
    ).rejects.toThrow(/exceeds 180000 ms/);
  });
});
