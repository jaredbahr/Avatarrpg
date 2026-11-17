/**
 * The boards the top-down ground packer bakes (ADR 0104 §3, #461), one config each. Adding a board
 * is a baker and a config under `boards/` and a line here; the library (`../lib/`) does not change.
 */
import type { TopDownBoard } from '../lib/board';
import { FOREST_ROAD_BOARD } from './forestRoad';
import { QUARRY_BOARDS } from './quarry';
import { RG02_BOARDS } from './rg02boards';

export const BOARDS: readonly TopDownBoard[] = [
  // TODO(region): Ba Dan's board comes back at its ground and dressing stages (`docs/places/ba_dan_village.md`);
  // it is a grey blockout with no plates until then. Its old baker is `./baDan.ts`, drawn to the 24 x 16 rows.
  FOREST_ROAD_BOARD,
  ...QUARRY_BOARDS,
  ...RG02_BOARDS,
];
