import type { MapDef, MapScene } from '../core/types';

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

/**
 * A tiny top-down scene for the fixture board (ADR 0104, T3): one ground plate over the whole
 * 9x6 board at 40 world px a tile, and one piece of scenery, a 1x2-tile rock standing on the
 * blocked cell (5, 2) with its top over (5, 1). The piece sorts by the cell below its footprint,
 * as a Ba Dan house does: a figure on (5, 1) or (4, 2) is behind it, one on (5, 3) is level with
 * it and so in front, and one on (6, 4) is in front. Test-only; the urls never load.
 */
export const TOPDOWN_FIXTURE_SCENE: MapScene = {
  ground: [{ url: 'fixture/topdown-ground.png', x: 0, y: 0, width: 360, height: 240 }],
  scenery: [
    {
      id: 'fixture.rock',
      url: 'fixture/topdown-rock.png',
      x: 200,
      y: 40,
      width: 40,
      height: 80,
      footprint: [{ x: 5, y: 2 }],
      depth: { x: 5.5, y: 3.5 },
    },
  ],
};
