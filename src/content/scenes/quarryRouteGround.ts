/**
 * Registration generated from authoritative map rows by quarry-route-ground.ts.
 * Since 2026-10-03 the `bytes` of the Driller and Cutting ground pages pin the
 * shipped floor-filled art (docs/art/quarry-floor-fill.md), not the packer's own
 * encode: re-running the packer overwrites the pages and the pins.
 */
export const DRILLER_GROUND_REGIONS = [
  {
    name: 'dirt-west',
    x: 191,
    y: 94,
    width: 1154,
    height: 580,
    bytes: 29084,
  },
  {
    name: 'dirt-east',
    x: 729,
    y: 364,
    width: 1128,
    height: 566,
    bytes: 26446,
  },
  {
    name: 'road',
    x: 319,
    y: 158,
    width: 322,
    height: 164,
    bytes: 2798,
  },
  {
    name: 'stone',
    x: -1,
    y: -2,
    width: 2050,
    height: 1028,
    bytes: 67486,
  },
] as const;

export const CUTTING_GROUND_REGIONS = [
  {
    name: 'dirt-west',
    x: 191,
    y: 94,
    width: 962,
    height: 484,
    bytes: 18340,
  },
  {
    name: 'dirt-east',
    x: 895,
    y: 446,
    width: 898,
    height: 484,
    bytes: 18166,
  },
  {
    name: 'road',
    x: 255,
    y: 126,
    width: 1538,
    height: 772,
    bytes: 25874,
  },
  {
    name: 'stone',
    x: -1,
    y: -2,
    width: 2050,
    height: 1028,
    bytes: 61940,
  },
] as const;

export const CUTTING_POOL_BYTES = 15468;

export const DRILLER_PLATES = [
  {
    name: 'shaft',
    x: 1407,
    y: 702,
    width: 386,
    height: 196,
    bytes: 3192,
  },
  {
    name: 'gantry-2-1',
    x: 767,
    y: 78,
    width: 130,
    height: 84,
    bytes: 996,
  },
  {
    name: 'gantry-17-1',
    x: 1727,
    y: 558,
    width: 130,
    height: 84,
    bytes: 990,
  },
  {
    name: 'gantry-2-10',
    x: 191,
    y: 366,
    width: 130,
    height: 84,
    bytes: 996,
  },
  {
    name: 'gantry-17-10',
    x: 1151,
    y: 846,
    width: 130,
    height: 84,
    bytes: 1000,
  },
] as const;
