import type { MapDef } from '../core/types';

/**
 * A top-down fixture board for the camera and both-backend picking tests (ADR 0104, T1): grass, a
 * raised shelf with a ramp, a blocked rock face, standing water and a wall, so flat picking is tested
 * on the cells the oblique board lifts. Test-only; no content lists it.
 */
export const TOPDOWN_FIXTURE: MapDef = {
  id: 'fixture.topdown',
  name: 'Top-down fixture',
  kind: 'combat',
  projection: 'topdown',
  width: 9,
  height: 6,
  rows: ['.........', '..rHHH...', '..rHHX.~~', '...HHH.~~', '.#.......', '.#....hh.'],
  legend: {
    '.': { terrain: 'grass' },
    H: { terrain: 'stone', elevation: 1 },
    h: { terrain: 'stone', elevation: 2 },
    r: { terrain: 'stone', elevation: 1, ramp: true },
    X: { terrain: 'stone', elevation: 2, blocked: true },
    '~': { terrain: 'grass', surface: 'water' },
    '#': { terrain: 'wall' },
  },
  partySpawns: [{ x: 0, y: 0 }],
  npcs: [],
  props: [],
  ambience: 'forest',
};
