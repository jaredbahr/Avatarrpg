/**
 * Ba Dan's top-down objects, drawn from the set-piece plan (`baDan.setpieces.ts`, stage 6 of `docs/level-design.md`): the
 * plan stays the single source of placement, and this file only says which sprite stands for each member and turns a
 * member's box into the object the ground packer grounds and the board draws. A member with no entry here is not drawn
 * (the flats are baked into the plate as ground aprons; the awning's four posts are part of its sprite).
 *
 * Positions are top-down world px, 40 a cell: `x` the box's centre, `base` its south edge. A wall run of several cells is
 * one sprite a cell. The shipped runtime never imports this (the packer bakes it into `scene.json`).
 */
import type { Vec2 } from '../../core/types';
import { memberCells, type PlanMember } from '../setPieces';
import type { TopDownObject } from '../topdownLayout';
import { BA_DAN_GROUND } from './baDan.ground';
import { BA_DAN_SET_PIECE_PLAN } from './baDan.setpieces';

const CELL = 40;

/** Sprite key -> source file, relative to `prototypes/topdown/assets`. */
export const BA_DAN_SPRITES: Readonly<Record<string, string>> = {
  mira_table: 'objects7/mira_table.png',
  awning: 'objects_bd20/awning.png',
  bench: 'objects12/bench.png',
  bench_small: 'objects7/bench.png',
  chair: 'objects_bd20/chair.png',
  mira_house: 'objects_bd20/mira_house.png',
  rain_barrel: 'objects12/rain_barrel.png',
  flower_pots: 'objects12/flower_pots.png',
  gao_shop: 'objects_bd20/gao_shop.png',
  gao_store: 'objects_bd20/gao_store.png',
  plant_chair: 'objects_bd20/plant_chair.png',
  stool: 'objects_bd20/stool.png',
  sack: 'objects12/sack.png',
  trough: 'objects12/trough.png',
  bucket: 'objects_bd20/bucket.png',
  gate_post: 'objects_bd20/gate_post.png',
  wall_low: 'objects_bd20/wall_low.png',
  wall_mended: 'objects_bd20/wall_mended.png',
  lamp: 'objects_t3/lamp.png',
  guard_hut: 'objects_bd20/guard_hut.png',
  laundry_line: 'objects12/laundry_line.png',
  shrine: 'objects_t3/shrine.png',
  basket: 'objects_bd20/basket.png',
  washboard: 'objects_bd20/washboard.png',
  mason_house: 'objects_bd20/mason_house.png',
  stone_blocks: 'objects13/stone_blocks.png',
  mason_bench: 'objects_bd20/mason_bench.png',
  rubble: '../../../public/art/topdown/props/rubble.png',
  side_gate: 'objects_bd20/side_gate.png',
  lean_to: 'objects13/lean_to.png',
  pella_house: 'objects_bd20/pella_house.png',
  handcart: 'objects12/handcart.png',
  quarry_row: 'objects_bd20/quarry_row.png',
  quarry_amri: 'objects_bd20/quarry_amri.png',
  pots: 'objects12/pots.png',
  quarry_long: 'objects_bd20/quarry_long.png',
  senn_annex: 'objects_bd20/senn_annex.png',
  firewood: 'objects12/firewood.png',
  hanru_house: 'objects_bd20/hanru_house.png',
  drying_rack: 'objects_rg02/drying_rack.png',
  tree_pine: 'objects_bd20/tree_pine.png',
  tree_broadleaf: 'objects_bd20/tree_broadleaf.png',
  bamboo: 'objects_bd20/bamboo.png',
  bush: 'objects12/bush.png',
};

/** Member id -> sprite key, and whether it is drawn mirrored. */
const ART: Readonly<Record<string, { sprite: string; flip?: boolean }>> = {
  'mira-table': { sprite: 'mira_table' },
  'awning-cloth': { sprite: 'awning' },
  'crew-bench': { sprite: 'bench' },
  'chair-west': { sprite: 'chair' },
  'chair-east': { sprite: 'chair', flip: true },
  'mira-house': { sprite: 'mira_house' },
  'mira-jar': { sprite: 'rain_barrel' },
  'mira-shrub': { sprite: 'flower_pots' },
  'gao-house': { sprite: 'gao_shop' },
  'gao-store': { sprite: 'gao_store' },
  'gao-plant': { sprite: 'plant_chair' },
  'gao-stool-a': { sprite: 'stool' },
  'gao-stool-b': { sprite: 'stool', flip: true },
  'gao-sacks': { sprite: 'sack' },
  trough: { sprite: 'trough' },
  'trough-bucket': { sprite: 'bucket' },
  'gate-post': { sprite: 'gate_post' },
  'gate-wall-a': { sprite: 'wall_low' },
  'gate-wall-mended': { sprite: 'wall_mended' },
  'gate-wall-b': { sprite: 'wall_low' },
  'gate-wall-south-a': { sprite: 'wall_low' },
  'gate-wall-south-b': { sprite: 'wall_low' },
  'gate-stool': { sprite: 'stool' },
  'lamp-post': { sprite: 'lamp' },
  'guard-hut': { sprite: 'guard_hut' },
  'washing-line': { sprite: 'laundry_line' },
  shrine: { sprite: 'shrine' },
  'wash-basket': { sprite: 'basket' },
  'wash-board': { sprite: 'washboard' },
  'canal-lamp-west': { sprite: 'lamp' },
  'canal-lamp-middle': { sprite: 'lamp' },
  'canal-lamp-east': { sprite: 'lamp' },
  'mason-house': { sprite: 'mason_house' },
  'mason-block-a': { sprite: 'stone_blocks' },
  'mason-block-b': { sprite: 'stone_blocks', flip: true },
  'mason-block-c': { sprite: 'stone_blocks' },
  'mason-bench': { sprite: 'mason_bench' },
  'mason-offcuts': { sprite: 'rubble' },
  'side-gate': { sprite: 'side_gate' },
  'garden-lean-to': { sprite: 'lean_to' },
  'garden-basket': { sprite: 'basket' },
  'terrace-stool-large': { sprite: 'stool' },
  'terrace-stool-small': { sprite: 'stool', flip: true },
  'pella-house': { sprite: 'pella_house' },
  handcart: { sprite: 'handcart' },
  'leto-house': { sprite: 'quarry_row' },
  'leto-bench': { sprite: 'bench_small' },
  'amri-house': { sprite: 'quarry_amri' },
  'amri-pot': { sprite: 'pots' },
  'senn-house': { sprite: 'quarry_long' },
  'senn-annex': { sprite: 'senn_annex' },
  'senn-logs': { sprite: 'firewood' },
  'hanru-house': { sprite: 'hanru_house' },
  'hanru-rack': { sprite: 'drying_rack' },
};

/** The art file (relative to `prototypes/topdown/assets`) a plan member is drawn with, if it is drawn. */
export const memberArt = (id: string): string | undefined => {
  const art = ART[id];
  return art ? BA_DAN_SPRITES[art.sprite] : undefined;
};

/**
 * The rim's mix: pine, broadleaf, bamboo and the bush, weighted so the pines and the broadleaves carry the line and the
 * bush and the bamboo break it. The old oak and the red blossom tree are not used in Ba Dan (owner, 2026-11-18).
 */
const RIM_MIX: readonly string[] = [
  'tree_pine',
  'tree_broadleaf',
  'tree_pine',
  'bamboo',
  'tree_broadleaf',
  'bush',
  'tree_pine',
  'tree_broadleaf',
  'bamboo',
  'bush',
];

/** A stable hash of a cell, so the rim's rhythm is fixed and never a pattern. */
const hash = (x: number, y: number, k: number): number => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** The rim tree's sprite for a cell: from the mix by hash, and never the same as the one before it on its row. */
export function rimSprite(x: number, y: number, before: string | undefined): string {
  const i = Math.floor(hash(x, y, 7) * RIM_MIX.length);
  for (let n = 0; n < RIM_MIX.length; n++) {
    const s = RIM_MIX[(i + n) % RIM_MIX.length] ?? 'bush';
    if (s !== before) return s;
  }
  return RIM_MIX[i] ?? 'bush';
}

const footprint = (cells: readonly Vec2[]): Vec2[] => cells.map((c) => ({ x: c.x, y: c.y }));

/** What `validateTopDownLayout` asks of a foot: no water or kerb under it, and a tree's roots on soil, not paving. */
function footOk(tree: boolean, cells: readonly Vec2[], cx: number, baseY: number): boolean {
  const xs = cells.map((c) => c.x);
  const y = baseY - 1;
  const bad = (x: number): boolean => {
    const at = BA_DAN_GROUND.classify(x, y);
    return at.ground !== 'ground' || at.kerb === true || (tree && at.terrain === 'C');
  };
  for (let x = Math.min(...xs) * CELL + 4; x <= (Math.max(...xs) + 1) * CELL - 4; x += 4)
    if (bad(x)) return false;
  return !tree || ![-4, -2, 0, 2, 4].some((dx) => bad(cx + dx));
}

/** The base row lifted, a pixel at a time, until the foot stands on plain ground (a lamp on a canal bank, a wall by its kerb). */
function liftedBase(
  tree: boolean,
  cells: readonly Vec2[],
  cx: number,
  baseY: number,
  reach: number,
): number | undefined {
  for (let up = 0; up <= reach; up++) if (footOk(tree, cells, cx, baseY - up)) return baseY - up;
  // a rim tree on the canal's end may instead stand a little lower, on the bank below
  if (tree)
    for (let down = 1; down <= 36; down++)
      if (footOk(tree, cells, cx, baseY + down)) return baseY + down;
  return undefined;
}

function object(
  id: string,
  sprite: string,
  m: PlanMember,
  cx: number,
  baseY: number,
  cells: readonly Vec2[],
  flip: boolean,
): TopDownObject | undefined {
  const tree = m.id.startsWith('rim-tree');
  const kind = m.kind === 'building' ? 'house' : tree ? 'tree' : 'prop';
  const x = Math.round(cx * CELL);
  const lifted = liftedBase(
    tree,
    cells,
    x,
    Math.round(baseY * CELL),
    m.id.includes('lamp') ? 60 : tree ? 44 : 12,
  );
  if (lifted === undefined) return undefined;
  const base = lifted;
  return {
    id,
    sprite,
    kind,
    x,
    base,
    footprint: footprint(cells),
    solid: m.solid,
    depth: { x: x / CELL, y: base / CELL },
    ...(m.kind === 'fades' && { fadeWhenOccluding: true }),
    ...(m.kind === 'building' && { revealOccluded: true }),
    ...(flip && { flip: true }),
  };
}

const pushIf = (out: TopDownObject[], o: TopDownObject | undefined): void => {
  if (o) out.push(o);
};

/** Every drawn member of the plan as an object, in the plan's order. A rim tree whose foot cannot stand on soil is not planted. */
export function baDanObjects(): TopDownObject[] {
  const out: TopDownObject[] = [];
  const members = BA_DAN_SET_PIECE_PLAN.pieces.flatMap((p) => p.members);
  const lastOnRow = new Map<number, string>();
  for (const m of members) {
    if (m.id.startsWith('rim-tree')) {
      const sprite = rimSprite(m.x, m.y, lastOnRow.get(m.y));
      lastOnRow.set(m.y, sprite);
      pushIf(out, object(m.id, sprite, m, m.x + 0.5, m.y + 1 - 4 / CELL, memberCells(m), false));
      continue;
    }
    const art = ART[m.id];
    if (!art) continue;
    const cells = memberCells(m);
    if (art.sprite === 'wall_low' && cells.length > 1) {
      // a wall run is one sprite a cell, except where another solid piece stands on the cell (the gate lamp)
      const taken = new Set(
        members
          .filter((o) => o.id !== m.id && o.solid && ART[o.id])
          .flatMap((o) => memberCells(o).map((c) => `${c.x},${c.y}`)),
      );
      cells
        .filter((c) => !taken.has(`${c.x},${c.y}`))
        .forEach((c, i) =>
          pushIf(out, object(`${m.id}-${i}`, art.sprite, m, c.x + 0.5, c.y + 1, [c], false)),
        );
      continue;
    }
    pushIf(out, object(m.id, art.sprite, m, m.x + m.w / 2, m.y + m.h, cells, art.flip === true));
  }
  return out;
}
