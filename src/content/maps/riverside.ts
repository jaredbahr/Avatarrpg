/** Walkable paths traced against the riverside painting. One cell is 1/36 of its width. */
import type { MapDef } from '../../core/types';
import { LEGEND } from './legend';
import { RETURNEE_PRESENTATIONS } from '../residents/returnees';

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
// A painted solid stands on its base cell, so the practice posts, the lantern,
// the rock and the trunk on the east bank each block one tile (R1 audit).
// Flowers never block on their own: a flowerbed is as walkable as the ground
// it grows in, and blocks only where a fence, post, pot, rock or wall stands
// on the cell or the ground itself is a rocky ledge (the shrine terrace).
const spans: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [],
  [],
  [[10, 10]],
  [
    [10, 10],
    [15, 15],
  ],
  // (16,5) is the garden fence in front of the north-east house; the beds in
  // front of the middle house (12..13,5) and inside the fence at (20,5) are ground.
  [
    [9, 15],
    [20, 20],
    [30, 32],
  ],
  // The sand lane west of the square runs up to the rock at (0,6).
  [
    [1, 2],
    [8, 17],
    [19, 20],
    [30, 32],
  ],
  [
    [2, 20],
    [30, 31],
  ],
  [
    [3, 20],
    [30, 31],
  ],
  [
    [4, 21],
    [30, 31],
  ],
  // (4,10) is the flower clump at the lantern's foot.
  [
    [4, 7],
    [13, 21],
    [29, 30],
    [32, 32],
  ],
  [
    [4, 7],
    [13, 29],
    [31, 33],
  ],
  [
    [4, 29],
    [31, 33],
  ],
  [
    [5, 19],
    [29, 32],
  ],
  [
    [9, 18],
    [29, 29],
    [32, 33],
  ],
  // (10,15..17) is the tea garden's hedge and fence.
  [
    [11, 18],
    [29, 32],
  ],
  [
    [11, 18],
    [29, 29],
    [31, 32],
  ],
  [
    [11, 12],
    [17, 18],
    [30, 31],
  ],
  // Tea porch, reached from the southeast stone steps, not through the rail.
  [
    [8, 8],
    [10, 11],
    [17, 18],
    [30, 32],
  ],
  [
    [7, 11],
    [18, 19],
    [32, 33],
  ],
  // The garden walkway's slabs (8,20) and (5..8,21) are open, and so is the
  // flowered lawn south of the tea-house fence (4..6,20). The walkway stops at
  // the boulders (4,21), the fence and its post (7,20) and the trees south of it.
  [
    [4, 6],
    [8, 11],
    [19, 20],
    [33, 34],
  ],
  // The daisies at the sand pocket's west side (18..19,21) are ground.
  [
    [5, 11],
    [18, 20],
  ],
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
      // Pella's supervised afternoon at the safe bank (ADR 0047 §8).
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
    {
      id: 'senn',
      name: 'Senn',
      resident: 'lw.npc.senn_messenger',
      sprite: RETURNEE_PRESENTATIONS['lw.npc.senn_messenger'].npcSprite,
      node: 'riverside_explore',
    },
  ],
  props: [],
  restSpots: [{ pos: RIVERSIDE_SPOTS.tea, label: 'the tea porch' }],
  // The south path is the only walkable ground on the rim; every cell of it
  // belongs to the exit mouth in `connectAct1`.
  edges: [{ side: 'south', span: [10, 11], treatment: 'exit' }],
  edgeContract: 'enforce',
};
