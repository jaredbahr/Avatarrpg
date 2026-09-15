/**
 * The four Act 1 battlefields. All 20x12, which fits on a Surface in landscape
 * with the HUD docked without the camera ever having to scroll during a fight.
 *
 * Each map is built around one teaching idea:
 *   forest_road   puddles in the middle  -> Wet, Frozen, Shocked
 *   quarry_gate   oil by the gatehouse   -> fire spreads
 *   ambush_road   a narrow cutting       -> chokepoints and pushes
 *   quarry_floor  ledges, oil and mud    -> the boss rewrites the ground
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
    { x: 1, y: 5 },
    { x: 1, y: 6 },
    { x: 1, y: 7 },
    { x: 2, y: 4 },
    { x: 2, y: 8 },
    { x: 0, y: 6 },
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
    { x: 1, y: 5 },
    { x: 1, y: 6 },
    { x: 2, y: 4 },
    { x: 2, y: 7 },
    { x: 1, y: 4 },
    { x: 1, y: 7 },
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
    { x: 1, y: 5 },
    { x: 1, y: 6 },
    { x: 2, y: 4 },
    { x: 2, y: 7 },
    { x: 0, y: 5 },
    { x: 0, y: 6 },
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
    { x: 2, y: 5 },
    { x: 2, y: 6 },
    { x: 3, y: 4 },
    { x: 3, y: 7 },
    { x: 2, y: 4 },
    { x: 2, y: 7 },
  ],
  npcs: [],
};

export const COMBAT_MAPS: readonly MapDef[] = [FOREST_ROAD, QUARRY_GATE, AMBUSH_ROAD, QUARRY_FLOOR];
