/**
 * The quarry gate's watchers (#696). "Quarry workers watch from the wall," the
 * parley says, so two of the crew stand under the curtain wall while it is
 * read: on the open ground of row 1 (the wall's own cells are blocked), west
 * of the gate's first stack of oil barrels and inside the stage `gate_parley`
 * frames, leaving the east stack to the deserter the parley also names. They
 * are the crew the party then fights (the Quarry Worker and the Quarry Hauler,
 * their combat art), so they leave the wall as the fight starts, or once Ruon
 * has the gate opened for an earthbender.
 *
 * Kept apart from `connectAct1` so the gate's other staging can change there
 * without touching this list.
 */

import type { Condition, MapDef, NpcDef } from '../../core/types';

const visited = (nodeId: string): Condition => ({ kind: 'visited', nodeId });
const unvisited = (nodeId: string): Condition => ({ kind: 'not', of: visited(nodeId) });

/** From the parley until the gate is fought for or talked open. */
export const GATE_WATCH: Condition = {
  kind: 'all',
  of: [visited('gate_parley'), unvisited('battle_quarry_gate'), unvisited('gate_talked_through')],
};

export const GATE_WATCHERS: readonly NpcDef[] = [
  {
    id: 'gate_watch_worker',
    name: 'Quarry worker',
    pos: { x: 6, y: 1 },
    sprite: 'unit.enemy.thug',
    node: 'gate_parley',
    when: GATE_WATCH,
  },
  {
    id: 'gate_watch_hauler',
    name: 'Quarry hauler',
    pos: { x: 8, y: 1 },
    sprite: 'unit.enemy.bruiser',
    node: 'gate_parley',
    when: GATE_WATCH,
  },
];

/** Adds the watchers to the quarry gate; every other map is returned unchanged. */
export function stageGateWatch(map: MapDef): MapDef {
  return map.id === 'quarry_gate' ? { ...map, npcs: [...map.npcs, ...GATE_WATCHERS] } : map;
}
