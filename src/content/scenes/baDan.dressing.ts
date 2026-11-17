/**
 * Ba Dan square's dressing plan (ADR 0119, the cohesion pilot, 2026-11-17): the design note in
 * `docs/art-cohesion.md` ("Worked example: Ba Dan square"), as data. Each set piece says what it is
 * for; the paths are where people walk between doors, the table, the well and the road; the quiet
 * ground is left open on purpose; each zone has one focal piece. `setPieces.test.ts` holds the layout
 * to it, and the ground baker draws the aprons into the plate.
 *
 * Coordinates: cells, or top-down world px (40 a cell) for the aprons.
 */
import type { DesireLine, DressingPlan, SetPiece } from '../setPieces';

const SET_PIECES: readonly SetPiece[] = [
  {
    id: 'mira-table',
    purpose:
      "Mira's table, where the village eats together: bowls at dawn, the shared meal at midday, company at evening, the welcome home. The crews built its bench from offcuts.",
    anchor: 'mira-table',
    satellites: ['crew-bench'],
    focal: true,
    aprons: [{ kind: 'flags', x: 446, y: 207, rx: 70, ry: 29 }],
  },
  {
    id: 'gao-shop',
    purpose:
      "Gao's shop: herbs and lamp oil against the shopfront, the display across his trodden forecourt, stock and his banner in the alley he restocks from.",
    anchor: 'gao-house',
    satellites: ['gao-herbs', 'gao-barrel', 'gao-display', 'shop-crates', 'banner-north'],
    aprons: [
      { kind: 'earth', x: 322, y: 196, rx: 74, ry: 24 },
      { kind: 'weeds', x: 420, y: 152, rx: 14, ry: 4 },
    ],
  },
  {
    id: 'mira-house',
    purpose:
      "Mira's house: the broom she sweeps the square with by her door, her washing on the line beside the house.",
    anchor: 'mira-house',
    satellites: ['mira-broom', 'laundry'],
    aprons: [
      { kind: 'earth', x: 720, y: 120, rx: 34, ry: 7 },
      { kind: 'weeds', x: 684, y: 116, rx: 7, ry: 3 },
      { kind: 'weeds', x: 757, y: 116, rx: 7, ry: 3 },
    ],
  },
  {
    id: 'gate-post',
    purpose:
      "The gate post where the east road leaves: Dorin's watch by day and Hanru's by night, the notice board, and Dorin's handcart parked behind the post.",
    anchor: 'notice-board',
    satellites: ['handcart'],
    aprons: [
      { kind: 'earth', x: 696, y: 262, rx: 30, ry: 14 },
      { kind: 'weeds', x: 740, y: 274, rx: 16, ry: 3 },
    ],
  },
  {
    id: 'gate-lamps',
    purpose:
      'The gate lamps either side of the east road, the one Hanru keeps lit for anyone coming down from the quarry in the dark.',
    anchor: 'lamp-post',
    satellites: ['lamp-east'],
    run: true,
    aprons: [
      { kind: 'weeds', x: 820, y: 274, rx: 8, ry: 3 },
      { kind: 'weeds', x: 820, y: 394, rx: 8, ry: 3 },
    ],
  },
  {
    id: 'wayside-shrine',
    purpose:
      'A wayside shrine at the gate, beside the road the missing went up: people stop at it on the way out and on the way home.',
    anchor: 'shrine',
    satellites: [],
    focal: true,
    aprons: [
      { kind: 'flags', x: 740, y: 400, rx: 22, ry: 8 },
      { kind: 'weeds', x: 740, y: 392, rx: 26, ry: 3 },
    ],
  },
  {
    id: 'carters-stop',
    purpose:
      'Where the stone carts water their animals on the way through: the trough by the gate lamp, the hay beside it, the ground wet and trodden round them.',
    anchor: 'trough',
    satellites: ['haystack'],
    aprons: [
      { kind: 'wet', x: 800, y: 438, rx: 34, ry: 11 },
      { kind: 'hay', x: 860, y: 440, rx: 26, ry: 9 },
    ],
  },
  {
    id: 'village-well',
    purpose:
      "The well between the south houses, where the households draw water: Pella's court is beside it and the school lane runs past.",
    anchor: 'well',
    satellites: [],
    focal: true,
    aprons: [{ kind: 'wet', x: 498, y: 566, rx: 44, ry: 16 }],
  },
  {
    id: 'southeast-store',
    purpose: "The south-east house's barrels, stored against its side wall out of the lane.",
    anchor: 'southeast-house',
    satellites: ['southeast-barrels'],
    aprons: [{ kind: 'weeds', x: 700, y: 474, rx: 18, ry: 3 }],
  },
  {
    id: 'cabbage-stall',
    purpose:
      "The household's cabbage garden and its stall on the road, where the vegetables Bo-shan carts up are grown and sold: pots and a sack by the beds.",
    anchor: 'south-stall',
    satellites: ['south-produce', 'garden', 'garden-pots', 'garden-sack'],
    aprons: [{ kind: 'earth', x: 150, y: 402, rx: 54, ry: 12 }],
  },
];

const row = (y: number, x0: number, x1: number): { x: number; y: number }[] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => ({ x: x0 + i, y }));
const col = (x: number, y0: number, y1: number): { x: number; y: number }[] =>
  Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ x, y: y0 + i }));

const PATHS: readonly DesireLine[] = [
  // the way through: the ford's end to the east gate
  { id: 'east-road', cells: [...row(7, 1, 22), ...row(8, 1, 22)] },
  { id: 'gao-door-to-bridge', cells: [...row(4, 7, 9), ...col(9, 5, 7)] },
  { id: 'mira-door-to-road', cells: col(13, 4, 7) },
  { id: 'mira-door-to-table', cells: row(5, 11, 13) },
  { id: 'post-to-road', cells: col(17, 6, 7) },
  { id: 'well-lane', cells: col(11, 9, 14) },
  { id: 'south-doors', cells: row(14, 8, 17) },
];

export const BA_DAN_DRESSING_PLAN: DressingPlan = {
  mapId: 'ba_dan_village',
  scope: { x0: 3, y0: 1, x1: 21, y1: 14 },
  setPieces: SET_PIECES,
  paths: PATHS,
  quiet: [
    // the square's open middle, where the road, the bridge, the canal head and the well lane meet
    { x0: 10, y0: 7, x1: 16, y1: 9 },
    // the canal head before Mira's door
    { x0: 14, y0: 5, x1: 15, y1: 6 },
    // the lawn south of the gate
    { x0: 18, y0: 11, x1: 21, y1: 13 },
  ],
  zones: [
    { id: 'square', rect: { x0: 5, y0: 1, x1: 14, y1: 6 } },
    { id: 'gate', rect: { x0: 15, y0: 1, x1: 22, y1: 11 } },
    { id: 'well-court', rect: { x0: 5, y0: 9, x1: 14, y1: 15 } },
  ],
};
