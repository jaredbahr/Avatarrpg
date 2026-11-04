import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../content';
import { cachedGrid, pathCost, posKey } from '../../core/rules/grid';
import { createGame } from '../../core/state/createGame';
import { apply } from '../../core/state/reducer';
import { backgroundFigures, visibleNpcs } from '../../core/story/world';
import type { Vec2 } from '../../core/types';
import { sampleAt, smoothPath } from '../../render/geometry/curve';
import { TIMING } from './choreography';
import { strollTiming } from './stroll';
import { PartyTrail } from './trail';

const village = (() => {
  const map = CONTENT.maps.get('ba_dan_village');
  if (!map) throw new Error('Missing Ba Dan village');
  return map;
})();
const grid = cachedGrid(village);

const observedSeats: readonly (readonly Vec2[])[] = [
  [
    { x: 8, y: 4 },
    { x: 8, y: 5 },
    { x: 9, y: 5 },
  ],
  [
    { x: 8, y: 4 },
    { x: 8, y: 5 },
    { x: 9, y: 5 },
    { x: 9, y: 6 },
    { x: 10, y: 4 },
    { x: 10, y: 3 },
  ],
];

describe('clearance dependencies beside the village canal', () => {
  it.each(observedSeats.map((seats) => ({ seats, count: seats.length })))(
    'clears the observed $count-person formation before approaching Mira',
    ({ seats }) => {
      // Core fixture at the settled seats recorded by normal native play; no content is changed.
      const base = createGame(CONTENT, {
        seed: 'follower-clearance',
        party: ['kaya', 'sura', 'bo', 'wen', 'nima', 'jinu']
          .slice(0, seats.length)
          .map((characterId) => ({ characterId })),
        startNode: 'village_explore',
      });
      const state = {
        ...base,
        screen: 'explore' as const,
        location: { mapId: village.id, pos: { x: 8, y: 4 } },
      };
      const result = apply(CONTENT, state, { type: 'walkTo', pos: { x: 11, y: 5 } });
      const path = result.events.find((event) => event.type === 'partyWalked')?.path;
      if (!path) throw new Error('Mira approach must walk');
      expect(path).toEqual([
        { x: 8, y: 5 },
        { x: 9, y: 5 },
        { x: 10, y: 5 },
      ]);
      const avoid = [
        ...visibleNpcs(CONTENT, village, state),
        ...backgroundFigures(CONTENT, village, state),
      ].map((person) => person.pos);
      const before = structuredClone(seats);
      const trail = new PartyTrail(seats, { climbCost: CONTENT.tuning.climbCost });
      const plan = trail.planWalk(path, seats.length, grid, avoid);
      expect(plan).not.toBeNull();
      if (!plan) return;
      expect(seats).toEqual(before);
      const replay = new PartyTrail(seats, { climbCost: CONTENT.tuning.climbCost });
      expect(replay.planWalk(path, seats.length, grid, avoid)).toEqual(plan);
      expect(replay.positions(seats.length)).toEqual(trail.positions(seats.length));
      const leaderPhase = plan.batches.findIndex((batch) =>
        batch.some((route) => route.index === 0),
      );
      expect(leaderPhase).toBeGreaterThan(0);
      expect(plan.batches.flat().find((route) => route.index === 0)?.path).toEqual(path);
      const positions = [...seats];
      for (const batch of plan.batches) {
        const tracks = batch.map((route) => {
          expect(route.from).toEqual(positions[route.index]);
          expect(
            pathCost(
              {
                grid,
                blocked: new Set(avoid.map(posKey)),
                surfaces: CONTENT.surfaces,
                size: 1,
                climbCost: CONTENT.tuning.climbCost,
              },
              route.from,
              route.path,
            ),
          ).not.toBeNull();
          const curve = smoothPath(route.from, route.path);
          return { route, curve, timing: strollTiming(curve.length, TIMING.strollStep) };
        });
        const end = Math.max(
          0,
          ...tracks.map(({ route, timing }) => (route.delayMs ?? 0) + timing.duration),
        );
        for (let time = 0; time <= end + 5; time += 5) {
          const drawn = positions.map((seat, index) => {
            const track = tracks.find(({ route }) => route.index === index);
            if (!track) return seat;
            const pos = sampleAt(
              track.curve,
              track.timing.ease((time - (track.route.delayMs ?? 0)) / track.timing.duration) *
                track.curve.length,
            ).pos;
            return { x: pos.x - 0.5, y: pos.y - 0.5 };
          });
          for (let i = 0; i < drawn.length; i++) {
            const a = drawn[i];
            if (!a) continue;
            for (const b of drawn.slice(i + 1))
              expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(0.8);
            for (const npc of avoid)
              expect(Math.hypot(a.x - npc.x, a.y - npc.y)).toBeGreaterThanOrEqual(0.8);
          }
        }
        for (const route of batch) positions[route.index] = route.path.at(-1) ?? route.from;
      }
      expect(positions).toEqual(trail.positions(seats.length));
      expect(trail.head).toEqual(path.at(-1));
    },
  );
});
