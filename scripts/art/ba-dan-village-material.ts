/**
 * Shared world-space painted material for every Ba Dan ground plate.
 *
 * Grass and worn earth are both painted procedurally on the world-pixel lattice
 * (one sample per world pixel, a little under one screen pixel at default
 * zoom): a painted tonal ramp driven by drift over two to four tiles, soft
 * clumps a few pixels across, and sparse one-pixel flecks. Nothing is sampled
 * from a repeating atlas, so no tufts or motifs recur at a visible scale.
 *
 * Wear is a function of distance to what causes it (door thresholds, stall
 * fronts, path edges), not of the tile a pixel is in: it fades inside the tile
 * along an irregular reach and never ends on a tile boundary, so every plate
 * that calls `villageGroundRgb` agrees pixel for pixel.
 */
import { readFileSync } from 'node:fs';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import {
  BA_DAN_COURTYARD_GROUND,
  BA_DAN_COURTYARD_PROPS,
  BA_DAN_DRESSING_FOOTPRINTS,
  BA_DAN_SCENE,
} from '../../src/content/scenes/baDan';
import { pixelAt } from './lib/image';
import { decodeWebp } from './lib/webp';
import { footAt, litRgb } from './ba-dan-village-light';

/** The reference sheet the ramps were measured from; sampling is procedural. */
export const VILLAGE_MATERIAL_SOURCE = 'assets/source/ba-dan-ground-v1/material-sheet.png';
type Rgb = readonly [number, number, number];

/**
 * Quality of every shipped Ba Dan ground plate. The plates are lossy WebP with a
 * lossless alpha plane: at this setting the painted grain survives (mean error
 * about two levels) and ten plates fit in roughly a third of what lossless
 * needs. Every producer samples one world-pixel material, so two plates that
 * overlap differ only by that encoder noise, far below anything a feather shows.
 */
export const GROUND_WEBP_QUALITY = 90;

/** One source sample per world pixel: finer than a character source pixel at default zoom. */
export const GROUND_TEXEL = 1;

/** Integer hash to [0,1), good enough that no diagonal streaks survive. */
function hash3(x: number, y: number, salt: number): number {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, salt: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash3(x0, y0, salt) * (1 - sx) + hash3(x0 + 1, y0, salt) * sx;
  const bottom = hash3(x0, y0 + 1, salt) * (1 - sx) + hash3(x0 + 1, y0 + 1, salt) * sx;
  return top * (1 - sy) + bottom * sy;
}

const smoothstep = (a: number, b: number, v: number): number => {
  if (b <= a) return v < a ? 0 : 1;
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function lattice(wx: number, wy: number): { wx: number; wy: number; x: number; y: number } {
  const qx = (Math.floor(wx / GROUND_TEXEL) + 0.5) * GROUND_TEXEL;
  const qy = (Math.floor(wy / GROUND_TEXEL) + 0.5) * GROUND_TEXEL;
  const dx = (qx - 1024) / 64;
  const dy = qy / 32;
  return { wx: qx, wy: qy, x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

/** Linear ramp through evenly spaced stops; `t` is clamped to 0..1. */
function ramp(stops: readonly Rgb[], t: number): [number, number, number] {
  const f = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const k = f - i;
  const a = stops[i] ?? stops[0] ?? [0, 0, 0];
  const b = stops[i + 1] ?? a;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

const GRASS_RAMP: readonly Rgb[] = [
  [114, 128, 70],
  [128, 142, 79],
  [139, 151, 85],
  [152, 162, 92],
  [164, 172, 100],
];
const EARTH_RAMP: readonly Rgb[] = [
  [126, 100, 70],
  [144, 118, 82],
  [160, 134, 96],
  [174, 148, 108],
  [186, 160, 120],
];

/**
 * Noise in ground-plane pixels: a tile is 64 world px across a diagonal and
 * 32 down, so vertical world pixels count double and a clump is as round on
 * the ground as it is wide.
 */
function tone(wx: number, wy: number, x: number, y: number, salt: number): number {
  const gy = wy * 2;
  const drift =
    valueNoise(x / 3.2, y / 3.2, salt) * 0.6 + valueNoise(x / 1.15, y / 1.15, salt + 1) * 0.4;
  const clump =
    valueNoise(wx / 10, gy / 10, salt + 2) * 0.5 + valueNoise(wx / 4.4, gy / 4.4, salt + 3) * 0.5;
  const micro = valueNoise(wx / 2.1, gy / 2.1, salt + 5);
  const grain = hash3(Math.floor(wx), Math.floor(wy), salt + 4);
  return (
    0.5 + (drift - 0.5) * 1.1 + (clump - 0.5) * 1.2 + (micro - 0.5) * 0.34 + (grain - 0.5) * 0.3
  );
}

function grassSample(wx: number, wy: number, x: number, y: number): Rgb {
  const t = tone(wx, wy, x, y, 11);
  const rgb = ramp(GRASS_RAMP, t);
  const px = Math.floor(wx);
  const py = Math.floor(wy);
  // Sparse blade strokes two pixels tall: a light tip over a softer base, and
  // a few dark gaps between blades.
  const tip = hash3(px, py, 31);
  const base = hash3(px, py - 1, 31);
  const stroke =
    (tip > 0.96 ? 10 : 0) + (base > 0.96 ? 5 : 0) - (tip < 0.045 ? 8 : 0) - (base < 0.045 ? 4 : 0);
  // A tiny accent now and then: a pale blossom or a deeper clover pixel.
  const accent = hash3(px, py, 37);
  const bloom = accent > 0.9988;
  const clover = accent < 0.0014;
  return [
    Math.round(rgb[0] + stroke * 0.9 + (bloom ? 30 : 0) + (clover ? -12 : 0)),
    Math.round(rgb[1] + stroke + (bloom ? 26 : 0) + (clover ? -10 : 0)),
    Math.round(rgb[2] + stroke * 0.45 + (bloom ? 14 : 0) + (clover ? -6 : 0)),
  ];
}

function earthSample(wx: number, wy: number, x: number, y: number): Rgb {
  const t = tone(wx, wy, x, y, 53) * 0.92 + 0.04;
  const rgb = ramp(EARTH_RAMP, t);
  const px = Math.floor(wx);
  const py = Math.floor(wy);
  const speck = hash3(px, py, 59);
  const fleck = speck > 0.975 ? 8 : speck < 0.05 ? -8 : 0;
  // Rare small pebbles, one or two pixels, a little greyer than the soil.
  const pebble = hash3(px >> 1, py >> 1, 61) > 0.9986;
  return [
    Math.round(rgb[0] + fleck + (pebble ? 14 : 0)),
    Math.round(rgb[1] + fleck + (pebble ? 14 : 0)),
    Math.round(rgb[2] + fleck + (pebble ? 12 : 0)),
  ];
}

const MAP_ROWS = BA_DAN_VILLAGE.rows;
/** The set dressing's cells are `l` like a stall's, but they stand on lawn and wear nothing like a stall front. */
const DRESSED = new Set(BA_DAN_DRESSING_FOOTPRINTS.map((c) => c.y * 1000 + c.x));
const dressed = (x: number, y: number): boolean => DRESSED.has(y * 1000 + x);
/** The cells under the market tables: open legs over the ground, so the ground is lawn (the sack stall's road side included). */
const TABLES = new Set(
  BA_DAN_COURTYARD_PROPS.filter((p) => p.image.startsWith('merchant-display')).flatMap((p) => [
    p.y * 1000 + p.x,
    p.y * 1000 + p.x + 1,
  ]),
);
const mapCell = (x: number, y: number): string => {
  if (y < 0 || x < 0) return 'T';
  return MAP_ROWS[y]?.[x] ?? ',';
};

/**
 * Whether a cell's ground is paving: the road cells, and the house cells under a plinth. A
 * stall's cell (`l`) takes the ground it was set down in: paving only where more of its open
 * neighbours are paving than lawn. Every plate that paints the ground asks this, so a market
 * table on the lawn stands on lawn and not on a tile-shaped flagstone mat.
 */
export function pavedCell(cx: number, cy: number): boolean {
  const key = mapCell(cx, cy);
  if (key === '=' || key === '.' || key === 'B') return true;
  if (key !== 'l' || dressed(cx, cy) || TABLES.has(cy * 1000 + cx)) return false;
  let paved = 0;
  let lawn = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const near = mapCell(cx + dx, cy + dy);
      if (near === '=' || near === '.') paved++;
      else if (near === ',' || near === 'T') lawn++;
    }
  return paved > lawn;
}

/**
 * Distance in tiles from a logical point to the nearest thing that stands on
 * the lawn: a house, a stall, a tree or the surround wall beyond the north and
 * west rim. Grass runs longer and darker along these, and under trees.
 */
function structureDistance(x: number, y: number): number {
  let best = 9;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  for (let cy = fy - 1; cy <= fy + 1; cy++)
    for (let cx = fx - 1; cx <= fx + 1; cx++) {
      const key = mapCell(cx, cy);
      if (key !== 'B' && key !== 'T' && key !== 'l') continue;
      const d = Math.hypot(Math.max(cx - x, 0, x - cx - 1), Math.max(cy - y, 0, y - cy - 1));
      if (d < best) best = d;
    }
  return best;
}

interface DesireLine {
  readonly ax: number;
  readonly ay: number;
  readonly bx: number;
  readonly by: number;
}

/**
 * Faint trodden desire lines, read from the map: from every door threshold and
 * stall front to the nearest few others and to the bridge and the road ends,
 * kept only where they actually cross open lawn and clear of any house.
 */
export const DESIRE_LINES: readonly DesireLine[] = (() => {
  const { width, height } = BA_DAN_VILLAGE;
  const nodes: { x: number; y: number }[] = [
    { x: 9.5, y: 6.5 },
    { x: 1.5, y: 7.5 },
    { x: width - 1.5, y: 7.5 },
  ];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const key = mapCell(x, y);
      const threshold =
        key === '=' &&
        [mapCell(x - 1, y), mapCell(x + 1, y), mapCell(x, y - 1), mapCell(x, y + 1)].includes('B');
      if ((key === 'l' && !dressed(x, y)) || threshold) nodes.push({ x: x + 0.5, y: y + 0.5 });
    }
  /** Length of the segment over grass; 0 if it touches anything solid. */
  const open = (ax: number, ay: number, bx: number, by: number): number => {
    let grass = 0;
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const x = ax + ((bx - ax) * i) / steps;
      const y = ay + ((by - ay) * i) / steps;
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      // A stall front's own cell is where the line begins or ends, not a block.
      const own =
        (cx === Math.floor(ax) && cy === Math.floor(ay)) ||
        (cx === Math.floor(bx) && cy === Math.floor(by));
      const key = mapCell(cx, cy);
      if (!own && (key === 'B' || key === 'T' || key === 'l' || key === '~' || key === 'W'))
        return 0;
      if (key === ',') grass += Math.hypot(bx - ax, by - ay) / steps;
    }
    return grass;
  };
  const lines: DesireLine[] = [];
  const seen = new Set<string>();
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => ({ b, j, d: Math.hypot(a.x - b.x, a.y - b.y) }))
      .filter(({ j, d }) => j !== i && d > 1.6 && d < 9)
      .sort((p, q) => p.d - q.d)
      .slice(0, 4);
    for (const { b, j } of near) {
      const id = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(id) || open(a.x, a.y, b.x, b.y) < 1.4) continue;
      seen.add(id);
      lines.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
  });
  return lines;
})();

/** How trodden the lawn is at a logical point by a desire line: 0 to 1, patchy. */
function desireWear(x: number, y: number, wx: number, wy: number): number {
  let best = 0;
  for (const l of DESIRE_LINES) {
    if (
      x < Math.min(l.ax, l.bx) - 0.5 ||
      x > Math.max(l.ax, l.bx) + 0.5 ||
      y < Math.min(l.ay, l.by) - 0.5 ||
      y > Math.max(l.ay, l.by) + 0.5
    )
      continue;
    const vx = l.bx - l.ax;
    const vy = l.by - l.ay;
    const len = Math.hypot(vx, vy);
    const t = Math.max(0, Math.min(1, ((x - l.ax) * vx + (y - l.ay) * vy) / (len * len)));
    // The track wanders: a slow sideways drift along it.
    const wander = (valueNoise(t * len * 0.9, l.ax + l.by, 221) - 0.5) * 0.22;
    const d = Math.hypot(
      x - (l.ax + vx * t) + (vy / len) * wander,
      y - (l.ay + vy * t) - (vx / len) * wander,
    );
    const width = 0.1 + 0.07 * valueNoise(t * 5, l.ay, 223);
    if (d >= width) continue;
    // Worn in stretches with gaps, thinning out at both ends.
    const stretch = smoothstep(0.42, 0.66, valueNoise(t * len * 1.7, l.ax * 3 + l.ay, 225));
    const ends = smoothstep(0, 0.12, t) * smoothstep(0, 0.12, 1 - t);
    best = Math.max(best, stretch * ends * (1 - smoothstep(0, width, d)));
  }
  if (best <= 0) return 0;
  const fine =
    valueNoise(wx / 3, (wy * 2) / 3, 227) * 0.5 + hash3(Math.floor(wx), Math.floor(wy), 229) * 0.5;
  return Math.min(1, best * (0.5 + fine * 0.9));
}

const FLOWERS: readonly Rgb[] = [
  [236, 232, 212],
  [228, 198, 88],
  [220, 172, 192],
  [240, 240, 230],
];

/**
 * Fine-grain life on open lawn: longer darker grass along structures and under
 * trees, sparse flowers and clover in loose drifts, faint desire lines. Every
 * term is a function of the world pixel (never of a tile), sparse and
 * irregular.
 */
function lawnLife(base: Rgb, wx: number, wy: number, x: number, y: number): Rgb {
  const px = Math.floor(wx);
  const py = Math.floor(wy);
  let [r, g, b] = base;
  // Longer, darker grass along walls and under trees.
  const near = structureDistance(x, y);
  if (near < 1) {
    const reach = 1 - smoothstep(0.04, 1, near);
    const lush = Math.min(1, reach * (0.45 + 0.75 * valueNoise(x * 2.1, y * 2.1, 231)));
    r *= 1 - 0.16 * lush;
    g *= 1 - 0.09 * lush;
    b *= 1 - 0.18 * lush;
    // Taller blades: a dark base with a lighter tip a pixel above.
    if (hash3(px, py, 233) < 0.1 * lush) {
      r -= 12;
      g -= 9;
      b -= 8;
    } else if (hash3(px, py + 1, 233) < 0.1 * lush) {
      r += 9;
      g += 11;
      b += 3;
    }
  }
  // Clover: drifts a dozen pixels across, darker and cooler with pale dots.
  const gy = wy * 2;
  const clover = valueNoise(wx / 17, gy / 17, 235) * 0.65 + valueNoise(wx / 6, gy / 6, 237) * 0.35;
  if (clover > 0.66) {
    const k = smoothstep(0.66, 0.78, clover);
    r -= 8 * k;
    g -= 3 * k;
    b += 3 * k;
    if (hash3(px, py, 239) < 0.16 * k) {
      r += 14;
      g += 14;
      b += 10;
    }
  }
  // Flowers: loose drifts on a jittered 56 px grid, a few single pixels each.
  const cx = Math.floor(wx / 56);
  const cy = Math.floor(gy / 56);
  for (let oy = -1; oy <= 1; oy++)
    for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox;
      const gz = cy + oy;
      if (hash3(gx, gz, 241) > 0.3) continue;
      const centreX = (gx + 0.15 + 0.7 * hash3(gx, gz, 243)) * 56;
      const centreY = ((gz + 0.15 + 0.7 * hash3(gx, gz, 245)) * 56) / 2;
      const dist = Math.hypot(wx - centreX, (wy - centreY) * 2);
      if (dist > 15) continue;
      if (hash3(px, py, 247) < 0.14 * (1 - dist / 15) ** 1.5) {
        const f = FLOWERS[Math.floor(hash3(gx, gz, 249) * FLOWERS.length) % FLOWERS.length];
        if (f) [r, g, b] = f;
      }
    }
  // Desire lines: pressed, paler, with a little earth showing.
  const wear = desireWear(x, y, wx, wy);
  if (wear > 0.08) {
    const k = Math.min(0.55, wear * 0.6);
    const e = earthSample(wx, wy, x, y);
    r = r * (1 - k) + e[0] * k;
    g = g * (1 - k) + e[1] * k;
    b = b * (1 - k) + e[2] * k;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

/** Painted grass with the lawn's own life; the base `villageGrassRgb` stays plain. */
export function villageLawnRgb(wx: number, wy: number): Rgb {
  const at = lattice(wx, wy);
  return lawnLife(grassSample(at.wx, at.wy, at.x, at.y), at.wx, at.wy, at.x, at.y);
}

/**
 * Where paving meets lawn the stone's lip is a soft dark brown of changing
 * weight, never the pale line the plates' feathered alpha used to leave, and
 * grass breaks irregularly over the edge in clumps of tufts up to a dozen
 * pixels deep. Only the two cell
 * kinds on either side matter, so every plate that bakes through
 * `villageBake` draws the same edge.
 */
export function pavingLip(wx: number, wy: number, rgb: readonly number[]): Rgb {
  const px = Math.floor(wx) + 0.5;
  const py = Math.floor(wy) + 0.5;
  const dx = (px - 1024) / 64;
  const dy = py / 32;
  const x = (dx + dy) / 2;
  const y = (dy - dx) / 2;
  // The ground under a piece of dressing is lawn: the road's lip runs on along its neighbour.
  const ground = (cx: number, cy: number): string => (dressed(cx, cy) ? ',' : mapCell(cx, cy));
  const here = ground(Math.floor(x), Math.floor(y));
  const paving = here === '=' || here === '.';
  const grass = here === ',' || here === 'T';
  if (!paving && !grass) return [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
  // Distance, in ground pixels, to the nearest cell of the other kind.
  let d = 9;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  for (let cy = fy - 1; cy <= fy + 1; cy++)
    for (let cx = fx - 1; cx <= fx + 1; cx++) {
      const key = ground(cx, cy);
      const other = paving ? key === ',' || key === 'T' : key === '=' || key === '.';
      if (!other) continue;
      d = Math.min(d, Math.hypot(Math.max(cx - x, 0, x - cx - 1), Math.max(cy - y, 0, y - cy - 1)));
    }
  const px90 = d * 90.5;
  if (px90 > 14) return [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
  const gy = py * 2;
  // Everything below varies along the edge, never with the tile: a long, slow
  // swell (twenty to forty pixels) for how heavy the lip is, a medium one for
  // how far grass has crept over the stone, and a fine one for single blades.
  const swell = valueNoise(px / 22, gy / 22, 257);
  const reachNoise =
    valueNoise(px / 8, gy / 8, 251) * 0.55 +
    valueNoise(px / 3, gy / 3, 253) * 0.3 +
    valueNoise(px / 14, gy / 14, 259) * 0.15;
  // The boundary itself wanders: where it swings toward the lawn the stone
  // pushes out in chips, where it swings toward the paving the grass does.
  const wander =
    (valueNoise(px / 9, gy / 9, 265) - 0.5) * 9 + (valueNoise(px / 3.5, gy / 3.5, 267) - 0.5) * 4;
  const blade = hash3(Math.floor(px), Math.floor(py), 255);
  if (paving) {
    // Grass over the lip: clumps of tufts that push out to a dozen pixels where
    // the lawn has crept, single blades at their edges, bare stone between.
    const reach = 11 * smoothstep(0.46, 0.8, reachNoise) + Math.max(0, -wander);
    if (px90 < reach * (0.35 + 0.65 * blade)) {
      const lawn = villageLawnRgb(px, py);
      const shade = 0.72 + 0.28 * smoothstep(0, 5, px90);
      return [
        Math.round(lawn[0] * shade),
        Math.round(lawn[1] * shade),
        Math.round(lawn[2] * shade),
      ];
    }
    // The stone's own lip, a soft dark brown whose weight and width change along
    // the edge: a hard shadowed line in one place, barely there in the next.
    const weight = 0.08 + 0.9 * smoothstep(0.25, 0.75, swell);
    const width = 1.6 + 3.6 * valueNoise(px / 11, gy / 11, 261);
    const k = weight * (1 - smoothstep(0.3, width, px90));
    const lip: Rgb = [92, 72, 50];
    return [
      Math.round((rgb[0] ?? 0) * (1 - k) + lip[0] * k),
      Math.round((rgb[1] ?? 0) * (1 - k) + lip[1] * k),
      Math.round((rgb[2] ?? 0) * (1 - k) + lip[2] * k),
    ];
  }
  // On the lawn side: chips of stone where the boundary swings out, each with
  // its own dark rim, then shade where the stone's edge stands as uneven as the lip.
  const chip = Math.max(0, wander) * (0.4 + 0.6 * blade);
  if (px90 < chip) {
    const grain = 0.94 + 0.12 * valueNoise(px / 1.8, gy / 1.8, 263);
    const rim = 1 - 0.34 * (1 - smoothstep(chip - 2.2, chip, px90));
    const stone: Rgb = [214, 192, 152];
    return [
      Math.round(stone[0] * grain * rim),
      Math.round(stone[1] * grain * rim),
      Math.round(stone[2] * grain * rim),
    ];
  }
  const k =
    (0.06 + 0.34 * smoothstep(0.25, 0.75, swell)) * (1 - smoothstep(0, 2 + 3 * swell, px90));
  return [
    Math.round((rgb[0] ?? 0) * (1 - k)),
    Math.round((rgb[1] ?? 0) * (1 - k)),
    Math.round((rgb[2] ?? 0) * (1 - k * 0.9)),
  ];
}

/**
 * The one finish every Ba Dan ground pixel goes through: edge, then light.
 * A pure function of the world pixel and its material colour.
 */
export function villageBake(wx: number, wy: number, rgb: readonly number[]): Rgb {
  return litRgb(wx, wy, pavingLip(wx, wy, footWear(wx, wy, rgb)), landingSeat(wx, wy));
}

/**
 * The ground's own wear at the foot of a true piece (`FEET`, the guide's exact foot
 * rectangles), all the way round it: on lawn a band a dozen pixels wide where the grass
 * grows darker and longer and, right at the stone, is worn to a little soil; on paving
 * or earth a faint line of dirt where the stone meets it. The baked contact shade
 * (`contactMultiplier`) goes over this in the light.
 */
const BARE_FOOT = /^(west-planter|north-garden)/;
export function footWear(wx: number, wy: number, rgb: readonly number[]): Rgb {
  const out: [number, number, number] = [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0];
  const { d, piece } = footAt(wx, wy);
  if (!(d > 0) || d > 16) return out;
  // The low planters share one painting between placements that stand on lawn, trodden earth and
  // paving, so it carries no grass fringe (`fringeFoot`); their ground gets a heavier soil band.
  const bare = BARE_FOOT.test(piece);
  const px = Math.floor(wx);
  const py = Math.floor(wy);
  const lawn = out[1] > out[0] + 4;
  if (lawn) {
    const lush = 1 - smoothstep(1, 12, d);
    out[0] *= 1 - 0.15 * lush;
    out[1] *= 1 - 0.08 * lush;
    out[2] *= 1 - 0.17 * lush;
    if (hash3(px, py, 271) < 0.12 * lush) {
      out[0] -= 12;
      out[1] -= 9;
      out[2] -= 8;
    } else if (hash3(px, py + 1, 271) < 0.12 * lush) {
      out[0] += 8;
      out[1] += 10;
      out[2] += 3;
    }
    // Worn to soil where the stone shades it, in broken patches.
    const patch = 0.55 + 0.9 * valueNoise(wx / 6, (wy * 2) / 6, 273);
    const wear = (bare ? 0.62 : 0.38) * (1 - smoothstep(0.4, bare ? 6 : 4, d)) * patch;
    const soil: Rgb = [112, 88, 60];
    for (let c = 0; c < 3; c++) out[c] = out[c]! * (1 - wear) + soil[c]! * wear;
  } else {
    const grime = 0.34 * (1 - smoothstep(0.3, 3.4, d)) + 0.07 * (1 - smoothstep(3, 9, d));
    const line = grime * (0.7 + 0.5 * hash3(px, py, 275));
    const dirt: Rgb = [108, 84, 56];
    for (let c = 0; c < 3; c++) out[c] = out[c]! * (1 - line) + dirt[c]! * line;
    // Moss and a few blades in the joint, in short broken runs along the foot.
    const run = valueNoise(wx / 7, (wy * 2) / 7, 277);
    if (d < 4.5 && run > 0.5 && hash3(px, py, 279) < 0.55 * smoothstep(0.5, 0.75, run)) {
      const moss: Rgb = [92, 102, 58];
      const k = 0.62 * (1 - smoothstep(1.5, 4.5, d));
      for (let c = 0; c < 3; c++) out[c] = out[c]! * (1 - k) + moss[c]! * k;
    }
  }
  return [Math.round(out[0]), Math.round(out[1]), Math.round(out[2])];
}

// ---------------------------------------------------------------------------
// Door landings and the trodden trails from them
// ---------------------------------------------------------------------------

interface Landing {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** How far a landing reaches out from the plinth, and how far it runs either side of the steps. */
const LANDING_DEPTH = 0.62;
const LANDING_HALF = 0.62;
/** The v3 steps are centred 0.85 tile in from the front corner's y (`pieces.py`: door bay d-1.25..d-0.45, stair margin). */
const STEPS_CENTRE = 0.85;

/**
 * Every v3 house's door faces +x and its three steps descend onto the tile in front of the
 * door, which was lawn: the stair ended in the air. Each gets a small worn flagstone
 * landing there, a slab either side of the steps and as deep as two flagstones, and a trodden
 * trail from it to the nearest path (`DOOR_TRAILS`).
 */
export const LANDINGS: readonly Landing[] = BA_DAN_SCENE.scenery
  .filter((piece) => piece.id.endsWith('-house'))
  .map((piece) => {
    const x1 = Math.max(...piece.footprint.map((c) => c.x)) + 1;
    const y1 = Math.max(...piece.footprint.map((c) => c.y)) + 1;
    return {
      x0: x1,
      x1: x1 + LANDING_DEPTH,
      y0: y1 - STEPS_CENTRE - LANDING_HALF,
      y1: y1 - STEPS_CENTRE + LANDING_HALF,
    };
  });

/**
 * From each landing round to the path the door's household walks: Gao's lane at (9,4) is a
 * corner away; the north house's runs along its front to the path at (12,4); the south-west
 * door's crosses the strip between the two houses to the terrace path at (13,11); the
 * south-east door's goes down to the river path's mouth at (18,15).
 */
export const DOOR_TRAILS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [10.25, 3.7],
    [9.9, 4.25],
  ],
  [
    [16.2, 3.78],
    [15.5, 4.4],
    [14.2, 4.55],
    [13.05, 4.5],
  ],
  [
    [10.4, 13.2],
    [11.4, 12.8],
    [12.5, 12.3],
    [13.02, 11.8],
  ],
  [
    [17.4, 13.4],
    [17.8, 14.3],
    [18.2, 14.95],
  ],
];

/** Signed distance in tiles to a landing's rounded rectangle; negative inside. */
function landingSd(l: Landing, x: number, y: number): number {
  const cx = (l.x0 + l.x1) / 2;
  const cy = (l.y0 + l.y1) / 2;
  const r = 0.09;
  const qx = Math.abs(x - cx) - (l.x1 - l.x0) / 2 + r;
  const qy = Math.abs(y - cy) - (l.y1 - l.y0) / 2 + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * The village's own paving, unlit: the courtyard plate's broad flagstone interior, which every
 * path samples through `pavingSwatchPoint`. A landing cuts its stones from the same swatch
 * at the same logical point, so its stone, light and grain are the paths' (`flagstoneTexel`
 * in `ba-dan-garden.ts` reads the same file).
 */
const PAVING = await decodeWebp(
  new Uint8Array(readFileSync('assets/source/ba-dan-ground-v1/courtyard-paving.webp')),
);
function pavingTexel(x: number, y: number): Rgb {
  const at = pavingSwatchPoint(x, y);
  const [r, g, b] = pixelAt(
    PAVING,
    Math.floor(1024 + (at.x - at.y) * 64 - BA_DAN_COURTYARD_GROUND.x),
    Math.floor((at.x + at.y) * 32 - BA_DAN_COURTYARD_GROUND.y),
  );
  return [r, g, b];
}

/** The landing's edge, in tiles, at a logical point: the rounded rectangle, wandering a few pixels. */
function landingEdge(l: Landing, wx: number, wy: number, x: number, y: number): number {
  // Chipped and uneven where the stone is oldest: a slow swell of a few pixels and single-pixel chips.
  const wobble =
    (valueNoise(wx / 9, (wy * 2) / 9, 281) - 0.5) * 0.08 +
    (valueNoise(wx / 3, (wy * 2) / 3, 291) - 0.5) * 0.03 +
    (hash3(Math.floor(wx), Math.floor(wy), 283) - 0.5) * 0.01;
  return landingSd(l, x, y) + wobble;
}

/** How fully a world pixel is on a landing, 0..1: the light treats it as a floor at the foot, not a wall's. */
export function landingSeat(wx: number, wy: number): number {
  const dx = (Math.floor(wx) + 0.5 - 1024) / 64;
  const dy = (Math.floor(wy) + 0.5) / 32;
  const x = (dx + dy) / 2;
  const y = (dy - dx) / 2;
  let best = 0;
  for (const l of LANDINGS) best = Math.max(best, 1 - smoothstep(-0.03, 0.04, landingSd(l, x, y)));
  return best;
}

/** The flagstone of a landing at a world pixel, or null outside its irregular edge. */
function landingStone(wx: number, wy: number, x: number, y: number): Rgb | null {
  for (const l of LANDINGS) {
    const sd = landingEdge(l, wx, wy, x, y);
    if (sd > 0) continue;
    const inside = -sd * 90.5;
    // Grass creeps over the edge in tufts: short blades at the rim, a few pushing a stone deep.
    const creep =
      valueNoise(wx / 6, (wy * 2) / 6, 293) * 0.7 +
      hash3(Math.floor(wx), Math.floor(wy), 295) * 0.3;
    if (inside < 7 && creep > 0.36 + 0.5 * smoothstep(0, 7, inside)) return null;
    const base = pavingTexel(x, y);
    // Each stone of the landing sits a shade apart from its neighbour, as laid stones do.
    const slab = hash3(Math.floor(x * 3.1 + l.y0 * 7), Math.floor(y * 2.3), 297);
    const lift = 0.95 + 0.12 * slab;
    const stone: Rgb = [base[0] * lift * 1.02, base[1] * lift, base[2] * lift * 0.96];
    // A worn lip: the stone darkens to a soft brown at its rim, never to grey.
    const k = 0.34 * (1 - smoothstep(0.4, 3.2, inside));
    const edge: Rgb = [100, 78, 52];
    const rgb = [0, 1, 2].map((c) => stone[c]! * (1 - k) + edge[c]! * k);
    // Moss where a joint runs: the swatch's darker pixels.
    const luma = 0.3 * stone[0] + 0.55 * stone[1] + 0.15 * stone[2];
    if (luma < 150 && hash3(Math.floor(wx / 2), Math.floor(wy / 2), 289) > 0.7) {
      rgb[0]! *= 0.86;
      rgb[1]! *= 0.97;
      rgb[2]! *= 0.78;
    }
    // A plate stores this colour straight into a byte before the light is applied: stay inside 0..255.
    return [0, 1, 2].map((c) => Math.max(0, Math.min(255, Math.round(rgb[c]!)))) as unknown as Rgb;
  }
  return null;
}

/** Each door trail's segments with their length and the distance along the line at their start. */
const TRAIL_SEGMENTS = DOOR_TRAILS.map((line) => {
  let along = 0;
  const segments: {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    vx: number;
    vy: number;
    len2: number;
    len: number;
    along: number;
  }[] = [];
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i] as readonly [number, number];
    const [bx, by] = line[i + 1] as readonly [number, number];
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const len = Math.sqrt(len2);
    segments.push({ ax, ay, bx, by, vx, vy, len2, len, along });
    along += len;
  }
  return segments;
});
/** A trail's half width is 0.125 plus at most 0.04 of noise: nothing farther than this is ever worn. */
const TRAIL_REACH = 0.125 + 0.04;

/** How trodden the ground is by a door's trail at a logical point: 0 to 1, a continuous worn line. */
function trailCoverage(x: number, y: number, wx: number, wy: number): number {
  let best = 0;
  for (const segments of TRAIL_SEGMENTS) {
    for (const { ax, ay, bx, by, vx, vy, len2, len, along } of segments) {
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
      const d = Math.hypot(x - ax - vx * t, y - ay - vy * t);
      if (d >= TRAIL_REACH) continue;
      const s = along + t * len;
      const half = 0.125 + 0.04 * valueNoise(s * 3.1, ax + by, 291);
      if (d < half) {
        // Worn through, with a thin patch now and then where the grass held.
        const hold = smoothstep(0.62, 0.8, valueNoise(s * 2.2, ay + bx, 293));
        const k = (1 - smoothstep(0.62 * half, half, d)) * (1 - 0.4 * hold);
        best = Math.max(best, k * 1.05);
      }
    }
  }
  if (best <= 0) return 0;
  const fine =
    valueNoise(wx / 3, (wy * 2) / 3, 295) * 0.5 + hash3(Math.floor(wx), Math.floor(wy), 297) * 0.5;
  return Math.min(1, best * (0.85 + fine * 0.35));
}

interface Cause {
  readonly x: number;
  readonly y: number;
  /** Door thresholds and stall fronts are trodden harder than a path's plain edge. */
  readonly weight: number;
  /** A stall's ground is worn in a soft pool round it, not out to the edge of its tile. */
  readonly stall?: boolean;
}

/**
 * What wears the ground, read from the map so a map edit moves the wear:
 * `=` paving (a threshold when a house cell touches it) and `l` stall fronts.
 */
const CAUSES: readonly Cause[] = (() => {
  const { rows, width, height } = BA_DAN_VILLAGE;
  const at = (x: number, y: number): string => rows[y]?.[x] ?? ',';
  const causes: Cause[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const key = at(x, y);
      if (key === 'l' && !dressed(x, y)) causes.push({ x, y, weight: 1.2, stall: true });
      else if (key === '=') {
        const threshold = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('B');
        causes.push({ x, y, weight: threshold ? 1.25 : 1 });
      }
    }
  return causes;
})();

/**
 * Where people stand at the set dressing, and so where the lawn is worn: [x, y, radius] in logical
 * tiles. Beside the well, on the west side where the household adult stands (`bd04.yard`, (11,13)),
 * before the notice board, under the washing line, and along the bench's front, where it looks over
 * the canal. A spot needs a person who stands there: the well's south side had none, and wore a
 * bare disc into open lawn.
 */
export const STAND_SPOTS: readonly (readonly [number, number, number])[] = [
  [11.5, 13.5, 0.3],
  [19.25, 6.5, 0.24],
  [17.6, 2.6, 0.26],
  [18.4, 2.6, 0.26],
  [3.5, 5.9, 0.26],
  [4.5, 5.9, 0.26],
];

const CAUSE_GRID = new Map<number, Cause>(CAUSES.map((cause) => [cause.y * 1000 + cause.x, cause]));

const CAUSE_WINDOWS = new Map<number, Cause[]>();
/** The causes in the 5 x 5 tiles around a tile, in the order a row-by-row scan meets them. */
function causesAround(tx: number, ty: number): Cause[] {
  const key = ty * 1000 + tx;
  let list = CAUSE_WINDOWS.get(key);
  if (!list) {
    list = [];
    for (let iy = ty - 2; iy <= ty + 2; iy++)
      for (let ix = tx - 2; ix <= tx + 2; ix++) {
        const cause = CAUSE_GRID.get(iy * 1000 + ix);
        if (cause) list.push(cause);
      }
    CAUSE_WINDOWS.set(key, list);
  }
  return list;
}

/** Soft earth wear at a logical point: 0 on open lawn, up to 1 at a path edge. */
export function troddenCoverage(x: number, y: number, wx: number, wy: number): number {
  let best = 0;
  // Reach and strength wander along an edge so wear forms broken patches with
  // gaps, never a uniform stripe: about two in five stretches carry no wear.
  const gy = wy * 2;
  const along = valueNoise(x * 1.1, y * 1.1, 201) * 0.7 + valueNoise(x * 3.4, y * 3.4, 203) * 0.3;
  const reach = 0.5 * smoothstep(0.34, 0.7, along);
  const strength = 0.6 + 0.4 * valueNoise(x * 1.7, y * 1.7, 205);
  for (const cause of causesAround(Math.floor(x), Math.floor(y))) {
    const ix = cause.x;
    const iy = cause.y;
    if (cause.stall) {
      // A pool of worn ground round the stall's centre: soft on every side, so its edge
      // is nowhere a tile's, and the lawn under a table keeps its grass.
      const pool = Math.hypot(x - ix - 0.5, y - iy - 0.5);
      best = Math.max(best, strength * 0.8 * (1 - smoothstep(0.35, 0.95, pool)));
      continue;
    }
    const dx = Math.max(Math.abs(x - ix - 0.5) - 0.5, 0);
    const dy = Math.max(Math.abs(y - iy - 0.5) - 0.5, 0);
    const d = Math.hypot(dx, dy);
    // Thresholds and stall fronts always carry a little wear.
    const r = Math.max(reach * cause.weight, cause.weight > 1 ? 0.09 : 0);
    if (d >= r) continue;
    best = Math.max(best, strength * (1 - smoothstep(0, r, d)));
  }
  for (const [sx, sy, r] of STAND_SPOTS)
    best = Math.max(
      best,
      strength * 0.95 * (1 - smoothstep(0.3 * r, r, Math.hypot(x - sx, y - sy))),
    );
  // Pixel-scale breakup so the boundary is a painted, feathered edge.
  const fine =
    valueNoise(wx / 5, gy / 5, 207) * 0.6 + hash3(Math.floor(wx), Math.floor(wy), 209) * 0.4;
  const worn = best <= 0 ? 0 : Math.max(0, Math.min(1, best * (0.55 + fine * 0.75)));
  return Math.max(worn, trailCoverage(x, y, wx, wy));
}

/** Whether a world pixel reads as earth rather than grass. */
export function troddenAt(x: number, y: number, wx: number, wy: number): boolean {
  return troddenCoverage(x, y, wx, wy) > 0.45;
}

/**
 * Where the repeating paving swatch is read, for any logical point: the
 * courtyard plate's broad flagstone interior, x5.5..10.5 and y7.07..8.93, tiled on
 * the logical grid. The plate's own x5..5.45 columns are its feathered
 * boundary, repainted as ground; tiling them put a stripe of lawn colour
 * across every road that repeated the swatch.
 */
export function pavingSwatchPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: 5.5 + (((x % 5) + 5) % 5),
    // The plate's first and last 0.07 tile (y7 and y9) hold a mossy kerb line.
    y: 7.07 + 0.93 * ((((Math.floor(y) % 2) + 2) % 2) + (y - Math.floor(y))),
  };
}

/** Painted grass or worn earth sampled on the global projected-world lattice. */
export function villageGroundRgb(wx: number, wy: number): Rgb {
  const at = lattice(wx, wy);
  const landing = landingStone(at.wx, at.wy, at.x, at.y);
  if (landing) return landing;
  const coverage = troddenCoverage(at.x, at.y, at.wx, at.wy);
  const grass = lawnLife(grassSample(at.wx, at.wy, at.x, at.y), at.wx, at.wy, at.x, at.y);
  if (coverage <= 0) return grass;
  const earth = earthSample(at.wx, at.wy, at.x, at.y);
  // A narrow soft threshold, not a straight mix: earth shows as patches and
  // grass blades push through its edge, a few pixels of feather at most.
  const edgeNoise =
    valueNoise(at.wx / 3.5, (at.wy * 2) / 3.5, 211) * 0.7 +
    hash3(Math.floor(at.wx), Math.floor(at.wy), 213) * 0.3;
  const weight = smoothstep(0.22, 0.5, coverage + (edgeNoise - 0.5) * 0.5);
  return grass.map((channel, index) =>
    Math.round(channel * (1 - weight) + (earth[index] ?? 0) * weight),
  ) as unknown as Rgb;
}

export function villageGrassRgb(wx: number, wy: number): Rgb {
  const at = lattice(wx, wy);
  return grassSample(at.wx, at.wy, at.x, at.y);
}

export function villageEarthRgb(wx: number, wy: number): Rgb {
  const at = lattice(wx, wy);
  return earthSample(at.wx, at.wy, at.x, at.y);
}
