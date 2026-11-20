/**
 * The river road's set pieces, placed as boxes (stage 5 of `docs/level-design.md`; the brief is
 * `docs/places/river_road.md`, "Set pieces" and "Finds", and the kit list this plan implies is at the end of it). Each
 * member has a footprint in cells, a height in figures (Kaya, 45 px, is 1.0), whether it is solid and what kind of
 * thing it is. Solid members stand on the cells the rows block (the trees, the crates, the boulders, the cliff, the
 * water); everything else is non-solid and stands on open ground beside its anchor.
 *
 * The walking paths are the board's worn paths (`RIVER_ROAD_WORN`, which the ground bake wears into the plate), named
 * here by what they are, not a second copy: nothing non-solid stands on one. `setPieces.test.ts` holds the plan to the
 * rows, those paths, the quiet ground and the placement rules, and `?boxes` (a dev build) draws it over the board.
 *
 * Five zones, one a view of the brief, each with one focal piece: the landing (from the coast), the shade stop, the
 * bridge, the bend's cliff and the lookout.
 */
import type { Vec2 } from '../../core/types';
import { RIVER_ROAD } from '../regions/saltstepEmberwatch/maps';
import type { MemberKind, PlanMember, PlannedSetPiece, SetPiecePlan } from '../setPieces';
import { RIVER_ROAD_WORN } from './rg02.topdown';

interface Extra {
  readonly overhead?: boolean;
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

/** A flat on the ground: planks, stones, a bedroll, ash. */
const flat = (id: string, name: string, x: number, y: number, w = 1, h = 1, extra?: Extra) =>
  mem(id, name, x, y, w, h, 0, false, 'flat', extra);
/** A small standing thing on open ground. */
const prop = (
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  height: number,
  extra?: Extra,
) => mem(id, name, x, y, w, h, height, false, 'prop', extra);
/** A thing that fills a cell the rows block (a crate stack, a boulder, a boat on the water). */
const solid = (
  id: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  height: number,
  extra?: Extra,
) => mem(id, name, x, y, w, h, height, true, 'prop', extra);

/**
 * The board's worn paths by name: the road, the shade stop's pull-off, the camp's trodden ground, the footpath down
 * to the landing and the track up to the lookout. Every cell comes from `RIVER_ROAD_WORN`.
 */
export function riverRoadTracks(): ReadonlyMap<string, readonly Vec2[]> {
  const out = new Map<string, Vec2[]>();
  const seen = new Set<string>();
  for (const [x, y] of RIVER_ROAD_WORN) {
    // the worn list names a few cells twice (its explicit footpath cells are worn earth in the rows too)
    if (seen.has(`${x},${y}`)) continue;
    seen.add(`${x},${y}`);
    const ch = RIVER_ROAD.rows[y]?.[x] ?? '';
    // the footpath leaves the road below the shade stop (its first cells are worn earth too)
    const id =
      ch === '='
        ? 'road'
        : x < 17 && y >= 7
          ? 'landing_path'
          : ch === '.' || ch === 'F'
            ? x < 17
              ? 'shade_pull_off'
              : 'camp_ground'
            : 'lookout_track';
    const cells = out.get(id) ?? [];
    cells.push({ x, y });
    out.set(id, cells);
  }
  return out;
}

/** The rim's trees: one on every `T` cell but the shade stop's own big tree. */
const SHADE_TREE: Vec2 = { x: 10, y: 3 };
const RIM_TREES: PlanMember[] = RIVER_ROAD.rows.flatMap((row, y) =>
  [...row].flatMap((ch, x) =>
    ch === 'T' && !(x === SHADE_TREE.x && y === SHADE_TREE.y)
      ? [
          mem(`rim-tree-${x}-${y}`, 'tree', x, y, 1, 1, 2.2, true, 'fades', {
            have: 'harbour_tree',
          }),
        ]
      : [],
  ),
);

const PIECES: readonly PlannedSetPiece[] = [
  {
    id: 'landing',
    purpose:
      "Where someone works the river from below the road: a small jetty at the foot of the footpath, a boat tied to it and a net drying on the gravel. The echo ring is made on the still water here (the brief's finds).",
    anchor: 'landing-jetty',
    focal: true,
    members: [
      flat('landing-jetty', 'jetty', 6, 10, 3, 1),
      solid('landing-boat', 'boat', 3.6, 10.1, 2.2, 0.8, 0.4),
      prop('landing-mooring-post', 'mooring post', 8.6, 10.2, 0.25, 0.25, 0.6),
      prop('landing-net-rack', 'net drying on two poles', 8.2, 9.1, 1.6, 0.6, 0.9),
    ],
  },
  {
    id: 'shade_stop',
    purpose:
      "The carters' stop in the shade of one big old tree: a trough to water the birds, a log to sit on, a post to tie up to. Parcel's third stop of the day.",
    anchor: 'shade-tree',
    focal: true,
    members: [
      mem('shade-tree', 'big old tree', 10, 3, 1, 1, 2.6, true, 'fades'),
      solid('shade-trough', 'water trough', 12, 3, 1, 1, 0.6),
      prop('shade-log-bench', 'log to sit on', 8.2, 3.35, 1.6, 0.5, 0.45),
      prop('shade-hitching-post', 'hitching post', 13.4, 3.4, 0.25, 0.25, 0.9),
    ],
  },
  {
    id: 'bridge',
    purpose:
      "The plank bridge that carries the road over the side stream, and the toll the corporal's six have put across it: a pole laid over the deck on a post (SF-2.3).",
    anchor: 'bridge-deck',
    focal: true,
    // Later states (the brief): before SF-2.3 the pole is across the deck; after a win or Carry on it is raised and
    // lies by its post. Both are the same two pieces of art, placed differently.
    members: [
      flat('bridge-deck', 'plank deck', 19, 5, 2, 2),
      prop('bridge-rail-north', 'north rail', 19, 5, 2, 0.15, 0.35),
      prop('bridge-rail-south', 'south rail', 19, 6.85, 2, 0.15, 0.35),
      prop('bridge-toll-pole', 'toll pole across the deck', 20.6, 5.1, 0.2, 1.8, 0.5),
      prop('bridge-pole-post', "the pole's post", 21.3, 7.3, 0.3, 0.3, 1),
    ],
  },
  {
    id: 'guards_camp',
    purpose:
      'Where the six guards and their corporal wait out the toll, unpaid for two months: a cold fire, bedrolls, a pot, their crates and a hand-lettered sign facing the road.',
    anchor: 'camp-cold-fire',
    // Later states (the brief): after a win the camp is gone (the crates and bedrolls with it); after Carry on, one
    // sack of cabbages sits by the cold fire.
    members: [
      flat('camp-cold-fire', 'cold fire', 24, 3),
      solid('camp-crates-west', 'crates', 23, 3, 1, 1, 0.9, { have: 'crate_stack' }),
      solid('camp-crates-east', 'crates', 25, 2, 1, 1, 0.9, { have: 'crate_stack' }),
      flat('camp-bedroll-1', 'bedroll', 22, 2),
      flat('camp-bedroll-2', 'bedroll', 26, 3),
      flat('camp-bedroll-3', 'bedroll', 24, 4),
      flat('camp-rubbish', 'rubbish nobody collects', 26, 2),
      prop('camp-pot', 'cooking pot', 21.3, 2.4, 0.4, 0.4, 0.35),
      prop('camp-toll-sign', 'toll sign', 21.2, 3.5, 0.6, 0.3, 0.9),
    ],
  },
  {
    id: 'ford',
    purpose:
      "The way round the bridge: stepping stones across the side stream, a fallen log just below them, and the shingle where the stones come ashore beside the far bank's boulder.",
    anchor: 'ford-stones',
    members: [
      flat('ford-stones', 'stepping stones', 20, 8, 2, 1),
      solid('ford-log', 'fallen log in the stream', 20, 9.2, 2, 0.6, 0.35),
      flat('ford-shingle', 'wet shingle', 22, 9),
      solid('ford-boulder', 'boulder', 23, 8, 1, 1, 0.7, { have: 'boulders' }),
    ],
  },
  {
    id: 'far_bank',
    purpose:
      "A boulder on the far bank past the ford, cover in the fight, with driftwood washed up at its foot (the find there is the writing pass's).",
    anchor: 'far-bank-boulder',
    members: [
      solid('far-bank-boulder', 'boulder', 26, 7, 1, 1, 0.8, { have: 'boulders' }),
      flat('far-bank-driftwood', 'driftwood', 26, 8),
    ],
  },
  {
    id: 'bend_cliff',
    purpose:
      'The rock the road bends round, which hides the far end until you reach it, with a fallen spur at its foot.',
    anchor: 'bend-cliff',
    focal: true,
    members: [
      solid('bend-cliff', 'cliff', 29, 0, 5, 2, 1.6, { have: 'rock_spur' }),
      solid('bend-cliff-foot', 'fallen rock at the foot', 30, 2, 3, 1, 1, { have: 'rock_spur' }),
    ],
  },
  {
    id: 'lookout',
    purpose:
      "The place everyone pulls off to look at three valleys at once: a flat rock to sit on, a milestone at the head of the track, a wind-bent tree. Scene 5.6's meal on the tailgate.",
    anchor: 'lookout-rock',
    focal: true,
    // Later state (Scene 5.6): the cart stands on the rise's west end with the meal on its tailgate, in evening light.
    members: [
      prop('lookout-rock', 'flat rock to sit on', 36.4, 2.2, 1.4, 0.6, 0.45),
      prop('lookout-milestone', 'milestone', 35.3, 1.4, 0.4, 0.4, 0.6),
      mem('lookout-tree', 'wind-bent tree', 38, 2, 1, 1, 2, false, 'fades'),
    ],
  },
  {
    id: 'rim_trees',
    purpose: 'The wooded hills rising off the map to the north, a tree on every rim cell.',
    anchor: RIM_TREES[0]?.id ?? '',
    bulk: true,
    members: RIM_TREES,
  },
];

export const RIVER_ROAD_SET_PIECE_PLAN: SetPiecePlan = {
  mapId: RIVER_ROAD.id,
  pieces: PIECES,
  zones: [
    { id: 'from_the_coast', rect: { x0: 0, y0: 0, x1: 8, y1: 13 } },
    { id: 'shade_stop', rect: { x0: 9, y0: 0, x1: 16, y1: 13 } },
    { id: 'bridge', rect: { x0: 17, y0: 0, x1: 27, y1: 13 } },
    { id: 'bend', rect: { x0: 28, y0: 0, x1: 33, y1: 13 } },
    { id: 'lookout', rect: { x0: 34, y0: 0, x1: 39, y1: 13 } },
  ],
  quiet: [
    // the river, wide and empty along the whole south edge
    { id: 'river', x0: 0, y0: 11, x1: 39, y1: 13 },
    // the open top of the rise and the sky over it: nothing between the eye and the three valleys
    { id: 'lookout_view', x0: 36, y0: 0, x1: 39, y1: 1 },
  ],
  // the road carries no lamps; a later camp fire or a night state would be the first
  maxLanterns: 4,
};
