/**
 * The village's rim trees as individual trees, and the clumps they are drawn as.
 *
 * Every tree is a native master (`art/source/ba-dan-restyle/fine/`, drawn unscaled) at a tile of
 * the rim, mirrored so no two neighbours repeat. The scene used to carry one entry per tree (49);
 * a scene may carry 80, so the trees that nobody can walk behind are composited at pack time into
 * clump sprites, pixel for pixel what the singles drew, and the scene lists the clumps. The singles
 * stay here as the authority: `scripts/art/ba-dan-village-light.ts` casts every tree's shadow from
 * its own root, and `ba-dan-true-pieces.ts` composites the clumps from them.
 *
 * What makes a group legal is painter's order: for every tile a person can stand on whose
 * figure overlaps a member's pixels, and for every other piece of scenery that overlaps one, the
 * clump has to be drawn before/after it exactly as that member was. `orderConflicts` is that
 * check (the depth of a clump is one number, `depth.x + depth.y`, the sort key both backends use).
 */
import { BA_DAN_APRON_MAP, BA_DAN_COURT_TREES } from '../../src/content/scenes/baDan';
import type { SceneScenery } from '../../src/core/types';
import { newImage, readImage } from './lib/image';
import type { Image } from './lib/image';

/** Native trees, drawn unscaled: [name, width, height, trunk column]; roots on the last row. */
export const TREE_MASTERS = [
  ['sapling', 150, 165, 78],
  ['small', 260, 254, 132],
  ['medium', 320, 312, 172],
  ['large', 420, 410, 214],
] as const;

/** Saplings whose crowns hung over the east road stand out on the apron; their cells still count. */
const MOVED: Record<string, [number, number]> = { '23,9': [25, 12], '23,10': [24, 13] };

/** The full canopies the rim had before every trunk cell was drawn. */
export const RIM_CANOPIES = [
  { x: 0, y: 3, size: 360 },
  { x: 0, y: 6, size: 400 },
  { x: 0, y: 10, size: 420 },
  { x: 0, y: 13, size: 380 },
  { x: 3, y: 15, size: 400 },
  { x: 26, y: 16, size: 360 },
  { x: 27, y: 5, size: 400 },
  { x: 22, y: 1, size: 360 },
  { x: 19, y: 0, size: 380 },
] as const;

/** Every other `T` on the rim: [x, y, requested crown width]. */
export const RIM_TRUNKS = [
  [0, 0, 300],
  [1, 0, 260],
  [2, 0, 320],
  [3, 0, 280],
  [18, 0, 300],
  [20, 0, 280],
  [21, 0, 260],
  [22, 0, 300],
  [23, 0, 280],
  [0, 1, 280],
  [1, 1, 320],
  [23, 1, 250],
  [0, 2, 260],
  [0, 4, 280],
  [0, 5, 320],
  [0, 9, 300],
  [0, 11, 280],
  [0, 12, 320],
  [23, 2, 170],
  [23, 3, 260],
  [23, 4, 170],
  [23, 5, 150],
  [23, 6, 160],
  [23, 9, 150],
  [23, 10, 260],
  [23, 11, 170],
  [23, 12, 150],
  [23, 13, 150],
  [0, 14, 280],
  [1, 14, 320],
  [22, 14, 260],
  [23, 14, 260],
  [0, 15, 260],
  [1, 15, 170],
  [2, 15, 260],
  [21, 15, 150],
  [22, 15, 160],
  [23, 15, 150],
] as const;

/**
 * The south and east frame's trees, outside the board on the frame ground
 * (`ba-dan-exterior-apron.ts`, `farGround`): [root x, root y, master, mirrored]. They are the near
 * edges' foreground, so each stands where its crown clears every ground diamond and figure a person
 * can walk on and every road exit's corridor (`ba-dan-true-pipeline.test.ts` holds that), and they
 * are composited into clumps like the rim's. Roots are on the half tile.
 */
export const FRAME_TREES = [
  [-1, 17.5, 'medium', 1],
  [0, 18.5, 'large', 1],
  [1.5, 20, 'sapling', 0],
  [3.5, 19.5, 'small', 0],
  [2.5, 20, 'medium', 1],
  [4, 20, 'sapling', 1],
  [6.5, 19, 'sapling', 0],
  [8, 20.5, 'small', 0],
  [10, 19.5, 'small', 1],
  [12, 20, 'sapling', 0],
  [14.5, 20.5, 'medium', 0],
  [16.5, 19.5, 'sapling', 1],
  [25.5, -1, 'sapling', 0],
  [26.5, 0, 'small', 0],
  [27.5, 1.5, 'medium', 0],
  [26.5, 4, 'small', 0],
  [27.5, 3, 'large', 1],
  [28, 5.5, 'small', 0],
  [27.5, 11, 'sapling', 0],
  [27, 12.5, 'sapling', 1],
  [27, 14.5, 'sapling', 1],
  [28, 13.5, 'medium', 1],
  [27.5, 16, 'small', 1],
  [28, 17.5, 'small', 0],
  [26.5, 20, 'medium', 0],
  [27.5, 19, 'small', 0],
] as const;

export interface TreeSpec {
  readonly id: string;
  /** Master name: `sapling`, `small`, `medium` or `large`. */
  readonly master: (typeof TREE_MASTERS)[number][0];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly flip: boolean;
  readonly depth: { readonly x: number; readonly y: number };
  readonly cell: { readonly x: number; readonly y: number };
  readonly exterior: boolean;
}

function tree(
  x: number,
  y: number,
  size: number,
  flip: boolean,
  [ax, ay]: [number, number],
): TreeSpec {
  const [master, width, height, trunk] = TREE_MASTERS.reduce((a, t) =>
    Math.abs(t[1] - size) < Math.abs(a[1] - size) ? t : a,
  );
  return {
    id: `tree-${x}-${y}`,
    master,
    x: 1024 + (ax - ay) * 64 - (flip ? width - trunk : trunk),
    y: (ax + ay + 1) * 32 + Math.round(width / 28) - height + 1,
    width,
    height,
    flip,
    depth: { x: ax, y: ay },
    cell: { x, y },
    exterior: ax < 0 || ay < 0 || ax >= BA_DAN_APRON_MAP.width || ay >= BA_DAN_APRON_MAP.height,
  };
}

/** Every tree of the village, in scene order. Every tree takes the flip that repeats none beside it. */
export function treeSpecs(): TreeSpec[] {
  const out: TreeSpec[] = [];
  const specs = [
    ...BA_DAN_COURT_TREES.map(({ x, y }) => [x, y, 320, 0] as const),
    ...RIM_CANOPIES.map(({ x, y, size }) => [x, y, size, 0] as const),
    ...RIM_TRUNKS.map(
      ([x, y, size]) => [x, y, size, (x + y + (MOVED[`${x},${y}`] ? 1 : 0)) % 2] as const,
    ),
  ];
  for (const [x, y, size, odd] of specs) {
    const at = MOVED[`${x},${y}`] ?? ([x, y] as [number, number]);
    const [a, b] = [false, true].map((f) => tree(x, y, size, f, at));
    const pick = odd ? [b!, a!] : [a!, b!];
    const twin = (t: TreeSpec) =>
      out.some(
        (o) =>
          o.master === t.master &&
          o.flip === t.flip &&
          Math.abs(o.depth.x - t.depth.x) < 2 &&
          Math.abs(o.depth.y - t.depth.y) < 2,
      );
    out.push(pick.find((t) => !twin(t)) ?? pick[0]!);
  }
  for (const [ax, ay, master, flip] of FRAME_TREES) {
    const size = TREE_MASTERS.find((t) => t[0] === master)![1];
    out.push({
      ...tree(Math.floor(ax), Math.floor(ay), size, flip === 1, [ax, ay]),
      id: `tree-f${ax}_${ay}`,
    });
  }
  return out;
}

/** The painter's-order key of a point: both backends sort upright scenery by projected `x + y`. */
export const depthKey = (d: { readonly x: number; readonly y: number }): number => d.x + d.y;

/** A pixel mask in world coordinates: where a piece of scenery or a standing figure has paint. */
export interface Mask {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

/** Whether two masks share at least `min` painted pixels (a figure grazing a leaf is not an overlap). */
export const overlaps = (a: Mask, b: Mask, min = MIN_OVERLAP): boolean => {
  const x0 = Math.max(a.x, b.x);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y0 = Math.max(a.y, b.y);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++)
      if (
        (a.alpha[(y - a.y) * a.width + (x - a.x)] ?? 0) > 64 &&
        (b.alpha[(y - b.y) * b.width + (x - b.x)] ?? 0) > 64 &&
        ++n >= min
      )
        return true;
  return false;
};
/** Painted pixels two pieces must share before their draw order is visible. */
export const MIN_OVERLAP = 40;

/** A figure standing on tile (tx, ty): feet on the tile's centre, 40 wide, 84 tall. */
export function figureMask(tx: number, ty: number): Mask {
  const width = 40;
  const height = 84;
  return {
    x: 1024 + (tx - ty) * 64 - width / 2,
    y: (tx + ty + 1) * 32 - height,
    width,
    height,
    alpha: new Uint8Array(width * height).fill(255),
  };
}
/** The depth key of a figure on a tile (`footprintFoot`: the tile's centre). */
export const figureKey = (tx: number, ty: number): number => tx + ty + 1;

export interface Member {
  readonly id: string;
  readonly key: number;
  readonly mask: Mask;
}
export interface Other {
  readonly id: string;
  readonly key: number;
  readonly mask: Mask;
}

/**
 * The interval of clump depth keys under which every overlap keeps the order it has today, or
 * null when none exists. A figure stands in front of a piece when its key is >= the piece's, a
 * piece of scenery draws after another when its key is greater (equal keys are refused: they
 * fall to array order).
 */
export function depthWindow(
  members: readonly Member[],
  figures: readonly { tx: number; ty: number; key: number; mask: Mask }[],
  others: readonly Other[],
): { lo: number; hi: number; why: string[] } | null {
  let lo = -Infinity; // D must be > lo
  let hi = Infinity; // D must be <= hi
  const why: string[] = [];
  for (const m of members) {
    for (const f of figures) {
      if (!overlaps(m.mask, f.mask)) continue;
      if (f.key >= m.key) {
        if (f.key < hi) {
          hi = f.key;
          why.push(`figure ${f.tx},${f.ty} in front of ${m.id}`);
        }
      } else if (f.key > lo) {
        lo = f.key;
        why.push(`figure ${f.tx},${f.ty} behind ${m.id}`);
      }
    }
    for (const o of others) {
      if (!overlaps(m.mask, o.mask)) continue;
      if (o.key === m.key) return null;
      if (o.key > m.key) {
        // o draws after the member: D < o.key, i.e. D <= o.key - 1 (keys are integers or halves)
        if (o.key - 0.25 < hi) {
          hi = o.key - 0.25;
          why.push(`${o.id} draws after ${m.id}`);
        }
      } else if (o.key > lo) {
        lo = o.key;
        why.push(`${o.id} draws before ${m.id}`);
      }
    }
  }
  return lo < hi ? { lo, hi, why } : null;
}

export type { SceneScenery };

/**
 * The trees drawn together: members by id, and the depth key the clump is sorted at. Chosen so
 * that `depthWindow` over the final scene (the tile map, every walkable tile) admits the depth;
 * `ba-dan-true-pipeline.test.ts` repeats that check. Trees not listed here stay single, and so do
 * the court trees and the two exterior canopies.
 */
export const CLUMPS: readonly { readonly members: readonly string[]; readonly key: number }[] = [
  { members: ['0-0', '0-1', '1-0', '1-1', '2-0', '3-0'].map((c) => `tree-${c}`), key: 2 },
  { members: ['0-2', '0-3', '0-4', '0-5'].map((c) => `tree-${c}`), key: 4 },
  { members: ['0-11', '0-12', '0-13', '0-14', '0-15', '1-15'].map((c) => `tree-${c}`), key: 13 },
  {
    members: ['20-0', '21-0', '22-0', '22-1', '23-0', '23-1', '23-2'].map((c) => `tree-${c}`),
    key: 23,
  },
  { members: ['23-4', '23-5'].map((c) => `tree-${c}`), key: 28 },
  { members: ['23-6', '23-9', '23-10'].map((c) => `tree-${c}`), key: 36 },
  { members: ['23-12', '23-13'].map((c) => `tree-${c}`), key: 36 },
  { members: ['23-14', '23-15'].map((c) => `tree-${c}`), key: 37 },
  // The frame's trees (`FRAME_TREES`), each group the pixels of its members at one depth.
  { members: ['f-1_17.5', 'f0_18.5', 'f1.5_20'].map((c) => `tree-${c}`), key: 22 },
  { members: ['f3.5_19.5', 'f2.5_20', 'f4_20'].map((c) => `tree-${c}`), key: 25 },
  { members: ['f6.5_19', 'f8_20.5', 'f10_19.5'].map((c) => `tree-${c}`), key: 30 },
  { members: ['f12_20', 'f14.5_20.5', 'f16.5_19.5'].map((c) => `tree-${c}`), key: 37 },
  { members: ['f25.5_-1', 'f26.5_0', 'f27.5_1.5'].map((c) => `tree-${c}`), key: 29 },
  { members: ['f26.5_4', 'f27.5_3', 'f28_5.5'].map((c) => `tree-${c}`), key: 33 },
  {
    members: ['f27.5_11', 'f27_12.5', 'f27_14.5', 'f28_13.5', 'f27.5_16'].map((c) => `tree-${c}`),
    key: 44,
  },
  { members: ['f28_17.5', 'f27.5_19', 'f26.5_20'].map((c) => `tree-${c}`), key: 47 },
];

/** Largest enclosed gap, in pixels, `closeGaps` fills. */
export const MAX_GAP = 160;

/**
 * Fill the small gaps a canopy has inside itself: transparent regions that do not reach the
 * sprite's edge and hold at most `MAX_GAP` pixels. Seen through, one shows whatever stands behind
 * the tree, and behind the north-west trees that is the cream of the wall: a short white streak in
 * the middle of the leaves. A gap is filled from its own rim inward with the leaves around it, in
 * shade, since it is the dark between the leaves. Binary alpha stays binary.
 */
export function closeGaps(image: Image, maxArea = MAX_GAP): Image {
  const { width, height } = image;
  const seen = new Uint8Array(width * height);
  const out: Image = { width, height, data: Uint8Array.from(image.data) };
  const clear = (i: number): boolean => (image.data[i * 4 + 3] ?? 0) === 0;
  for (let start = 0; start < width * height; start++) {
    if (seen[start] || !clear(start)) continue;
    const region: number[] = [start];
    seen[start] = 1;
    let edge = false;
    for (let k = 0; k < region.length; k++) {
      const i = region[k]!;
      const x = i % width;
      const y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (seen[j] || !clear(j)) continue;
        seen[j] = 1;
        region.push(j);
      }
    }
    if (edge || region.length > maxArea) continue;
    // Fill outside-in: each ring of the gap takes the mean of the painted pixels beside it.
    let todo = new Set(region);
    while (todo.size) {
      const next = new Map<number, [number, number, number]>();
      for (const i of todo) {
        const x = i % width;
        const y = (i - x) / width;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const j = (ny * width + nx) * 4;
            if ((out.data[j + 3] ?? 0) === 0) continue;
            r += out.data[j] ?? 0;
            g += out.data[j + 1] ?? 0;
            b += out.data[j + 2] ?? 0;
            n++;
          }
        if (n) next.set(i, [(r / n) * 0.62, (g / n) * 0.62, (b / n) * 0.62]);
      }
      if (!next.size) break;
      for (const [i, [r, g, b]] of next) {
        out.data.set([Math.round(r), Math.round(g), Math.round(b), 255], i * 4);
        todo.delete(i);
      }
      todo = new Set(todo);
    }
  }
  return out;
}

/** A tree master at its drawn size and mirroring: what one single draws. */
export function treeImage(spec: TreeSpec): Image {
  const m = readImage(`art/source/ba-dan-restyle/fine/${spec.master}-village-tree.png`);
  const out = newImage(spec.width, spec.height);
  for (let y = 0; y < spec.height; y++)
    for (let x = 0; x < spec.width; x++) {
      const sx = spec.flip ? spec.width - 1 - x : x;
      out.data.set(
        m.data.subarray((y * m.width + sx) * 4, (y * m.width + sx) * 4 + 4),
        (y * spec.width + x) * 4,
      );
    }
  return out;
}

export interface Clump {
  readonly members: readonly TreeSpec[];
  readonly key: number;
  /** World position and size of the composite (the members' pixel bounds). */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly image: Image;
}

/** The clumps as sprites: the members' pixels painted in scene (depth) order, nothing scaled or moved. */
export function composeClumps(): Clump[] {
  const specs = treeSpecs();
  return CLUMPS.map(({ members, key }) => {
    const ms = members.map((id) => {
      const s = specs.find((t) => t.id === id);
      if (!s) throw new Error(`clump member ${id} is not a tree`);
      return s;
    });
    const x0 = Math.min(...ms.map((m) => m.x));
    const y0 = Math.min(...ms.map((m) => m.y));
    const x1 = Math.max(...ms.map((m) => m.x + m.width));
    const y1 = Math.max(...ms.map((m) => m.y + m.height));
    const image = newImage(x1 - x0, y1 - y0);
    const ordered = [...ms].sort(
      (a, b) => depthKey(a.depth) - depthKey(b.depth) || specs.indexOf(a) - specs.indexOf(b),
    );
    for (const m of ordered) {
      const t = treeImage(m);
      for (let y = 0; y < m.height; y++)
        for (let x = 0; x < m.width; x++) {
          const i = (y * m.width + x) * 4;
          if ((t.data[i + 3] ?? 0) === 0) continue; // masters carry binary alpha
          image.data.set(
            t.data.subarray(i, i + 4),
            ((m.y - y0 + y) * image.width + (m.x - x0 + x)) * 4,
          );
        }
    }
    return {
      members: ordered,
      key,
      x: x0,
      y: y0,
      width: image.width,
      height: image.height,
      image: closeGaps(image),
    };
  });
}
