/**
 * The boards the top-down ground packer bakes (ADR 0104 §3, #461), one config each. Adding a board
 * is a baker and a config under `boards/` and a line here; the library (`../lib/`) does not change.
 */
import type { TopDownBoard } from '../lib/board';
import { BA_DAN_BOARD } from './baDan';
import { FOREST_ROAD_BOARD } from './forestRoad';

export const BOARDS: readonly TopDownBoard[] = [BA_DAN_BOARD, FOREST_ROAD_BOARD];
