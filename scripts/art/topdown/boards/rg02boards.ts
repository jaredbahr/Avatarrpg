/** RG-02's boards (Saltstep and Emberwatch), one config each over the region's baker (`rg02.ts`). */
import {
  EMBERWATCH_PARADE_TERRAIN,
  EMBERWATCH_PARADE_TOPDOWN_LAYOUT,
  EMBERWATCH_POWER_YARD_TERRAIN,
  EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT,
  SALTSTEP_MARKET_TERRAIN,
  SALTSTEP_MARKET_TOPDOWN_LAYOUT,
  SALTSTEP_PONTOON_TERRAIN,
  SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
} from '../../../../src/content/scenes/rg02.topdown';
import type { TopDownBoard } from '../lib/board';
import { rg02Board } from './rg02';

export const RG02_BOARDS: readonly TopDownBoard[] = [
  rg02Board({
    id: 'saltstep_market',
    folder: 'saltstep-market',
    terrain: SALTSTEP_MARKET_TERRAIN,
    layout: SALTSTEP_MARKET_TOPDOWN_LAYOUT,
  }),
  rg02Board({
    id: 'saltstep_pontoon',
    folder: 'saltstep-pontoon',
    terrain: SALTSTEP_PONTOON_TERRAIN,
    layout: SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
  }),
  rg02Board({
    id: 'emberwatch_parade',
    folder: 'emberwatch-parade',
    terrain: EMBERWATCH_PARADE_TERRAIN,
    layout: EMBERWATCH_PARADE_TOPDOWN_LAYOUT,
  }),
  rg02Board({
    id: 'emberwatch_power_yard',
    folder: 'emberwatch-power-yard',
    terrain: EMBERWATCH_POWER_YARD_TERRAIN,
    layout: EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT,
    earth: 'yard',
  }),
];
