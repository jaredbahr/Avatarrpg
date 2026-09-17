/**
 * The four Act 1 battlefields. All 20x12, which fits on a Surface in landscape
 * with the HUD docked without the camera ever having to scroll during a fight.
 *
 * Each map is built around one teaching idea:
 *   forest_road   puddles in the middle  -> Wet, Frozen, Shocked
 *   quarry_gate   oil by the gatehouse   -> fire spreads
 *   ambush_road   a narrow cutting       -> chokepoints and pushes
 *   quarry_floor  ledges, oil and mud    -> the boss rewrites the ground
 *
 * Party spawns use the same staggered pattern on every map: two columns two
 * tiles apart, alternating rows. Two measurements shaped it. Bunched into a
 * 2x3 block, a party of six was a single blast template and the simulator
 * wiped one on the oil map every other run. Strung out down the whole left
 * edge, the opposite happened — the party reached the boss in ones and twos
 * and the win rate collapsed. This is the middle: no 3x3 catches more than
 * about three of them, and they still start as a group.
 */

import type { MapDef } from '../../core/types';
import { LEGEND } from './legend';

export const FOREST_ROAD: MapDef = {
  id: 'forest_road',
  backdrop: { url: 'art/maps/forest_road.webp', pixelsPerTile: 80 },
  name: 'The Forest Road',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'forest',
  legend: LEGEND,
  rows: [
    'TT,,,,,,T,,,,,,,,,TT',
    'T,,,,,,,,,,,,,T,,,,T',
    ',,,,,,,,,,,,,,,,,,,^',
    ',,,,,,,r,,,,,,,,,,^^',
    '====================',
    '=====~~=====,,,,,,^^',
    '====~~~~====,,,,,,,^',
    '=====~~=====,,,,,,,,',
    '====================',
    ',,,,,,,,r,,,,,,,,,,,',
    'T,,,,,,,,,,,,,T,,,,T',
    'TT,,,,,,,,,,,,,,,,TT',
  ],
  partySpawns: [
    { x: 1, y: 3 },
    { x: 3, y: 4 },
    { x: 1, y: 5 },
    { x: 3, y: 6 },
    { x: 1, y: 7 },
    { x: 3, y: 8 },
  ],
  npcs: [],
  props: [],
};

export const QUARRY_GATE: MapDef = {
  id: 'quarry_gate',
  backdrop: { url: 'art/maps/quarry_gate.webp', pixelsPerTile: 80 },
  name: 'The Quarry Gate',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'quarry',
  legend: LEGEND,
  rows: [
    '^^^^######..######^^',
    '^^^^#....#..#....#^^',
    '^^^..........c....^^',
    '.....c....oo.......^',
    '..........oo........',
    '===========oo=======',
    '===========oo=======',
    '..........oo........',
    '.....c....oo.......^',
    '^^^...........c...^^',
    '^^^^#....#..#....#^^',
    '^^^^######..######^^',
  ],
  partySpawns: [
    { x: 1, y: 3 },
    { x: 3, y: 4 },
    { x: 1, y: 5 },
    { x: 3, y: 6 },
    { x: 1, y: 7 },
    { x: 3, y: 8 },
  ],
  npcs: [],
  /*
   * The encounter's intro has promised "barrels stacked against the gatehouse"
   * since Phase 1, and there were never any barrels. Now there are.
   *
   * The brazier is the interesting one. It sits at (10,5), one tile west of the
   * oil stripe, so a single Shove — which every party member has — tips it into
   * the oil and lights the whole channel. That is the play the map is built
   * around: available to the least experienced person at the table, obvious once
   * seen, and genuinely dangerous to whoever is standing too close.
   */
  props: [
    { propId: 'brazier', pos: { x: 10, y: 5 } },
    { propId: 'water_barrel', pos: { x: 14, y: 3 } },
    { propId: 'water_barrel', pos: { x: 14, y: 8 } },
    /*
     * Which SIDE of the oil channel a hazard sits on decides whether it is a
     * tool or a trap, and the simulator was blunt about it. At (9,4), on the
     * party's own approach lane, the flask spilled oil across the ground six
     * players had to walk over and the full-table win rate fell to 40%. One
     * tile group east, past the channel, and the same flask reads as 95% — it
     * now extends the hazard toward the people you are fighting.
     */
    { propId: 'oil_flask', pos: { x: 12, y: 4 } },
    /*
     * Pella's cart, turned away at the gate, sitting on the road behind the
     * party. Same lesson: at (13,6) it walled off the escape lane exactly when
     * the oil caught (40%); behind the party it is cover on the approach, and
     * average deaths at a full table drop from 4.1 to 3.2.
     */
    { propId: 'cabbage_cart', pos: { x: 6, y: 6 } },
  ],
};

export const AMBUSH_ROAD: MapDef = {
  id: 'ambush_road',
  backdrop: { url: 'art/maps/ambush_road.webp', pixelsPerTile: 80 },
  name: 'The Cutting',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'forest',
  legend: LEGEND,
  rows: [
    'AAAAAAA^^^^^^^AAAAAA',
    'AA^^^,,,,,,,,,,^^^AA',
    '^^,,,,,,r,,,,,,,,^^A',
    ',,,,,,,,,,,,r,,,,,^^',
    '====================',
    '=====,,~~~~,,,,,====',
    '=====,,~~~~,,,,,====',
    '====================',
    ',,,,,,r,,,,,,,,,,,^^',
    '^^,,,,,,,,,,r,,,,^^A',
    'AA^^^,,,,,,,,,,^^^AA',
    'AAAAAAA^^^^^^^AAAAAA',
  ],
  partySpawns: [
    { x: 1, y: 3 },
    { x: 3, y: 4 },
    { x: 1, y: 5 },
    { x: 3, y: 6 },
    { x: 1, y: 7 },
    { x: 3, y: 8 },
  ],
  npcs: [],
  props: [],
};

export const QUARRY_FLOOR: MapDef = {
  id: 'quarry_floor',
  backdrop: { url: 'art/maps/quarry_floor.webp', pixelsPerTile: 80 },
  name: 'The Quarry Floor',
  kind: 'combat',
  width: 20,
  height: 12,
  ambience: 'quarry',
  legend: LEGEND,
  rows: [
    'AAA^^..........^^AAA',
    'AA^^....r..r....^^AA',
    '^^.....oo..oo.....^^',
    '.......oo..oo.......',
    '..r.................',
    '..........mm........',
    '..........mm........',
    '..r.................',
    '.......oo..oo.......',
    '^^.....oo..oo.....^^',
    'AA^^....r..r....^^AA',
    'AAA^^..........^^AAA',
  ],
  partySpawns: [
    { x: 1, y: 3 },
    { x: 3, y: 4 },
    { x: 1, y: 5 },
    { x: 3, y: 6 },
    { x: 1, y: 7 },
    { x: 3, y: 8 },
  ],
  npcs: [],
  /*
   * Pella's side quest, paid out three fights later and never announced.
   *
   * Ask a child in the village about her missing brother and his produce cart is
   * on the quarry floor when you get there — parked beside the mud the driller
   * churns up, which is exactly where you want something that knocks people over
   * and blinds them. A party that never spoke to her fights this without it, and
   * nobody ever tells them what they missed.
   */
  props: [
    {
      propId: 'cabbage_cart',
      pos: { x: 9, y: 6 },
      when: { kind: 'flag', key: 'pella_asked', op: 'set' },
    },
  ],
};

export const COMBAT_MAPS: readonly MapDef[] = [FOREST_ROAD, QUARRY_GATE, AMBUSH_ROAD, QUARRY_FLOOR];
