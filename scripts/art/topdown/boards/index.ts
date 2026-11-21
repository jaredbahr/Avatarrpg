/**
 * The boards the top-down ground packer bakes (ADR 0104 §3, #461), one config each. Adding a board
 * is a baker and a config under `boards/` and a line here (or, for a board whose ground is data, a `groundBoard`); the library (`../lib/`) does not change.
 */
import type { TopDownBoard } from '../lib/board';
import { BA_DAN_GROUND } from '../../../../src/content/scenes/baDan.ground';
import { FOREST_ROAD_BOARD } from './forestRoad';
import { BA_DAN_SPRITES, baDanObjects } from '../../../../src/content/scenes/baDan.layout';
import { groundBoard } from './ground';
import { QUARRY_BOARDS } from './quarry';
import { RG02_BOARDS } from './rg02boards';

export const BOARDS: readonly TopDownBoard[] = [
  // Ba Dan's ground alone (stage 4, ADR 0120): its set pieces stand on it at stage 5. Its old baker, drawn to the
  // 24 x 16 rows, is in the history (`./baDan.ts`).
  groundBoard({
    id: 'ba_dan_village',
    folder: 'ba-dan',
    terrain: BA_DAN_GROUND,
    layout: { objects: baDanObjects(), sprites: BA_DAN_SPRITES },
  }),
  FOREST_ROAD_BOARD,
  ...QUARRY_BOARDS,
  ...RG02_BOARDS,
];
