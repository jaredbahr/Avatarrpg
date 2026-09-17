/** The first connected region. Encounters retain their authored level order. */
import type { Condition, MapDef, MapExit, MapTrigger, Vec2 } from '../../core/types';

import { discoveryMarkers } from './discoveries';

const visited = (nodeId: string): Condition => ({ kind: 'visited', nodeId });
const unvisited = (nodeId: string): Condition => ({ kind: 'not', of: visited(nodeId) });
const route = (
  pos: Vec2,
  toMapId: string,
  toPos: Vec2,
  label: string,
  requires?: Condition,
  lockedHint?: string,
): MapExit => ({ pos, toMapId, toPos, label, requires, lockedHint });

/** A visible group watches the whole crossing, so a long tap cannot skip it. */
function crossing(
  map: MapDef,
  x: number,
  y: number,
  node: string,
  label: string,
  sprite: string,
  when: Condition,
): MapTrigger {
  const rows = [
    y,
    ...Array.from({ length: map.height }, (_, row) => row).filter((row) => row !== y),
  ];
  return {
    id: node,
    node,
    label,
    sprite,
    when,
    once: true,
    area: rows
      .filter((row) => {
        const key = map.rows[row]?.[x];
        return key !== undefined && !map.legend[key]?.blocked;
      })
      .map((row) => ({ x, y: row })),
  };
}

export function connectAct1(map: MapDef): MapDef {
  switch (map.id) {
    case 'ba_dan_village':
      return {
        ...map,
        objective: 'Meet the villagers, visit the riverside, or follow the east road.',
        exits: [route({ x: 23, y: 7 }, 'forest_road', { x: 1, y: 4 }, 'East road → Forest Road')],
      };
    case 'forest_road':
      return {
        ...map,
        objective: 'Explore the woodland paths. The quarry lies east; Ba Dan lies west.',
        exits: [
          route({ x: 0, y: 4 }, 'ba_dan_village', { x: 22, y: 7 }, 'West → Ba Dan Village'),
          route(
            { x: 19, y: 4 },
            'quarry_gate',
            { x: 1, y: 5 },
            'East → Quarry Gate',
            visited('after_forest'),
            'Deal with the roadblock before heading to the quarry.',
          ),
        ],
        triggers: [
          crossing(
            map,
            4,
            4,
            'road_depart',
            'The pine road',
            'npc.guard',
            unvisited('road_depart'),
          ),
          crossing(
            map,
            8,
            4,
            'battle_forest_road',
            'Quarry workers blocking the road',
            'unit.enemy.thug',
            unvisited('after_forest'),
          ),
        ],
        npcs: [
          ...map.npcs,
          ...discoveryMarkers('forest_road'),
          {
            id: 'dema',
            name: 'Dema, road keeper',
            pos: { x: 3, y: 1 },
            sprite: 'npc.elder',
            node: 'forest_dema',
            routes: [
              {
                when: { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
                node: 'forest_dema_again',
              },
            ],
          },
        ],
      };
    case 'quarry_gate':
      return {
        ...map,
        objective: 'Approach the watch at the gate, or take the road back to Ba Dan.',
        exits: [
          route({ x: 0, y: 5 }, 'forest_road', { x: 18, y: 4 }, 'West → Forest Road'),
          route(
            { x: 19, y: 5 },
            'ambush_road',
            { x: 1, y: 4 },
            'East → The Cutting',
            { kind: 'any', of: [visited('escort_chosen'), visited('trade_chosen')] },
            'Speak with Ruon and decide how to proceed first.',
          ),
        ],
        triggers: [
          crossing(
            map,
            8,
            5,
            'gate_parley',
            'The quarry watch',
            'npc.guard',
            unvisited('ruon_choice'),
          ),
        ],
      };
    case 'ambush_road':
      return {
        ...map,
        objective:
          'Follow the cutting toward the quarry. Look for the old workers’ rest along the verge.',
        exits: [
          route({ x: 0, y: 4 }, 'quarry_gate', { x: 18, y: 5 }, 'West → Quarry Gate'),
          route(
            { x: 19, y: 4 },
            'quarry_floor',
            { x: 1, y: 5 },
            'East → Quarry Floor',
            { kind: 'any', of: [visited('after_ambush'), visited('trade_chosen')] },
            'Jin’s people are waiting further along the cutting.',
          ),
        ],
        triggers: [
          crossing(map, 8, 4, 'battle_ambush', 'Jin’s waiting mercenaries', 'unit.enemy.thug', {
            kind: 'all',
            of: [{ kind: 'flag', key: 'ruon_spared', op: 'set' }, unvisited('after_ambush')],
          }),
        ],
        npcs: [
          ...map.npcs,
          ...discoveryMarkers('ambush_road'),
          {
            id: 'rest_keeper',
            name: 'Sen, the tea keeper',
            pos: { x: 5, y: 9 },
            sprite: 'npc.shopkeeper',
            node: 'cutting_tea',
            routes: [
              {
                when: { kind: 'flag', key: 'world.tea_shared', op: 'set' },
                node: 'cutting_tea_again',
              },
            ],
          },
        ],
      };
    case 'quarry_floor':
      return {
        ...map,
        objective: 'The driller waits across the floor. You can still return to the village.',
        exits: [route({ x: 0, y: 5 }, 'ambush_road', { x: 18, y: 4 }, 'West → The Cutting')],
        triggers: [
          crossing(map, 9, 5, 'quarry_descent', 'The mecha-driller', 'unit.enemy.grumbler', {
            kind: 'all',
            of: [unvisited('act1_epilogue'), unvisited('act1_epilogue_lost')],
          }),
        ],
      };
    default:
      return map;
  }
}
