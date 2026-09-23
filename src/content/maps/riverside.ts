/** Walkable paths traced against the riverside painting. One cell is 1/36 of its width. */
import type { MapDef } from '../../core/types';
import { LEGEND } from './legend';

export const RIVERSIDE_ID = 'ba_dan_riverside';
export const RIVERSIDE_ENTRY = 'riverside_explore';
export const RIVERSIDE_SPOTS = {
  mira: { x: 15, y: 9 },
  canopy: { x: 13, y: 9 },
  otter: { x: 17, y: 15 },
  tea: { x: 8, y: 18 },
  practice: { x: 30, y: 13 },
  shrine: { x: 31, y: 5 },
} as const;

// Ground footprints, not canopy silhouettes: the shaded lane west of the
// banyan is open. Only its trunk/stone planter blocks passage. Coordinates
// refer to tile centres, the same points used by feet and pointer targeting.
const spans: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [],
  [],
  [],
  [
    [10, 10],
    [15, 15],
  ],
  [
    [9, 10],
    [14, 16],
    [30, 32],
  ],
  [
    [8, 17],
    [20, 20],
    [30, 32],
  ],
  [
    [5, 19],
    [30, 31],
  ],
  [
    [4, 20],
    [30, 31],
  ],
  [
    [5, 21],
    [30, 31],
  ],
  [
    [5, 7],
    [13, 21],
    [29, 32],
  ],
  [
    [4, 7],
    [13, 33],
  ],
  [[4, 33]],
  [
    [5, 20],
    [29, 33],
  ],
  [
    [9, 18],
    [29, 33],
  ],
  [
    [10, 18],
    [29, 32],
  ],
  [
    [10, 18],
    [29, 31],
  ],
  [
    [10, 12],
    [17, 18],
    [30, 31],
  ],
  // Tea porch, reached from the southeast stone steps, not through the rail.
  [
    [8, 8],
    [10, 11],
    [30, 31],
  ],
  [[8, 10]],
  [[9, 10]],
  [[9, 10]],
  [[10, 11]],
  [[10, 11]],
];
const rows = spans.map((row) =>
  Array.from({ length: 36 }, (_, x) => (row.some(([a, b]) => x >= a && x <= b) ? '=' : '#')).join(
    '',
  ),
);

export const RIVERSIDE: MapDef = {
  id: RIVERSIDE_ID,
  name: 'Ba Dan · The Riverside',
  kind: 'explore',
  width: 36,
  height: 24,
  ambience: 'village',
  legend: LEGEND,
  rows,
  backdrop: { url: 'art/maps/ba_dan_riverside.webp', pixelsPerTile: 40 },
  partySpawns: [
    { x: 16, y: 12 },
    { x: 15, y: 12 },
    { x: 14, y: 12 },
    { x: 14, y: 13 },
    { x: 15, y: 13 },
    { x: 16, y: 13 },
  ],
  exit: { pos: { x: 10, y: 20 }, label: 'Back to Ba Dan village' },
  npcs: [
    {
      id: 'riverside_mira',
      name: 'Elder Mira',
      resident: 'lw.npc.mira',
      sprite: 'npc.elder',
      node: 'riverside_mira',
    },
    {
      id: 'riverside_dorin',
      name: 'Dorin',
      resident: 'lw.npc.dorin',
      // One person, one look: the same sprite as village Dorin.
      sprite: 'npc.dorin',
      node: 'riverside_dorin',
    },
    {
      // Pella's supervised afternoon at the safe bank (ADR 0047 §8); W6 writes her lines.
      id: 'riverside_pella',
      name: 'Pella',
      resident: 'lw.npc.pella',
      sprite: 'npc.kid',
      node: 'riverside_pella',
    },
    {
      id: 'riverside_shrine',
      name: 'The riverside shrine',
      pos: RIVERSIDE_SPOTS.shrine,
      sprite: 'npc.elder',
      node: 'riverside_shrine',
    },
  ],
  props: [],
  restSpots: [{ pos: RIVERSIDE_SPOTS.tea, label: 'The tea porch' }],
};
