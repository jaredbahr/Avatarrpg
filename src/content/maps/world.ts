/** The first connected region. Encounters retain their authored level order. */
import type { Condition, MapDef, MapEdgeSide, MapExit, MapTrigger, Vec2 } from '../../core/types';

import { discoveryMarkers } from './discoveries';
import { reasonMarkers } from '../story/reasons';
import { RETURNEES_HOME, RETURNEES_RETURNING, VILLAGE_HOMECOMINGS_COMPLETE } from '../story/return';
import { RETURNEE_PRESENTATIONS } from '../residents/returnees';
import { SQ01_HAS_LIST, SQ01_RESOLVED } from '../story/sq01Cabbages';
import { LOST_OBJECTIVE } from '../story/lost';

const visited = (nodeId: string): Condition => ({ kind: 'visited', nodeId });
const unvisited = (nodeId: string): Condition => ({ kind: 'not', of: visited(nodeId) });
const rescued: Condition = { kind: 'flag', key: 'act1_complete', op: 'set' };
/** A Driller loss (C-01): the quarry is still held, and the valley shows it. */
const lost: Condition = { kind: 'flag', key: 'act1_lost', op: 'set' };
/** Act I is over, won (the walk home's closing card) or lost: the coast road to RG-02 opens. */
export const ACT1_OVER: Condition = { kind: 'any', of: [visited('demo_complete'), lost] };
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
          LOST_OBJECTIVE,
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
            { x: 31, y: 9 },
            'forest_road',
            { x: 1, y: 4 },
            'East road → Forest Road',
            'east',
            mouth(31, [9, 10]),
          ),
          route(
            { x: 18, y: 19 },
            'ba_dan_riverside',
            { x: 10, y: 19 },
            'River path → Riverside',
            'south',
            // The path's mouth on the south rim, between the trees on both shoulders: the walkable
            // border cells are the exit.
            [18, 19].map((x) => ({ x, y: 19 })),
          ),
        ],
        /*
         * Act II (RG-02): the coast road to Saltstep. A route sign on the south lawn's rim, shown once
         * Act I is over either way: after the walk home's closing card, or after a Driller loss
         * (`act1_lost`, #821), when the occupied village is where the party wakes. Its `when` is
         * the region's hard gate (ADR 0011). It is a sign, not an exit, because an exit on this
         * map must stand on a rim mouth its baked top-down ground already has, and the south lawn
         * has none until the art pass adds one (`docs/pipeline-trial-log.md`, friction).
         * The first time it plays Scene 2.1 on the way down.
         */
        npcs: [
          ...map.npcs,
          {
            id: 'coast_road_sign',
            name: 'Coast road',
            pos: { x: 13, y: 18 },
            sprite: 'world.route_sign',
            interaction: 'route-sign',
            when: ACT1_OVER,
            node: 'mq02_coast_road',
            routes: [
              // Later trips replay only the road's last beat, Parcel at the trough, then the market.
              {
                when: {
                  kind: 'any',
                  of: [visited('mq02_coast_road'), visited('mq02_coast_road_jinu')],
                },
                node: 'mq02_coast_parcel',
              },
              // Jinu's moment (Scene 2.1, loss branch): the same road, ending on her line.
              {
                when: { kind: 'all', of: [lost, { kind: 'partyHas', characterId: 'jinu' }] },
                node: 'mq02_coast_road_jinu',
              },
            ],
          },
        ],
        // The demo's ending: the first step in from the east road after the walk home.
        triggers: [
          crossing(
            map,
            28,
            9,
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
            { x: 18, y: 18 },
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
          {
            when: lost,
            text: 'The quarry is still held. Ba Dan is west.',
            objectiveTargetId: 'ba_dan_village',
          },
        ],
        exits: [
          route(
            { x: 0, y: 4 },
            'ba_dan_village',
            { x: 30, y: 9 },
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
            // Not after a Driller loss either: its outcomes count on Dorin's handcart.
            when: {
              kind: 'all',
              of: [SQ01_HAS_LIST, { kind: 'not', of: rescued }, { kind: 'not', of: lost }],
            },
            routes: [{ when: SQ01_RESOLVED, node: 'sq01_sled_again' }],
          },
          {
            id: 'dema',
            name: 'Lanfen, road keeper',
            pos: { x: 3, y: 1 },
            sprite: 'npc.dema',
            node: 'forest_dema',
            routes: [
              { when: rescued, node: 'dema_home' },
              { when: lost, node: 'dema_lost' },
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
          { when: lost, text: 'The quarry is still held. The forest road leads west to Ba Dan.' },
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
        // Jinu's find in the gate office on the walk home (C-31; reasons.ts).
        npcs: [...map.npcs, ...reasonMarkers('quarry_gate')],
      };
    case 'ambush_road':
      return {
        ...map,
        objective:
          'Follow the cutting toward the quarry. Look for the old workers’ rest along the verge.',
        objectiveVariants: [
          {
            when: rescued,
            text: 'Ba Dan lies west, past the quarry gate. Kuan is at the rest stop.',
          },
          {
            when: lost,
            text: 'Someone is watching the far end of the cutting. Kuan is at the rest stop; Ba Dan lies west.',
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
            // After a Driller loss the quarry is held again (C-16); MQ-11 frees it. Before the
            // ambush the crossing at x8 always comes first, so the one hint serves both.
            {
              kind: 'all',
              of: [
                { kind: 'any', of: [visited('after_ambush'), visited('trade_chosen')] },
                { kind: 'not', of: lost },
              ],
            },
            'Someone is watching the far end of the cutting. Not this way, not yet.',
          ),
        ],
        triggers: [
          crossing(map, 8, 4, 'battle_ambush', 'Jin’s waiting mercenaries', 'unit.enemy.thug', {
            kind: 'all',
            of: [{ kind: 'flag', key: 'ruon_spared', op: 'set' }, unvisited('after_ambush')],
          }),
          // The culvert (C-29): column 10 is the only dry crossing east of the pool, so
          // either branch passes it once on the way down. Until the art batch draws a
          // culvert mouth, the runoff measuring stone stands in for it.
          crossing(map, 10, 6, 'cutting_culvert', 'The culvert', 'world.runoff_marker', {
            kind: 'all',
            of: [
              { kind: 'any', of: [visited('after_ambush'), visited('trade_chosen')] },
              unvisited('cutting_culvert'),
              { kind: 'not', of: rescued },
            ],
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
            name: 'Kuan, the tea keeper',
            pos: { x: 5, y: 9 },
            sprite: 'npc.sen',
            node: 'cutting_tea',
            routes: [
              { when: rescued, node: 'sen_home' },
              { when: lost, node: 'sen_lost' },
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
        // The off-ledger cargo and the Driller's cab: one find per present hero (C-31).
        npcs: [...map.npcs, ...reasonMarkers('quarry_floor')],
      };
    default:
      return map;
  }
}
