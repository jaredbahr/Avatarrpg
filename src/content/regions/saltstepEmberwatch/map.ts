/** Saltstep and Emberwatch's first map. TODO(region): the real rows, NPCs and exits. */
import type { MapDef } from '../../../core/types';
import { LEGEND } from '../../maps/legend';

export const SALTSTEP_EMBERWATCH_HUB: MapDef = {
  id: 'saltstep_emberwatch_hub',
  name: 'Saltstep and Emberwatch',
  kind: 'explore',
  width: 12,
  height: 8,
  rows: [
    'TTTTTTTTTTTT',
    'T,,,,,,,,,,T',
    'T,,,,==,,,,T',
    'T,,,,==,,,,T',
    'T,,,,==,,,,T',
    'T,,,,==,,,,T',
    'T,,,,,,,,,,T',
    'TTTTTTTTTTTT',
  ],
  legend: LEGEND,
  partySpawns: [
    { x: 5, y: 6 },
    { x: 6, y: 6 },
    { x: 4, y: 6 },
    { x: 7, y: 6 },
    { x: 3, y: 6 },
    { x: 8, y: 6 },
  ],
  npcs: [
    {
      id: 'saltstep_emberwatch_guide',
      name: 'Guide',
      pos: { x: 6, y: 2 },
      sprite: 'npc.elder',
      node: 'saltstep_emberwatch_welcome',
    },
  ],
  props: [],
  ambience: 'none',
};
