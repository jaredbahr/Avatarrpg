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
};

export const QUARRY_GATE: MapDef = {
  id: 'quarry_gate',
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
};

export const AMBUSH_ROAD: MapDef = {
  id: 'ambush_road',
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
};

export const QUARRY_FLOOR: MapDef = {
  id: 'quarry_floor',
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
};

export const COMBAT_MAPS: readonly MapDef[] = [FOREST_ROAD, QUARRY_GATE, AMBUSH_ROAD, QUARRY_FLOOR];
