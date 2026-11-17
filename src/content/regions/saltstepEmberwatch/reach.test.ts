/**
 * Every person and every trigger on RG-02's maps can be reached on foot from the map's first party spawn, so the
 * dressing (the stalls, the scatter, the training props) never walls a scene off (owner, 2026-11-15).
 */
import { describe, expect, it } from 'vitest';
import { cachedGrid, reachable } from '../../../core/rules/grid';
import type { MoveContext } from '../../../core/rules/grid';
import type { Vec2 } from '../../../core/types';
import { CONTENT } from '../../index';
import { SALTSTEP_EMBERWATCH_MAPS } from './maps';

const near = (open: ReadonlySet<string>, pos: Vec2): boolean =>
  [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx = 0, dy = 0]) => open.has(`${pos.x + dx},${pos.y + dy}`));

describe('RG-02 reach', () => {
  for (const map of SALTSTEP_EMBERWATCH_MAPS) {
    it(`${map.id}: every NPC, trigger and exit is reachable from the first spawn`, () => {
      const start = map.partySpawns[0];
      expect(start).toBeDefined();
      if (!start) return;
      const context: MoveContext = {
        grid: cachedGrid(map),
        blocked: new Set(),
        surfaces: CONTENT.surfaces,
        size: 1,
        climbCost: CONTENT.tuning.climbCost,
      };
      const open = new Set(
        [...reachable(context, start, Infinity).values()].map((n) => `${n.pos.x},${n.pos.y}`),
      );
      const targets: [string, Vec2][] = [
        ...map.npcs.flatMap((npc): [string, Vec2][] => (npc.pos ? [[npc.id, npc.pos]] : [])),
        ...(map.triggers ?? []).flatMap((t) => t.area.map((cell): [string, Vec2] => [t.id, cell])),
        ...(map.exits ?? []).map((exit): [string, Vec2] => [`exit to ${exit.toMapId}`, exit.pos]),
      ];
      expect(targets.filter(([, pos]) => !near(open, pos)).map(([id]) => id)).toEqual([]);
    });
  }
});
