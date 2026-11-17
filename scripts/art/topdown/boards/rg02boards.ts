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

/** The cells of a rectangle, for a board's worn paths. */
const span = (x0: number, x1: number, y0: number, y1: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
};

export const RG02_BOARDS: readonly TopDownBoard[] = [
  rg02Board({
    id: 'saltstep_market',
    folder: 'saltstep-market',
    terrain: SALTSTEP_MARKET_TERRAIN,
    layout: SALTSTEP_MARKET_TOPDOWN_LAYOUT,
    // the coast road along the quay, the lane behind it, and the walks down to each jetty
    wear: {
      paths: [
        ...span(0, 20, 5, 6),
        ...span(2, 21, 3, 3),
        ...span(1, 3, 1, 2),
        ...span(10, 10, 1, 2),
        ...span(20, 21, 1, 2),
        ...span(3, 3, 4, 7),
        ...span(11, 11, 4, 7),
        ...span(15, 15, 4, 7),
        ...span(21, 21, 4, 6),
      ],
      wet: 0.3,
    },
  }),
  rg02Board({
    id: 'saltstep_pontoon',
    folder: 'saltstep-pontoon',
    terrain: SALTSTEP_PONTOON_TERRAIN,
    layout: SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
    // the quay's cart track along the north side
    wear: { paths: span(0, 10, 0, 0) },
  }),
  rg02Board({
    id: 'emberwatch_parade',
    folder: 'emberwatch-parade',
    terrain: EMBERWATCH_PARADE_TERRAIN,
    layout: EMBERWATCH_PARADE_TOPDOWN_LAYOUT,
    // the walk up from the jetty, the lane under the wall, and the way out east
    wear: {
      paths: [...span(3, 9, 10, 13), ...span(1, 22, 2, 2), ...span(2, 2, 3, 9), ...span(21, 23, 7, 8)],
      wet: 0.15,
    },
  }),
  rg02Board({
    id: 'emberwatch_power_yard',
    folder: 'emberwatch-power-yard',
    terrain: EMBERWATCH_POWER_YARD_TERRAIN,
    layout: EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT,
    earth: 'yard',
  }),
];
