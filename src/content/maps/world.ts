/** The first connected region. Encounters retain their authored level order. */
import type { Condition, MapDef, MapEdgeSide, MapExit, MapTrigger, Vec2 } from '../../core/types';

import { discoveryMarkers } from './discoveries';
import { RETURNEES_HOME, RETURNEES_RETURNING, VILLAGE_HOMECOMINGS_COMPLETE } from '../story/return';
import { RETURNEE_PRESENTATIONS } from '../residents/returnees';
import { SQ01_HAS_LIST, SQ01_RESOLVED } from '../story/sq01Cabbages';

const visited = (nodeId: string): Condition => ({ kind: 'visited', nodeId });
const unvisited = (nodeId: string): Condition => ({ kind: 'not', of: visited(nodeId) });
const rescued: Condition = { kind: 'flag', key: 'act1_complete', op: 'set' };
const route = (
  pos: Vec2,
  toMapId: string,
  toPos: Vec2,
  label: string,
  direction: MapEdgeSide,
  area?: readonly Vec2[],
  requires?: Condition,
  lockedHint?: string,
): MapExit => ({ pos, toMapId, toPos, label, direction, area, requires, lockedHint });

/** A road mouth (M2): the walkable cells of the exit's cross-section at the map edge. */
const mouth = (x: number, ys: readonly number[]): readonly Vec2[] => ys.map((y) => ({ x, y }));

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
        objectiveVariants: [
          {
            when: VILLAGE_HOMECOMINGS_COMPLETE,
            text: "You've caught up with the village. Rest by the river, or explore the roads.",
          },
          {
            when: RETURNEES_HOME,
            text: 'The workers are home. Talk with Mira, Pella, Gao or Dorin, or visit the river.',
          },
        ],
        exits: [
          route(
            { x: 23, y: 7 },
            'forest_road',
            { x: 1, y: 4 },
            'East road → Forest Road',
            'east',
            mouth(23, [7, 8]),
          ),
          route(
            { x: 19, y: 15 },
            'ba_dan_riverside',
            { x: 10, y: 19 },
            'River path → Riverside',
            'south',
            // The path's mouth on the rim, between the canal's end and the
            // small trees on both shoulders: the walkable border cells are the exit.
            [18, 19, 20].map((x) => ({ x, y: 15 })),
          ),
        ],
        // The demo's ending: the first step in from the east road after the walk home.
        triggers: [
          crossing(
            map,
            20,
            7,
            'welcome_home_mira',
            'Ba Dan comes out to meet you',
            'npc.household',
            {
              kind: 'all',
              of: [visited('forest_return_arrival'), unvisited('demo_complete')],
            },
          ),
        ],
      };
    case 'ba_dan_riverside':
      return {
        ...map,
        objective:
          'Enjoy the riverside, or follow the southern path into Ba Dan and the wider valley.',
        objectiveVariants: [
          { when: rescued, text: 'Rest by the river, or follow the southern path back to Ba Dan.' },
        ],
        npcs: map.npcs.map((npc) =>
          npc.id === 'riverside_mira'
            ? {
                ...npc,
                routes: [{ when: rescued, node: 'riverside_mira_home' }, ...(npc.routes ?? [])],
              }
            : npc,
        ),
        exits: [
          route(
            { x: 10, y: 20 },
            'ba_dan_village',
            // One step inside the village's river-path mouth, never on it.
            { x: 19, y: 14 },
            'South path → Ba Dan Village',
            'south',
            // The south path from row 20 to the rim: it leaves with no tile to miss.
            [
              { x: 10, y: 20 },
              ...mouth(9, [20, 21]),
              ...mouth(10, [21, 22, 23]),
              ...mouth(11, [20, 21, 22, 23]),
            ],
          ),
        ],
      };
    case 'forest_road':
      return {
        ...map,
        objective: 'Follow the road east to the quarry gate, past the roadblock. Ba Dan is west.',
        objectiveTargetId: 'quarry_gate',
        objectiveVariants: [
          {
            when: RETURNEES_RETURNING,
            text: 'The five workers are returning. The roadblock is gone. Follow the road west to Ba Dan.',
            objectiveTargetId: 'ba_dan_village',
          },
          {
            when: rescued,
            text: 'The roadblock is gone. Follow the road west to Ba Dan.',
            objectiveTargetId: 'ba_dan_village',
          },
        ],
        exits: [
          route(
            { x: 0, y: 4 },
            'ba_dan_village',
            { x: 22, y: 7 },
            'West → Ba Dan Village',
            'west',
            // Preserve the road's five-cell mouth; these walkable rim cells are
            // exits rather than edge-band terrain.
            mouth(0, [4, 5, 6, 7, 8]),
          ),
          route(
            { x: 19, y: 4 },
            'quarry_gate',
            { x: 1, y: 5 },
            'East → Quarry Gate',
            'east',
            // Preserve the road's five-cell mouth past the NE bank; these
            // walkable rim cells remain exits rather than edge-band terrain.
            mouth(19, [4, 5, 6, 7, 8]),
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
            'unit.enemy.thug',
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
          crossing(
            map,
            1,
            4,
            'forest_return_arrival',
            'Ba Dan is ahead',
            'npc.household',
            RETURNEES_RETURNING,
          ),
        ],
        npcs: [
          ...map.npcs,
          ...discoveryMarkers('forest_road'),
          {
            // SQ-01: Bo-shan's tipped sled in the south ditch, for a party carrying Pella's list,
            // until the workers are home. The cabbage cart stands in for a sled until art exists.
            id: 'sq01_sled',
            name: 'Overturned sled',
            pos: { x: 11, y: 10 },
            sprite: 'prop.cart',
            node: 'sq01_sled',
            when: { kind: 'all', of: [SQ01_HAS_LIST, { kind: 'not', of: rescued }] },
            routes: [{ when: SQ01_RESOLVED, node: 'sq01_sled_again' }],
          },
          {
            id: 'dema',
            name: 'Dema, road keeper',
            pos: { x: 3, y: 1 },
            sprite: 'npc.dema',
            node: 'forest_dema',
            routes: [
              { when: rescued, node: 'dema_home' },
              {
                when: { kind: 'flag', key: 'world.ducks_seen', op: 'set' },
                node: 'forest_dema_again',
              },
            ],
          },
          {
            id: 'bo_shan',
            name: 'Bo-shan',
            resident: 'lw.npc.bo_shan',
            sprite: RETURNEE_PRESENTATIONS['lw.npc.bo_shan'].npcSprite,
            node: 'forest_return_explore',
          },
          {
            id: 'leto',
            name: 'Leto',
            resident: 'lw.npc.leto',
            sprite: RETURNEE_PRESENTATIONS['lw.npc.leto'].npcSprite,
            node: 'forest_return_explore',
          },
          {
            id: 'amri',
            name: 'Amri',
            resident: 'lw.npc.amri',
            sprite: RETURNEE_PRESENTATIONS['lw.npc.amri'].npcSprite,
            node: 'forest_return_explore',
          },
          {
            id: 'hesra',
            name: 'Hesra',
            resident: 'lw.npc.hesra',
            sprite: RETURNEE_PRESENTATIONS['lw.npc.hesra'].npcSprite,
            node: 'forest_return_explore',
          },
          {
            id: 'senn',
            name: 'Senn',
            resident: 'lw.npc.senn_messenger',
            sprite: RETURNEE_PRESENTATIONS['lw.npc.senn_messenger'].npcSprite,
            node: 'forest_return_explore',
          },
        ],
      };
    case 'quarry_gate':
      return {
        ...map,
        objective: 'Approach the watch at the gate, or take the road back to Ba Dan.',
        objectiveVariants: [
          { when: rescued, text: 'The gate is open. Follow the forest road west to Ba Dan.' },
        ],
        exits: [
          route(
            { x: 0, y: 5 },
            'forest_road',
            { x: 18, y: 4 },
            'West → Forest Road',
            'west',
            mouth(0, [5, 6]),
          ),
          route(
            { x: 19, y: 5 },
            'ambush_road',
            { x: 1, y: 4 },
            'East → The Cutting',
            'east',
            mouth(19, [5, 6]),
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
            'unit.ally.ruon',
            unvisited('ruon_choice'),
          ),
        ],
      };
    case 'ambush_road':
      return {
        ...map,
        objective:
          'Follow the cutting toward the quarry. Look for the old workers’ rest along the verge.',
        objectiveVariants: [
          {
            when: rescued,
            text: 'Ba Dan lies west, past the quarry gate. Sen is at the rest stop.',
          },
        ],
        exits: [
          route(
            { x: 0, y: 4 },
            'quarry_gate',
            { x: 18, y: 5 },
            'West → Quarry Gate',
            'west',
            mouth(0, [4, 5, 6, 7]),
          ),
          route(
            { x: 19, y: 4 },
            'quarry_floor',
            { x: 1, y: 5 },
            'East → Quarry Floor',
            'east',
            mouth(19, [4, 5, 6, 7]),
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
            // Ruon stands where the ambush broke while he speaks (#628), and
            // waits there until the party goes down to the quarry floor.
            id: 'ruon_cutting',
            name: 'Captain Ruon',
            pos: { x: 10, y: 4 },
            sprite: 'unit.ally.ruon',
            node: 'ruon_cutting',
            when: {
              kind: 'all',
              of: [
                { kind: 'flag', key: 'ruon_spared', op: 'set' },
                visited('after_ambush'),
                unvisited('quarry_descent'),
              ],
            },
          },
          {
            id: 'rest_keeper',
            name: 'Sen, the tea keeper',
            pos: { x: 5, y: 9 },
            sprite: 'npc.sen',
            node: 'cutting_tea',
            routes: [
              { when: rescued, node: 'sen_home' },
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
        objectiveVariants: [
          {
            when: rescued,
            text: 'The workers are out. Take the west path through the cutting towards Ba Dan.',
          },
        ],
        exits: [
          route(
            { x: 0, y: 5 },
            'ambush_road',
            { x: 18, y: 4 },
            'West → The Cutting',
            'west',
            mouth(0, [5, 6]),
          ),
        ],
        triggers: [
          crossing(map, 9, 5, 'quarry_descent', 'The mecha-driller', 'unit.enemy.driller', {
            kind: 'all',
            of: [unvisited('act1_epilogue'), unvisited('act1_epilogue_lost')],
          }),
        ],
      };
    default:
      return map;
  }
}
