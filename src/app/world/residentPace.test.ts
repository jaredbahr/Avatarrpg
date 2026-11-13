import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import type { GameState, MapDef } from '../../core/types';
import type { ResidentRoutine } from '../../content/schemas';
import { createGame } from '../../core/state/createGame';
import { Animator } from '../animator';
import { ResidentWalks } from './residentMotion';

const map = CONTENT.maps.get('ba_dan_village') as MapDef;
const party = [{ x: 22, y: 18 }];
const GAO = 'lw.npc.gao';

function state(phase: 'morning' | 'midday'): GameState {
  const base = createGame(CONTENT, {
    seed: 'resident-pace',
    party: [{ characterId: 'kaya' }],
    startNode: 'village_explore',
  });
  return {
    ...base,
    screen: 'explore',
    story: { ...base.story, nodeId: 'village_explore', visited: ['mira_intro'] },
    location: { mapId: map.id, pos: { x: 10, y: 5 } },
    world: { ...base.world, clock: { day: 1, phase } },
  };
}

function clock(walks: ResidentWalks) {
  let now = 0;
  walks.tick(0, false);
  return (target: number) => {
    while (now < target) {
      now = Math.min(target, now + 100);
      walks.tick(now, false);
    }
  };
}

describe('the complete resident amble schedule', () => {
  it('keeps an errand’s original ramps, 2 s/tile cruise, arrival and hold', () => {
    const routine: ResidentRoutine = {
      id: GAO,
      mapId: map.id,
      anchor: 'bd02.shopfront',
      activities: ['short_stock_service'],
      legs: [
        { path: [{ x: 9, y: 5 }], hold: 5000 },
        { path: [{ x: 9, y: 4 }], hold: 0 },
      ],
    };
    const walks = new ResidentWalks(CONTENT, () => false, [routine]);
    const advance = clock(walks);
    const before = state('morning');
    walks.update(map, before, party, true);
    const gao = () => walks.figures().find((figure) => figure.id === GAO);
    expect(gao()?.drawPos).toEqual({ x: 9, y: 4 });
    for (const [time, y] of [
      [320, 4.08],
      [1000, 4.42],
      [2160, 4.98],
    ] as const) {
      advance(time);
      expect(gao()?.drawPos.y).toBeCloseTo(y, 9);
    }
    advance(2320);
    expect(gao()).toMatchObject({ drawPos: { x: 9, y: 5 }, walking: false });
    advance(7319);
    walks.update(map, before, party, true);
    expect(gao()).toMatchObject({ drawPos: { x: 9, y: 5 }, walking: false });
    advance(7320);
    walks.update(map, before, party, true);
    advance(7640);
    expect(gao()?.drawPos.y).toBeCloseTo(4.92, 9);
  });

  it('retains the private amble animator’s ramp, settle and reduced-motion timing', () => {
    for (const reduced of [false, true]) {
      const animator = new Animator(CONTENT, { motionReduced: () => reduced, amble: true });
      animator.push(
        0,
        [
          {
            type: 'partyWalked',
            unitId: 'm',
            from: { x: 4, y: 4 },
            path: [{ x: 5, y: 4 }],
          },
        ],
        [],
      );
      expect(animator.finishesAt).toBeCloseTo(reduced ? 2.2 : 870, 9);
      // At the same fraction of playback, reduced motion retains the original ramp shape.
      expect(animator.renderPos((animator.finishesAt * 120) / 870, 'm')?.x).toBeCloseTo(4.08, 9);
      if (!reduced) {
        expect(animator.locomotion(1009, 'm', 'idle', 'npc.elder').clip).toMatch(/^walk/);
        expect(animator.locomotion(1011, 'm', 'idle', 'npc.elder').clip).toMatch(/^idle/);
      }
    }
  });
});
