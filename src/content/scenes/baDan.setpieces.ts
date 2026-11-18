/**
 * Ba Dan's set pieces, placed as boxes (stage 5 of `docs/level-design.md`; the plan is in
 * `docs/places/ba_dan_village.md`, "Set pieces", and the kit list it implies is at the end of that file). Each member
 * has a footprint in cells, a height in figures (Kaya, 45 px, is 1.0), whether it is solid and what kind of thing it
 * is. Solid members stand on the cells the rows block; everything else is non-solid and tucked against its anchor.
 *
 * The walking paths are the ground spec's named tracks (`baDan.ground.ts`, ADR 0120), not a second copy: nothing
 * stands on one, except the table on its own disk. `setPieces.test.ts` holds the plan to the rows, the tracks, the
 * quiet ground and the placement rules, and `?boxes` (a dev build) draws it over the explore board.
 *
 * It replaces the 24 x 16 board's dressing plan (ADR 0119, now `maps/oldVillage.dressing.fixture.ts`). A member keeps
 * the old object's id where the same thing survives (`mira-table`, `crew-bench`, `trough`, `shrine`, `handcart`,
 * `lamp-post`, `gao-house`, `mira-house`).
 */
import { BA_DAN_VILLAGE } from '../maps/village';
import type { MemberKind, PlanMember, PlannedSetPiece, SetPiecePlan, CellRect } from '../setPieces';
import { BA_DAN_GROUND_SPEC } from './baDan.ground';

interface Extra {
  readonly overhead?: boolean;
  readonly lantern?: boolean;
  readonly have?: string;
}

/** A member: id, name, top-left cell, footprint in cells, height in figures, solid, kind. */
const mem = (
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  height: number,
  solid: boolean,
  kind: MemberKind,
  extra: Extra = {},
): PlanMember => ({ id, name, x, y, w, h, height, solid, kind, ...extra });

const building = (
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  height: number,
) => mem(id, name, x, y, w, h, height, true, 'building');
/** A flat on the ground: a doorstep, treads. */
const flat = (id: string, name: string, x: number, y: number, w = 1, h = 1) =>
  mem(id, name, x, y, w, h, 0, false, 'flat');
/** A small standing thing in one cell, off its corner a little. */
const small = (
  id: string,
  name: string,
  cx: number,
  cy: number,
  w: number,
  height: number,
  extra?: Extra,
) => mem(id, name, cx, cy, w, w, height, false, 'prop', extra);

/** The rim's trees: one on every `T` cell the quiet ground does not hold clear. */
const QUIET: SetPiecePlan['quiet'] = [
  // the welcome ground inside the east gate (the ground spec's own quiet box)
  {
    id: 'welcome',
    x0: BA_DAN_GROUND_SPEC.quiet?.[0]?.[0] ?? 18,
    y0: BA_DAN_GROUND_SPEC.quiet?.[0]?.[1] ?? 10,
    x1: BA_DAN_GROUND_SPEC.quiet?.[0]?.[2] ?? 28,
    y1: BA_DAN_GROUND_SPEC.quiet?.[0]?.[3] ?? 12,
  },
  // the flooded ford: the old road going under
  { id: 'ford', x0: 0, y0: 9, x1: 2, y1: 10 },
  // the square's open middle round the table
  { id: 'square_middle', x0: 10, y0: 8, x1: 17, y1: 10 },
];

const inRect = (r: CellRect, x: number, y: number): boolean =>
  x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

const RIM_TREES: readonly PlanMember[] = BA_DAN_VILLAGE.rows.flatMap((row, y) =>
  [...row].flatMap((ch, x) =>
    ch === 'T' && !QUIET.some((q) => inRect(q, x, y))
      ? [mem(`rim-tree-${x}-${y}`, 'rim tree', x, y, 1, 1, 1.5, true, 'fades')]
      : [],
  ),
);

const PIECES: readonly PlannedSetPiece[] = [
  {
    id: 'mira_table',
    purpose:
      "Mira's table in the square, where the village eats three times a day and the welcome home is held; the patched awning is the one strong colour in Ba Dan, so the table reads from every view.",
    anchor: 'mira-table',
    focal: true,
    ownDisk: 'square_table',
    quietOk: ['square_middle'],
    members: [
      mem('mira-table', 'table', 13, 9, 2, 1, 0.65, true, 'prop', { have: 'mira_table' }),
      mem('awning-post-nw', 'awning post NW', 12.5, 8.5, 0.2, 0.2, 1.6, false, 'fades'),
      mem('awning-post-ne', 'awning post NE', 15.3, 8.5, 0.2, 0.2, 1.6, false, 'fades'),
      mem('awning-post-sw', 'awning post SW', 12.5, 9.8, 0.2, 0.2, 1.6, false, 'fades'),
      mem('awning-post-se', 'awning post SE', 15.3, 9.8, 0.2, 0.2, 1.6, false, 'fades'),
      mem('awning-cloth', 'patched awning', 12.5, 8.5, 3, 1.5, 1.7, false, 'fades', {
        overhead: true,
      }),
      mem('crew-bench', 'bench', 13, 10, 2, 1, 0.8, false, 'prop', { have: 'bench' }),
      small('chair-west', 'repaired chair W', 12.2, 9.2, 0.6, 0.65),
      small('chair-east', 'repaired chair E', 15.2, 9.2, 0.6, 0.65),
    ],
  },
  {
    id: 'mira_house',
    purpose:
      "Mira's house on the square: her doorstep faces the table, the water jar and a potted shrub stand against her wall.",
    anchor: 'mira-house',
    members: [
      building('mira-house', "Mira's house", 11, 4, 5, 3, 2.15),
      flat('mira-doorstep', 'doorstep', 13, 6),
      small('mira-jar', 'water jar', 16.2, 7.2, 0.6, 0.6),
      small('mira-shrub', 'potted shrub', 11.2, 7.2, 0.6, 0.6),
    ],
  },
  {
    id: 'gao_shop',
    purpose:
      "Gao's shop and the storeroom behind it, an L of stone: the plant on the only spare chair, two stools and the sacks he restocks from by the storeroom.",
    anchor: 'gao-house',
    members: [
      building('gao-house', "Gao's shop", 19, 4, 4, 3, 1.55),
      building('gao-store', 'storeroom', 23, 4, 2, 2, 1.4),
      small('gao-plant', 'plant on the spare chair', 18.2, 6.2, 0.6, 0.7),
      small('gao-stool-a', 'stool', 24.1, 6.4, 0.35, 0.5),
      small('gao-stool-b', 'stool', 24.55, 6.4, 0.35, 0.5),
      small('gao-sacks', 'sacks', 25.2, 6.2, 0.6, 0.6),
    ],
  },
  {
    id: 'trough',
    purpose:
      "Gao's trough on the road in, where the stone carts water their animals on the way through.",
    anchor: 'trough',
    members: [
      mem('trough', 'trough', 21, 7, 1, 1, 0.6, true, 'prop', { have: 'trough' }),
      small('trough-bucket', 'bucket', 22.3, 7.3, 0.4, 0.55),
    ],
  },
  {
    id: 'east_gate',
    purpose:
      "The gate everyone walks around: a bell post in a low stone wall, the watch's stool, the lamp that guides anyone down from the quarry in the dark. The wall's rhythm breaks once, at a mended section.",
    anchor: 'gate-post',
    focal: true,
    ownDisk: 'gate_post',
    members: [
      mem('gate-post', 'gate post with the old shift bell', 29, 8, 1, 1, 1.55, true, 'prop'),
      mem('gate-wall-a', 'low wall', 29, 3, 1, 2, 0.6, true, 'prop'),
      mem('gate-wall-mended', 'mended section', 29, 5, 1, 1, 0.6, true, 'prop'),
      mem('gate-wall-b', 'low wall', 29, 6, 1, 2, 0.6, true, 'prop'),
      mem('gate-wall-south-a', 'low wall', 29, 11, 1, 2, 0.6, true, 'prop'),
      // the canal passes under the wall line here
      flat('gate-culvert', 'culvert grate over the canal', 29, 13, 1, 2),
      mem('gate-wall-south-b', 'low wall', 29, 15, 1, 4, 0.6, true, 'prop'),
      small('gate-stool', "the watch's stool", 28.3, 8.3, 0.4, 0.5),
      mem('lamp-post', 'gate lamp on the wall', 29, 11, 1, 1, 1.8, true, 'fades', {
        lantern: true,
        have: 'lamp',
      }),
    ],
  },
  {
    id: 'guard_hut',
    purpose:
      'The guard hut by the gate where Dorin and Hanru keep the watch: the notice board on its west wall, a cupboard behind the post, and the washing line tied across to the shrine.',
    anchor: 'guard-hut',
    members: [
      building('guard-hut', 'guard hut', 27, 6, 2, 2, 1.35),
      mem('washing-line', 'washing line, hut to shrine', 26, 7, 1, 1, 1.25, false, 'fades', {
        overhead: true,
      }),
    ],
  },
  {
    id: 'shrine',
    purpose:
      'A wayside shrine at the gate, beside the road the missing went up: people stop at it on the way out and on the way home.',
    anchor: 'shrine',
    members: [mem('shrine', 'shrine', 25, 7, 1, 1, 1.7, true, 'fades', { have: 'shrine' })],
  },
  {
    id: 'wash_steps',
    purpose: 'The steps down to the canal, where washing is done and the bending practice stands.',
    anchor: 'wash-treads',
    members: [
      flat('wash-treads', 'stone treads', 9, 12, 2, 1),
      small('wash-basket', 'basket', 8.3, 11.3, 0.4, 0.55),
      small('wash-board', 'washboard on the kerb', 11.3, 11.3, 0.4, 0.6),
    ],
  },
  {
    id: 'canal_lamps',
    purpose:
      'The lamps along the canal that come on at dusk on the walk home, three on the kerb with one gap where the bridge is.',
    anchor: 'canal-lamp-west',
    run: true,
    members: [
      mem('canal-lamp-west', 'canal lamp', 5, 12, 1, 1, 1.8, true, 'fades', {
        lantern: true,
        have: 'lamp',
      }),
      mem('canal-lamp-middle', 'canal lamp', 17, 13, 1, 1, 1.8, true, 'fades', {
        lantern: true,
        have: 'lamp',
      }),
      mem('canal-lamp-east', 'canal lamp', 24, 13, 1, 1, 1.8, true, 'fades', {
        lantern: true,
        have: 'lamp',
      }),
    ],
  },
  {
    id: 'mason_yard',
    purpose:
      "The mason's yard: Tuo cuts the village's stone here and Hesra lodges in the house. Worked blocks, a bench and the offcut heap; her step and windowsill wait for the boot.",
    anchor: 'mason-house',
    focal: true,
    members: [
      building('mason-house', "mason's house", 2, 5, 3, 3, 1.35),
      mem('mason-block-a', 'worked block', 5, 6, 1, 1, 0.65, true, 'prop'),
      mem('mason-block-b', 'worked block', 6, 6, 1, 1, 0.65, true, 'prop'),
      mem('mason-block-c', 'worked block', 5, 8, 1, 1, 0.65, true, 'prop'),
      small('mason-bench', 'work bench', 7.1, 6.2, 0.8, 0.5),
      small('mason-offcuts', 'offcut heap', 8.2, 6.4, 0.6, 0.55),
      flat('hesra-step', "Hesra's step and windowsill", 5, 7),
    ],
  },
  {
    id: 'side_gate',
    purpose:
      "The side gate in the garden fence, hung open on its post: Dorin's key register is about it (SQ-02), and later it is hung the right way round with a hen on its post.",
    anchor: 'side-gate',
    members: [mem('side-gate', 'side gate, open', 25, 2, 1, 1, 0.7, true, 'prop')],
  },
  {
    id: 'gardens',
    purpose:
      'The common vegetable strips behind the houses, one per household: a lean-to for the tools and a basket (the strip ends are marked another way, later).',
    anchor: 'garden-lean-to',
    focal: true,
    members: [
      mem('garden-lean-to', 'tool lean-to', 28, 2, 1, 1, 0.85, false, 'fades'),
      small('garden-basket', 'basket', 28.3, 3.3, 0.4, 0.55),
    ],
  },
  {
    id: 'tea_terrace',
    purpose:
      "Nala's tea terrace cut into the hillside above the square, quiet, looking down: two stools, and the tea that Pella picks for her.",
    anchor: 'terrace-stool-large',
    focal: true,
    members: [
      small('terrace-stool-large', 'stool', 7.3, 2.3, 0.4, 0.5),
      small('terrace-stool-small', 'small stool', 8.35, 2.35, 0.3, 0.5),
    ],
  },
  {
    id: 'pella_house',
    purpose:
      "Pella's house, which she shares with Bo-shan, past the canal: her shutter, Bo-shan's handcart at the side, a doorstep to the lane.",
    anchor: 'pella-house',
    focal: true,
    members: [
      building('pella-house', "Pella's house", 8, 15, 4, 3, 1.55),
      flat('pella-doorstep', 'doorstep', 9, 14),
      small('handcart', "Bo-shan's handcart", 12.1, 17.1, 0.8, 0.9, { have: 'handcart' }),
    ],
  },
  {
    id: 'quarry_leto',
    purpose:
      "Leto's house in the company-built quarry row: the same style as its neighbours, with a bench by the door and a free doorstep for the boots that come home later.",
    anchor: 'leto-house',
    members: [
      building('leto-house', "Leto's house", 3, 16, 3, 2, 1.35),
      flat('leto-doorstep', 'doorstep', 4, 15),
      flat('leto-free-step', 'free doorstep', 5, 15),
      mem('leto-bench', 'bench', 3.05, 15.3, 0.8, 0.4, 0.6, false, 'prop'),
    ],
  },
  {
    id: 'quarry_amri',
    purpose:
      "Amri's house with the blue door in the quarry row: a pot against the wall and a free doorstep for the boots.",
    anchor: 'amri-house',
    members: [
      building('amri-house', "Amri's house", 15, 16, 3, 2, 1.35),
      flat('amri-doorstep', 'doorstep', 16, 15),
      flat('amri-free-step', 'free doorstep', 17, 15),
      small('amri-pot', 'pot', 14.3, 16.3, 0.5, 0.4),
    ],
  },
  {
    id: 'quarry_senn',
    purpose:
      "Senn's L-shaped house with the bent shutter in the quarry row: a log pile against the end wall and a free doorstep for the boots.",
    anchor: 'senn-house',
    members: [
      building('senn-house', "Senn's house", 20, 16, 4, 2, 1.5),
      building('senn-annex', "Senn's house, the L", 23, 18, 1, 1, 1.35),
      flat('senn-doorstep', 'doorstep', 24, 17),
      flat('senn-free-step', 'free doorstep', 24, 16),
      small('senn-logs', 'log pile', 24.1, 18.2, 0.7, 0.65),
    ],
  },
  {
    id: 'hanru_house',
    purpose:
      "Hanru's house with its shutters closed, for the night watch who sleeps by day, and her drying rack at the end wall.",
    anchor: 'hanru-house',
    members: [
      building('hanru-house', "Hanru's house", 26, 16, 2, 2, 1.35),
      mem('hanru-rack', 'drying rack', 28, 16, 1, 1, 0.9, false, 'fades'),
    ],
  },
  {
    id: 'rim_trees',
    purpose:
      'The trees on the rim cells and the cliff lip: the boundary of the village, a tree on every blocked border cell the ford and the gate leave open.',
    anchor: RIM_TREES[0]?.id ?? 'rim-tree',
    bulk: true,
    members: RIM_TREES,
  },
];

export const BA_DAN_SET_PIECE_PLAN: SetPiecePlan = {
  mapId: 'ba_dan_village',
  pieces: PIECES,
  // one screen or so each, one focal piece apiece
  zones: [
    { id: 'gate', rect: { x0: 24, y0: 3, x1: 31, y1: 12 } },
    { id: 'square', rect: { x0: 9, y0: 6, x1: 18, y1: 11 } },
    { id: 'west', rect: { x0: 1, y0: 4, x1: 8, y1: 11 } },
    { id: 'north_west', rect: { x0: 5, y0: 1, x1: 10, y1: 4 } },
    { id: 'past_canal', rect: { x0: 1, y0: 14, x1: 29, y1: 19 } },
    { id: 'north_east', rect: { x0: 23, y0: 1, x1: 28, y1: 5 } },
  ],
  quiet: QUIET,
  maxLanterns: 4,
};
