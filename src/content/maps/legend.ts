/**
 * The shared map legend.
 *
 * Maps are authored as ASCII so a whole battlefield fits on one screen and is
 * editable by anyone, including a nine-year-old who wants to add more trees.
 * One character is one tile. Row length must equal the map's declared width —
 * the content-validation test enforces that, so a miscounted row fails CI
 * rather than producing a subtly wrong battlefield.
 */

import type { TileTemplate } from '../../core/types';

export const LEGEND: Readonly<Record<string, TileTemplate>> = {
  /* Open ground ---------------------------------------------------- */
  '.': { terrain: 'dirt' },
  ',': { terrain: 'grass' },
  '=': { terrain: 'road' },
  ':': { terrain: 'sand' },
  w: { terrain: 'wood' },
  s: { terrain: 'stone' },

  /* Blocking ------------------------------------------------------- */
  '#': { terrain: 'wall', blocked: true, blocksSight: true },
  T: { terrain: 'grass', blocked: true, blocksSight: true },
  B: { terrain: 'wood', blocked: true, blocksSight: true },
  P: { terrain: 'pit', blocked: true, blocksSight: false },

  /* Cover without blocking ----------------------------------------- */
  c: { terrain: 'wood', cover: true },
  // Rubble lies on spoil, not paving: `sand` is the ground contract's quarry
  // spoil. Terrain carries no rule, so this only sets the ground a partial
  // scene shows round a painted heap, which pale limestone left reading as a slab.
  // Cover is not a property of the tile: the live rubble surface grants it
  // (`grantsCover`, read by `hasCover`), so water turning the heap to mud — or
  // the rubble clearing — takes the cover with it.
  r: { terrain: 'sand', surface: 'rubble', surfaceDuration: -1 },

  /* Elevation ------------------------------------------------------ */
  '^': { terrain: 'stone', elevation: 1 },
  A: { terrain: 'stone', elevation: 2 },

  /* Authored surfaces ---------------------------------------------- */
  '~': { terrain: 'dirt', surface: 'water', surfaceDuration: -1 },
  o: { terrain: 'stone', surface: 'oil', surfaceDuration: -1 },
  m: { terrain: 'dirt', surface: 'mud', surfaceDuration: -1 },
};

/** Every legend key, for the validation test's error messages. */
export const LEGEND_KEYS = Object.keys(LEGEND);
