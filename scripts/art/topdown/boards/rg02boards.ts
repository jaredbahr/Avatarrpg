/** RG-02's boards (Saltstep and Emberwatch), one config each over the region's baker (`rg02.ts`). */
import {
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
];
