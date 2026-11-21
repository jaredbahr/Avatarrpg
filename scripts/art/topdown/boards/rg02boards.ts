/** RG-02's boards (Saltstep and Emberwatch), one config each over the region's baker (`rg02.ts`). */
import {
  EMBERWATCH_PARADE_TERRAIN,
  EMBERWATCH_PARADE_TOPDOWN_LAYOUT,
  EMBERWATCH_POWER_YARD_TERRAIN,
  EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT,
  RIVER_ROAD_BRIDGE_TERRAIN,
  RIVER_ROAD_BRIDGE_TOPDOWN_LAYOUT,
  RIVER_ROAD_BRIDGE_WORN,
  RIVER_ROAD_TERRAIN,
  RIVER_ROAD_TOPDOWN_LAYOUT,
  RIVER_ROAD_WORN,
  SALTSTEP_PLATFORM_RAISED,
  SALTSTEP_PLATFORM_TERRAIN,
  SALTSTEP_PLATFORM_TOPDOWN_LAYOUT,
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
  // TODO(region): the Saltstep market's board comes back at its ground and dressing stages
  // (`docs/places/saltstep_market.md`); it is a grey blockout with no plates until then.
  rg02Board({
    id: 'saltstep_pontoon',
    folder: 'saltstep-pontoon',
    terrain: SALTSTEP_PONTOON_TERRAIN,
    layout: SALTSTEP_PONTOON_TOPDOWN_LAYOUT,
    // the quay's cart track along the north side
    wear: { paths: span(0, 10, 0, 0) },
  }),
  rg02Board({
    id: 'saltstep_platform',
    folder: 'saltstep-platform',
    terrain: SALTSTEP_PLATFORM_TERRAIN,
    layout: SALTSTEP_PLATFORM_TOPDOWN_LAYOUT,
    // the stall's old footprint down the seam, where feet and crates wore the planks paler
    wear: { paths: span(6, 8, 3, 7) },
    raised: SALTSTEP_PLATFORM_RAISED,
  }),
  rg02Board({
    id: 'emberwatch_parade',
    folder: 'emberwatch-parade',
    terrain: EMBERWATCH_PARADE_TERRAIN,
    layout: EMBERWATCH_PARADE_TOPDOWN_LAYOUT,
    // the walk up from the jetty, the lane under the wall, and the way out east
    wear: {
      paths: [
        ...span(3, 9, 10, 13),
        ...span(1, 22, 2, 2),
        ...span(2, 2, 3, 9),
        ...span(21, 23, 7, 8),
      ],
      wet: 0.15,
    },
  }),
  rg02Board({
    id: 'emberwatch_power_yard',
    folder: 'emberwatch-power-yard',
    terrain: EMBERWATCH_POWER_YARD_TERRAIN,
    layout: EMBERWATCH_POWER_YARD_TOPDOWN_LAYOUT,
    earth: 'yard',
    // the gate to the shed, and the walk along the line
    wear: { paths: [...span(1, 4, 5, 6), ...span(1, 4, 3, 4), ...span(4, 16, 6, 6)], wet: 0.3 },
  }),
  rg02Board({
    id: 'river_road',
    folder: 'river-road',
    terrain: RIVER_ROAD_TERRAIN,
    layout: RIVER_ROAD_TOPDOWN_LAYOUT,
    earth: 'road',
    stone: 'rise',
    // the road, its pull-offs, the landing's footpath and the lookout's track; a dry morning, so little lies wet
    wear: { paths: RIVER_ROAD_WORN, wet: 0.08, soft: true },
  }),
  rg02Board({
    id: 'river_road_bridge',
    folder: 'river-road-bridge',
    terrain: RIVER_ROAD_BRIDGE_TERRAIN,
    layout: RIVER_ROAD_BRIDGE_TOPDOWN_LAYOUT,
    earth: 'road',
    stone: 'rise',
    // SF-2.3's board is a crop of the river road's, so it wears as the road does
    wear: { paths: RIVER_ROAD_BRIDGE_WORN, wet: 0.08, soft: true },
  }),
];
