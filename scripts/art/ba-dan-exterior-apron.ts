/**
 * Paint the ground outside the Ba Dan board.
 *
 * The village's authored pieces cover the playable diamond; outside it the page
 * showed through, so the rim read as the edge of a board rather than the edge of
 * a village. This plate carries the terrain that borders the rim outward: the
 * outer garden's pixel-grain meadow (`ba-dan-garden.ts`), and where the
 * outermost logical cell is road or paving, the painted flagstone running on
 * off the map with grass creeping into it. Past a solid half-tile the whole
 * plate dissolves into the page in soft stepped bands.
 *
 * Nothing here touches a playable pixel — every sample inside the board stays
 * transparent, which `ba-dan-exterior-apron.test.ts` asserts.
 *
 * npx tsx scripts/art/ba-dan-exterior-apron.ts
 */
import {
  BA_DAN_APRON_BANDS,
  BA_DAN_APRON_MAP,
  BA_DAN_EXTERIOR_APRON,
  BA_DAN_FRAME,
  BA_DAN_FRAME_BANDS,
} from '../../src/content/scenes/baDan';
import {
  contactWear,
  flagstoneTexel,
  gardenTexel,
  GRAIN,
  grassTexel,
  rimBorder,
  texelTouchesBoard,
  transitionCluster,
  worldLogical,
} from './ba-dan-garden';
import { writeFileSync } from 'node:fs';
import { writeApronPlates } from './lib/apron-plates';
import { composeAtlas, packTight } from './lib/atlas';
import type { Item } from './lib/atlas';
import { newImage, setPixel } from './lib/image';
import { crop } from './lib/trim';
import { encodeWebp } from './lib/webp';
import { noise2 } from './ba-dan-village-light';
import { villageBake } from './ba-dan-village-material';
import type { Image } from './lib/image';

/** The bands are written here, one file per entry in `BA_DAN_APRON_BANDS`. */
export const DIRECTORY = 'public/art/maps/ba-dan-scene';
export const STEM = 'exterior-apron';
export const QUALITY = 90;
/** Terrain is fully faded out by this far outside the rim, in logical tiles. */
export const APRON_FADE = 2.2;
/**
 * A road exit's flagstone is whole at the rim and loses this share of its
 * texels to grass by `APRON_FADE`, in clusters: a road running on into the
 * country, not one that stops. It was 0.7 until the margin's bank became a
 * massed hedge: the old dark-brown soil lip also read as road to the test's
 * colour proxy, and the road now needs to be the gap in the hedge.
 */
export const EXIT_WEAR = 0.5;
/**
 * How far either side of the painted band the clear texels still carry the
 * neighbouring ground's colour, in tiles: past a lossy macroblock's width.
 */
export const RIM_BLEED = 0.4;
/** The projection's origin in local pixels, matching the scene's own pieces. */
const ORIGIN = 1024;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Local image pixels to logical map coordinates; the inverse of the projection. */
export function apronLogical(px: number, py: number): { x: number; y: number } {
  const dx = (BA_DAN_EXTERIOR_APRON.x + px + 0.5 - ORIGIN) / 64;
  const dy = (BA_DAN_EXTERIOR_APRON.y + py + 0.5) / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** The plate's pixel for a logical map point; the forward projection. */
export function apronPixel(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(ORIGIN + (x - y) * 64 - BA_DAN_EXTERIOR_APRON.x - 0.5),
    y: Math.round((x + y) * 32 - BA_DAN_EXTERIOR_APRON.y - 0.5),
  };
}

/** How far outside the board this point is, in logical tiles; 0 on the board. */
export function apronDepth(x: number, y: number): number {
  const { width, height } = BA_DAN_APRON_MAP;
  return Math.max(-x, x - width, -y, y - height);
}

/** The apron stays solid this far out, then runs on as ground to its bank. */
export const APRON_SOLID = 0.45;

/**
 * The bank edge's antialiasing: a few small alpha steps across the last
 * `APRON_BANK_SOFT` tiles, so the margin ends in a painted edge about four
 * pixels soft, not in a gradient into the page.
 */
export const APRON_ALPHA_STEPS = [255, 204, 153, 102, 51] as const;
export const APRON_BANK_SOFT = 0.07;

/**
 * Where the ground ends past the rim, in tiles: a wandering low bank between
 * these two depths, always inside `APRON_FADE`. Everything before it is solid
 * ground (lawn in shade, scrub, the road running on).
 */
export const APRON_BANK_MIN = 1.72;
export const APRON_BANK_MAX = 2.12;

/** How deep the ground runs at a logical point; the bank wanders along the rim. */
export function apronBank(x: number, y: number): number {
  const broad = transitionCluster(x * 0.7, y * 0.7, 91);
  const ragged = transitionCluster(x * 2.6, y * 2.6, 95);
  // The hedge's crowns: bumps a tenth of a tile across that give its outer
  // edge a painted, leafy silhouette instead of a wandering line.
  const crown = noise2(x * 9, y * 9, 277) * 0.65 + noise2(x * 21, y * 21, 279) * 0.35;
  // Zero-mean, so the bank is as deep on average as the wandering line it replaces.
  const reach = clamp(broad * 0.65 + ragged * 0.35 + (crown - 0.5) * 0.45, 0, 1);
  return APRON_BANK_MIN + (APRON_BANK_MAX - APRON_BANK_MIN) * reach;
}

/**
 * The alpha at a depth past the rim: 255 up to the bank, then the antialiasing
 * steps across `APRON_BANK_SOFT`, then nothing. Without a point the bank is at
 * its nearest.
 */
export function apronAlpha(depth: number, x?: number, y?: number): number {
  const bank = x === undefined || y === undefined ? APRON_BANK_MIN : apronBank(x, y);
  if (depth <= bank - APRON_BANK_SOFT) return APRON_ALPHA_STEPS[0];
  const k = clamp((depth - (bank - APRON_BANK_SOFT)) / APRON_BANK_SOFT, 0, 0.999);
  return depth >= bank ? 0 : (APRON_ALPHA_STEPS[1 + Math.floor(k * 4)] ?? 0);
}

/**
 * Finishing for the margin: lawn in deepening shade, dark scrub in small
 * clumps, and a massed hedge on the bank where the ground turns away. A function of the world
 * pixel and its depth, so it reads as terrain rather than as a fade.
 */
export function marginFinish(
  colour: readonly number[],
  wx: number,
  wy: number,
  depth: number,
  bank: number,
  road = false,
): [number, number, number] {
  if (depth < 0.35) return [colour[0] ?? 0, colour[1] ?? 0, colour[2] ?? 0];
  const gy = wy * 2;
  const into = clamp((depth - 0.35) / (bank - 0.35), 0, 1);
  let [r, g, b] = [colour[0] ?? 0, colour[1] ?? 0, colour[2] ?? 0];
  const shade = 1 - 0.3 * into * into;
  r *= shade;
  g *= shade * 1.01;
  b *= shade * 0.96;
  // Scrub: a few clumps three to eight pixels across, darker green with lit tips.
  const clump = noise2(wx / 7, gy / 7, 271) * 0.6 + noise2(wx / 2.6, gy / 2.6, 273) * 0.4;
  const k = smoothstep(0.58, 0.8, clump) * smoothstep(0.25, 0.6, into);
  if (k > 0) {
    const tip = noise2(wx / 1.6 + 7, gy / 1.6, 275) > 0.62;
    const target = tip ? [92, 112, 56] : [54, 72, 40];
    r = r * (1 - 0.8 * k) + target[0]! * 0.8 * k;
    g = g * (1 - 0.8 * k) + target[1]! * 0.8 * k;
    b = b * (1 - 0.8 * k) + target[2]! * 0.8 * k;
  }
  // The hedge: a dark massed line of planting on the bank, leaf clusters a few
  // pixels across with lit tips on their upper left, shaded between, and a
  // darker rim at the outer silhouette. It is toned to sit in front of the
  // margin colour behind it (`MAP_MARGIN_COLORS.verdant`), which then reads as
  // deep shade past the planting and not as a hole in the map.
  // A road running on out of the village leaves a gap in it.
  const hedge = smoothstep(bank - 0.78, bank - 0.5, depth) * (road ? 0 : 1);
  if (hedge > 0) {
    const leaf = noise2(wx / 4.2, gy / 4.2, 285) * 0.6 + noise2(wx / 1.9, gy / 1.9, 287) * 0.4;
    const lean =
      noise2(wx / 4.2 + 0.9, gy / 4.2 + 0.9, 285) * 0.6 +
      noise2(wx / 1.9 + 0.5, gy / 1.9 + 0.5, 287) * 0.4;
    const lit = smoothstep(0.0, 0.14, leaf - lean + 0.1) * smoothstep(0.36, 0.62, leaf);
    const base = [34, 50, 30];
    const tip = [92, 116, 56];
    const gap = [22, 32, 22];
    const crownShade = smoothstep(0.35, 0.65, leaf);
    const rim = smoothstep(bank - 0.12, bank - 0.01, depth);
    const tone = [0, 1, 2].map((c) => {
      let v = gap[c]! * (1 - crownShade) + base[c]! * crownShade;
      v = v * (1 - lit * 0.85) + tip[c]! * lit * 0.85;
      return v * (1 - 0.35 * rim);
    });
    r = r * (1 - 0.94 * hedge) + tone[0]! * 0.94 * hedge;
    g = g * (1 - 0.94 * hedge) + tone[1]! * 0.94 * hedge;
    b = b * (1 - 0.94 * hedge) + tone[2]! * 0.94 * hedge;
  }
  // Where a road runs on through the hedge, the bank turns away in a thin
  // dark-brown line of soil instead.
  if (road) {
    const lip = smoothstep(bank - 0.16, bank - 0.05, depth);
    r = r * (1 - 0.62 * lip) + 70 * 0.62 * lip;
    g = g * (1 - 0.62 * lip) + 52 * 0.62 * lip;
    b = b * (1 - 0.62 * lip) + 34 * 0.62 * lip;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

/**
 * Whether a texel of a road exit is still flagstone, or grass has crept over
 * it: grass breaks into the stone as clumps a few pixels across with single
 * blades at their edges, at the share `EXIT_WEAR` allows by this depth.
 */
function exitCarried(wx: number, wy: number, depth: number): boolean {
  const gy = wy * 2;
  const fine =
    noise2(wx / 8, gy / 8, 281) * 0.45 + noise2(wx / 3, gy / 3, 283) * 0.3 + hash2(wx, wy) * 0.25;
  return fine < 1 - EXIT_WEAR * clamp(depth / APRON_FADE, 0, 1) - 0.12;
}

function hash2(wx: number, wy: number): number {
  let h = Math.imul(Math.floor(wx), 0x27d4eb2d) ^ Math.imul(Math.floor(wy), 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// The south and east frame
// ---------------------------------------------------------------------------

/**
 * The two near edges do not end at the hedge. Past the apron the lawn runs on in deepening shade
 * into a woodland floor of leaf litter and ferns, and ends in an irregular tree line well out
 * (`FRAME_BANK_MIN`..`FRAME_BANK_MAX`), where `MAP_MARGIN_COLORS.verdant` takes over. The apron's
 * own plates carry this ground to `APRON_FADE`; `packFrame` carries it from `FRAME_START` on, in
 * the same colours, so the two overlap on identical ground and meet without a seam.
 *
 * The edge is "S/E-dominant": a point whose nearest board side is south or east. Everything else
 * keeps the apron's low bank, because a wall and tree backdrops stand on the north and west.
 */
export const FRAME_START = 1.9;
export const FRAME_BANK_MIN = 4.2;
export const FRAME_BANK_MAX = 6.2;
/** The two road exits' centre lines and half widths, in tiles: south river path and east road. */
const SOUTH_EXIT = { across: 19.5, half: 1.5 } as const;
const EAST_EXIT = { across: 8, half: 1 } as const;
/** A road leaving through the planting pushes the tree line this much further out. */
const EXIT_PUSH = 1.4;

export interface FarGround {
  /** Tiles outside the board on the nearer of the south and east sides. */
  readonly depth: number;
  /** Where the ground ends here, in the same tiles. */
  readonly bank: number;
  /** 0..1: how far inside a road exit's corridor, 1 on its centre line. */
  readonly road: number;
}

/** How far inside a road exit's corridor a point is, 0 outside it. */
function exitCorridor(x: number, y: number, depth: number): number {
  const jitter = (transitionCluster(x, y, 331) - 0.5) * 0.4;
  const narrow = Math.min(0.35, depth * 0.06);
  const south =
    y > BA_DAN_APRON_MAP.height - 0.3
      ? SOUTH_EXIT.half - narrow - Math.abs(x - SOUTH_EXIT.across) + jitter
      : -1;
  const east =
    x > BA_DAN_APRON_MAP.width - 0.3
      ? EAST_EXIT.half - narrow * 0.6 - Math.abs(y - EAST_EXIT.across) + jitter
      : -1;
  return clamp(Math.max(south, east) / 0.5, 0, 1);
}

/** The frame's ground at a logical point, or null where the apron's own bank applies. */
export function farGround(x: number, y: number): FarGround | null {
  const { width, height } = BA_DAN_APRON_MAP;
  const depth = Math.max(x - width, y - height);
  if (depth <= 0 || depth < Math.max(-x, -y)) return null;
  // The tree line wanders in broad lobes with leafy bumps, and comes in to the apron's bank where
  // the frame meets the north and west backdrops (it is gone by 1.9 tiles past either end).
  const broad = transitionCluster(x * 0.45, y * 0.45, 341);
  const lobes = transitionCluster(x * 1.3, y * 1.3, 343);
  const crown = noise2(x * 7, y * 7, 345) * 0.65 + noise2(x * 17, y * 17, 347) * 0.35;
  // Value noise hugs 0.5; stretch it so the line really does wander, a tile and more.
  // The line's swell runs with the screen's own horizontal, `x - y`, which is the same number on
  // both arms and so has no seam at the corner; the two ends round off by their own distance.
  const bulge = 0.5 + 0.5 * Math.sin((x - y) * 0.45 + 0.4);
  const wander = clamp(
    (broad * 0.55 + lobes * 0.35 + (crown - 0.5) * 0.5 - 0.45) * 3.2 + 0.5,
    0,
    1,
  );
  const reach = clamp(bulge * 0.5 + wander * 0.5, 0, 1);
  // A rounded end, not a ruled line: it climbs steeply off the apron's bank and flattens out.
  const cap = Math.min(clamp((x + 1.9) / 3.4, 0, 1), clamp((y + 1.9) / 3.4, 0, 1));
  const taper =
    FRAME_START + (FRAME_BANK_MAX - FRAME_START) * Math.sqrt(cap) * (0.88 + 0.24 * crown);
  const road = exitCorridor(x, y, depth);
  const bank = Math.min(
    FRAME_BANK_MIN + (FRAME_BANK_MAX - FRAME_BANK_MIN) * reach + EXIT_PUSH * road,
    taper + EXIT_PUSH * road,
  );
  return { depth, bank, road };
}

/** Leaf-litter, fern and soil tones of the woodland floor, flat like the garden's. */
const LITTER = [
  [88, 78, 46],
  [74, 66, 40],
  [104, 88, 52],
] as const;
const FERN = [
  [62, 88, 44],
  [92, 120, 58],
] as const;
const SOIL = [
  [118, 94, 62],
  [96, 76, 50],
  [138, 112, 76],
] as const;

const mixTo = (
  rgb: readonly number[],
  target: readonly number[],
  k: number,
): [number, number, number] => [
  (rgb[0] ?? 0) * (1 - k) + (target[0] ?? 0) * k,
  (rgb[1] ?? 0) * (1 - k) + (target[1] ?? 0) * k,
  (rgb[2] ?? 0) * (1 - k) + (target[2] ?? 0) * k,
];

/** The margin colour the frame's last tiles shade toward, as the renderer fills past the ground. */
const MARGIN = [70, 91, 64] as const;

/**
 * The frame's colour at a texel, before the light is baked in: the lawn (or a road exit's
 * flagstone) in the apron's own colours up to `FRAME_START`, then deepening shade, leaf litter and
 * ferns in clusters, scrub, and the massed tree line of `marginFinish` on the bank. A road's
 * corridor keeps flagstone and then packed earth, with no planting over it, and shades to the
 * margin colour at its far end so the track goes on into the dark rather than stopping.
 */
export function frameColour(tx: number, ty: number, ground: FarGround): [number, number, number] {
  const wx = (tx + 0.5) * GRAIN;
  const wy = (ty + 0.5) * GRAIN;
  const { x, y } = worldLogical(wx, wy);
  const { depth, bank, road } = ground;
  const fine = (salt: number, scale: number): number =>
    noise2(wx / scale, (wy * 2) / scale, salt) * 0.6 +
    noise2(wx / (scale / 2.7), (wy * 2) / (scale / 2.7), salt + 2) * 0.4;
  const woods = smoothstep(1.7, bank - 0.9, depth);
  const paved = road > 0.05;
  // The road: flagstone with grass creeping over it, thinning to packed earth.
  const stone =
    paved &&
    (rimBorder(x, y, true).terrain !== 'grass' || depth > 2.2) &&
    hash2(wx, wy) * 0.25 + noise2(wx / 8, (wy * 2) / 8, 281) * 0.45 + fine(283, 3) * 0.3 <
      1 - 0.7 * smoothstep(1.4, 6.0, depth) - 0.12 + 0.1 * road;
  let colour: [number, number, number];
  if (stone) colour = [...flagstoneTexel(tx, ty)];
  else {
    colour = [...(contactWear(tx, ty) ?? grassTexel(tx, ty))];
    if (paved && depth > 3.4) {
      // Past the paving: packed earth with the lawn's green and litter coming back through it.
      const k = smoothstep(3.4, 5.4, depth) * road;
      colour = mixTo(colour, SOIL[Math.floor(fine(351, 4) * 2.99)] ?? SOIL[0], 0.85 * k);
    }
  }
  if (woods > 0 && !stone) {
    colour = mixTo(colour, [colour[0] * 0.78, colour[1] * 0.8, colour[2] * 0.74], woods * 0.6);
    const litter = smoothstep(0.5, 0.72, fine(353, 9)) * woods;
    if (litter > 0.2)
      colour = mixTo(colour, LITTER[Math.floor(fine(355, 3.4) * 2.99)] ?? LITTER[0], 0.75);
    const fern = smoothstep(0.66, 0.8, fine(357, 6)) * woods * (paved ? 0.3 : 1);
    if (fern > 0.25) {
      const lit = noise2(wx / 1.7 + 3, (wy * 2) / 1.7, 359) > 0.6;
      colour = mixTo(colour, FERN[lit ? 1 : 0] ?? FERN[0], 0.8);
    }
  }
  // The road's flagstone keeps its paving: no scrub or planting over it, only the wood's shade.
  const finished = stone
    ? (mixTo(
        colour,
        [colour[0] * 0.8, colour[1] * 0.82, colour[2] * 0.78],
        smoothstep(1.4, bank - 0.4, depth),
      ).map(Math.round) as [number, number, number])
    : marginFinish(colour, wx, wy, depth, bank, paved && road > 0.35);
  if (road > 0.05) {
    // The track's far end goes into the shade of the wood: toward the margin colour, no edge.
    const dark = smoothstep(bank - 1.5, bank - 0.1, depth) * Math.min(1, road * 1.3);
    return mixTo(finished, MARGIN, 0.85 * dark).map(Math.round) as [number, number, number];
  }
  return finished;
}

/** Alpha at a depth for a bank: opaque to the bank, the apron's antialiasing steps across it. */
function bankAlpha(depth: number, bank: number): number {
  if (depth <= bank - APRON_BANK_SOFT) return APRON_ALPHA_STEPS[0];
  const k = clamp((depth - (bank - APRON_BANK_SOFT)) / APRON_BANK_SOFT, 0, 0.999);
  return depth >= bank ? 0 : (APRON_ALPHA_STEPS[1 + Math.floor(k * 4)] ?? 0);
}

/** The frame plate's alpha: ramps in over `FRAME_START` (on identical ground), steps out at the bank. */
export function frameAlpha(ground: FarGround): number {
  const edge = bankAlpha(ground.depth, ground.bank);
  const inner = clamp((ground.depth - FRAME_START) / 0.2, 0, 1);
  return Math.round(edge * inner);
}

/**
 * The south and east frame as one plate in the world's own pixels (`BA_DAN_FRAME`): the ground
 * from `FRAME_START` out to each point's bank, nothing on the board, nothing past the bank but
 * the carried colour that keeps the lossy encoder from smearing black across the edge.
 */
export function packFrame(): Image {
  const image = newImage(BA_DAN_FRAME.width, BA_DAN_FRAME.height);
  const { x: ox, y: oy } = BA_DAN_FRAME;
  for (let py = 0; py < image.height; py++)
    for (let px = 0; px < image.width; px++) {
      const tx = ox + px;
      const ty = oy + py;
      const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
      const ground = farGround(x, y);
      if (
        !ground ||
        ground.depth < FRAME_START - RIM_BLEED ||
        ground.depth > ground.bank + RIM_BLEED
      )
        continue;
      if (texelTouchesBoard(tx, ty)) continue;
      const colour = frameColour(tx, ty, ground);
      setPixel(image, px, py, [
        ...villageBake((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN, colour),
        frameAlpha(ground),
      ]);
    }
  return image;
}

/**
 * The garden field (`ba-dan-garden.ts`) continued past the rim. Where the
 * outer cell is road or paving, the painted flagstone runs on and gives up
 * `EXIT_WEAR` of itself to grass in broad clusters; the whole plate then
 * dissolves into the page in ten wandering alpha bands. It meets the garden
 * base texel for texel at the rim because both read the same world lattice
 * and split the rim texels by `texelTouchesBoard`.
 */
export function packApron(): Image {
  const image = newImage(BA_DAN_EXTERIOR_APRON.width, BA_DAN_EXTERIOR_APRON.height);
  const { x: ox, y: oy } = BA_DAN_EXTERIOR_APRON;
  if (ox % GRAIN || oy % GRAIN) throw new Error('The apron must start on the texel lattice.');
  for (let ty = oy / GRAIN; ty < (oy + image.height) / GRAIN; ty++) {
    for (let tx = ox / GRAIN; tx < (ox + image.width) / GRAIN; tx++) {
      const { x, y } = worldLogical((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN);
      const depth = apronDepth(x, y);
      const paint = (colour: readonly number[], alpha: number): void => {
        for (let dy = 0; dy < GRAIN; dy++)
          for (let dx = 0; dx < GRAIN; dx++)
            setPixel(image, tx * GRAIN - ox + dx, ty * GRAIN - oy + dy, [
              ...villageBake((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN, colour),
              alpha,
            ]);
      };
      // The clear texels next to the painted ones still carry the colour of
      // the ground beside them: the lossy encoder smears a clear texel's black
      // across the edge, which drew a light line along the whole rim.
      const far = farGround(x, y);
      if (depth <= 0 || depth >= APRON_FADE) {
        if (depth > -RIM_BLEED && depth <= 0) paint(gardenTexel(tx, ty), 0);
        else if (depth < APRON_FADE + RIM_BLEED && depth > 0)
          paint(far ? frameColour(tx, ty, far) : grassTexel(tx, ty), 0);
        continue;
      }
      // A texel covers four screen pixels. At the diamond rim its centre can
      // lie outside while one of those pixel centres lies on playable ground;
      // the garden base paints that texel, so skip it here and the apron never
      // overpaints the board. At the outer edge, likewise, a texel with any
      // pixel past the fade stays clear, so no pixel lands beyond it.
      if (texelTouchesBoard(tx, ty)) {
        paint(gardenTexel(tx, ty), 0);
        continue;
      }
      const pastFade = [0.5, GRAIN - 0.5].some((dx) =>
        [0.5, GRAIN - 0.5].some((dy) => {
          const point = worldLogical(tx * GRAIN + dx, ty * GRAIN + dy);
          return apronDepth(point.x, point.y) >= APRON_FADE;
        }),
      );
      if (pastFade) {
        paint(far ? frameColour(tx, ty, far) : grassTexel(tx, ty), 0);
        continue;
      }
      // The south and east edges carry the frame's ground right through the apron's depth.
      if (far) {
        paint(frameColour(tx, ty, far), bankAlpha(far.depth, far.bank));
        continue;
      }
      const { terrain } = rimBorder(x, y, true);
      const carried =
        terrain !== 'grass' && exitCarried((tx + 0.5) * GRAIN, (ty + 0.5) * GRAIN, depth);
      // A rim tree's roots and litter run on past the rim with the grass.
      const colour = carried ? flagstoneTexel(tx, ty) : (contactWear(tx, ty) ?? grassTexel(tx, ty));
      paint(
        marginFinish(
          colour,
          (tx + 0.5) * GRAIN,
          (ty + 0.5) * GRAIN,
          depth,
          apronBank(x, y),
          carried,
        ),
        apronAlpha(depth, x, y),
      );
    }
  }
  return image;
}

/** The frame ships as bands of one page (`BA_DAN_FRAME_BANDS`), as many as the scene's ground has room for. */
export const FRAME_STEM = 'exterior-frame';
export const FRAME_ENTRIES = 6;
/** The page is at most 2048 wide, and a band leaves room for its gutter. */
const MAX_BAND_WIDTH = 2040;

export interface FrameBand {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function rowPainted(plate: Image, y: number): boolean {
  for (let x = 0; x < plate.width; x++)
    if ((plate.data[(y * plate.width + x) * 4 + 3] ?? 0) > 0) return true;
  return false;
}

/**
 * The fewest-pixels cut of the frame plate into at most `entries` rectangles: horizontal slices on a
 * 16-pixel grid, each one rectangle or two (split at its widest gap), so the page holds as little
 * clear as it can. Run by `--plan`; the scene carries the result as literals and
 * `apron-plates.test.ts` pins them to the plate.
 */
export function planFrameBands(
  plate: Image,
  entries: number,
  step = 16,
  maxHeight = 512,
): FrameBand[] {
  const { width, height } = plate;
  // cum[y * width + x]: painted pixels in column x of the rows above y.
  const cum = new Int32Array((height + 1) * width);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      cum[(y + 1) * width + x] =
        (cum[y * width + x] ?? 0) + ((plate.data[(y * width + x) * 4 + 3] ?? 0) > 0 ? 1 : 0);
  const options = (a: number, b: number): { rects: [number, number][]; area: number }[] => {
    const cols: number[] = [];
    for (let x = 0; x < width; x++)
      if ((cum[b * width + x] ?? 0) - (cum[a * width + x] ?? 0) > 0) cols.push(x);
    if (!cols.length) return [{ rects: [], area: 0 }];
    const first = cols[0]!;
    const last = cols[cols.length - 1]!;
    const out = [
      { rects: [[first, last + 1]] as [number, number][], area: (last + 1 - first) * (b - a) },
    ];
    let gap = 0;
    let at = -1;
    for (let i = 1; i < cols.length; i++)
      if (cols[i]! - cols[i - 1]! > gap) {
        gap = cols[i]! - cols[i - 1]!;
        at = i;
      }
    if (gap > 64) {
      const rects: [number, number][] = [
        [first, cols[at - 1]! + 1],
        [cols[at]!, last + 1],
      ];
      out.push({ rects, area: rects.reduce((n, [s, e]) => n + (e - s) * (b - a), 0) });
    }
    // A rectangle wider than a page cannot be laid at all: cut the one that is in half.
    return out
      .filter((o) => o.rects.every(([s, e]) => e - s <= MAX_BAND_WIDTH))
      .concat(
        last + 1 - first > MAX_BAND_WIDTH
          ? [
              {
                rects: [
                  [first, first + Math.ceil((last + 1 - first) / 2)],
                  [first + Math.ceil((last + 1 - first) / 2), last + 1],
                ] as [number, number][],
                area: (last + 1 - first) * (b - a),
              },
            ]
          : [],
      );
  };
  let top = 0;
  while (top < height && !rowPainted(plate, top)) top++;
  let bottom = height;
  while (bottom > top && !rowPainted(plate, bottom - 1)) bottom--;
  const marks: number[] = [];
  for (let y = Math.floor(top / step) * step; y < bottom + step; y += step)
    marks.push(Math.min(y, height));
  interface Cell {
    area: number;
    from: number;
    rects: [number, number][];
  }
  const best: (Cell | null)[][] = marks.map(() => Array.from({ length: entries + 1 }, () => null));
  best[0]![0] = { area: 0, from: -1, rects: [] };
  for (let i = 0; i < marks.length; i++)
    for (let used = 0; used <= entries; used++) {
      const here = best[i]![used];
      if (!here) continue;
      for (let j = i + 1; j < marks.length && marks[j]! - marks[i]! <= maxHeight; j++)
        for (const option of options(marks[i]!, marks[j]!)) {
          const next = used + option.rects.length;
          if (next > entries) continue;
          const area = here.area + option.area;
          const cell = best[j]![next];
          if (!cell || area < cell.area)
            best[j]![next] = { area, from: i * 100 + used, rects: option.rects };
        }
    }
  const lastRow = marks.length - 1;
  let pick = 0;
  for (let used = 1; used <= entries; used++) {
    const cell = best[lastRow]![used];
    if (cell && (!best[lastRow]![pick] || cell.area < best[lastRow]![pick]!.area)) pick = used;
  }
  const bands: FrameBand[] = [];
  let j = lastRow;
  let used = pick;
  while (j > 0) {
    const cell = best[j]![used]!;
    const i = Math.floor(cell.from / 100);
    for (const [s, e] of cell.rects)
      bands.push({ x: s, y: marks[i]!, width: e - s, height: marks[j]! - marks[i]! });
    used = cell.from % 100;
    j = i;
  }
  return bands.reverse();
}

/** The bands' crops of the plate, in the scene's order, laid on the smallest page they fit. */
export function frameAtlasItems(plate: Image, bands: readonly FrameBand[]): Item[] {
  return bands.map((band, i) => ({ name: `band-${i}`, image: crop(plate, band) }));
}

export function layoutFrame(items: readonly Item[]) {
  return packTight(items);
}

export async function packFrameAtlas(
  plate: Image,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const items = frameAtlasItems(plate, BA_DAN_FRAME_BANDS);
  const { placed, width, height } = layoutFrame(items);
  return {
    bytes: await encodeWebp(composeAtlas(items, placed, width, height), QUALITY, true),
    width,
    height,
  };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/art/ba-dan-exterior-apron.ts')) {
  if (process.argv.includes('--plan')) {
    const plate = packFrame();
    const bands = planFrameBands(plate, FRAME_ENTRIES);
    const items = frameAtlasItems(plate, bands);
    const { placed, width, height } = layoutFrame(items);
    console.log(`// page ${width}x${height}`);
    console.log(
      bands
        .map((b, i) => {
          const at = placed.find((q) => q.name === `band-${i}`)!;
          return `  { x: ${b.x}, y: ${b.y}, width: ${b.width}, height: ${b.height}, atlas: { x: ${at.x}, y: ${at.y} } },`;
        })
        .join('\n'),
    );
  } else {
    await writeApronPlates({
      ring: packApron(),
      bands: BA_DAN_APRON_BANDS,
      directory: DIRECTORY,
      stem: STEM,
      quality: QUALITY,
    });
    const { bytes } = await packFrameAtlas(packFrame());
    writeFileSync(`${DIRECTORY}/${FRAME_STEM}.webp`, bytes);
  }
}
