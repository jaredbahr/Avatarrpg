/**
 * Ba Dan's painted water: the connected canal and west ford on the single
 * `edge-water.webp` page. `canal-banks.webp` is a retired plate and is not
 * rewritten here.
 *
 * The source is the 1:1 fieldstone repaint in `art/source/ba-dan-water/`: the
 * Forest Road pond's family (stone-edged, clear, shallows into a darker
 * channel, a few ripples, pads only in the ford). Packing derives the current
 * canal size and edge alpha from scene geometry before encoding, so a layout or
 * registration change cannot leave the painted RGB on a stale footprint.
 * The water is the picture's own: the scene declares it painted
 * (`paintedWaterCells`), so the renderer lays no film over it and none is
 * baked in.
 *
 * npx tsx scripts/art/ba-dan-water.ts
 */
import { writeFileSync } from 'node:fs';
import { BA_DAN_VILLAGE } from '../../src/content/maps/village';
import { BA_DAN_CANAL_BANKS, BA_DAN_EDGE_WATER } from '../../src/content/scenes/baDan';
import { packEdgePage } from './ba-dan-edges';
import { litRgb, noise2, worldToLogical } from './ba-dan-village-light';
import { villageLawnRgb } from './ba-dan-village-material';
import { newImage, pixelAt, readPng, setPixel } from './lib/image';
import type { Image } from './lib/image';
import { encodeWebp } from './lib/webp';

export const MASTER_DIRECTORY = 'art/source/ba-dan-water';
export const SHIPPED_DIRECTORY = 'public/art/maps/ba-dan-scene';
export const WATER_QUALITY = 82;
export const WATER_PLATES = ['edge-water'] as const;
export type WaterPlate = (typeof WATER_PLATES)[number];

export const masterPath = (plate: WaterPlate): string => `${MASTER_DIRECTORY}/${plate}.png`;
export const shippedPath = (plate: WaterPlate): string => `${SHIPPED_DIRECTORY}/${plate}.webp`;

export function readMaster(plate: WaterPlate): Image {
  const edge = readPng(masterPath(plate));
  // The upper field is the accepted continuous channel; the lower field is
  // the west ford. `packEdgePage` preserves the former's authored alpha and
  // derives the latter from current map/apron geometry. The tracked master
  // remains authoritative for every painted colour.
  const footprint = packEdgePage();
  const composed = newImage(footprint.width, footprint.height);
  for (let y = 0; y < footprint.height; y++)
    for (let x = 0; x < footprint.width; x++) {
      const alpha = pixelAt(footprint, x, y)[3] ?? 0;
      if (!alpha) continue;
      let painted: readonly number[] = pixelAt(edge, x, y);
      // The footprint's stair corners can cover a pixel the master never painted
      // (transparent black): those drew as a dotted black line along the ford's
      // edge. They take the colour of the nearest painted neighbour.
      if ((painted[3] ?? 0) === 0) {
        let near: readonly number[] | null = null;
        for (let r = 1; r <= 8 && !near; r++)
          for (let dy = -r; dy <= r && !near; dy++)
            for (let dx = -r; dx <= r && !near; dx++) {
              if (x + dx < 0 || y + dy < 0 || x + dx >= edge.width || y + dy >= edge.height)
                continue;
              const candidate = pixelAt(edge, x + dx, y + dy);
              if ((candidate[3] ?? 0) > 200) near = candidate;
            }
        // Past any painted neighbour the footprint can only be lawn.
        const world = pageToWorld(x, y);
        painted = near ?? [...villageLawnRgb(world.x, world.y), 255];
      }
      setPixel(composed, x, y, [painted[0] ?? 0, painted[1] ?? 0, painted[2] ?? 0, alpha]);
    }
  return finishWater(composed);
}

/** The page's upper field is the canal: 1016x508 stretched over the registered envelope. */
const CANAL_FIELD = { width: 1016, height: 508 } as const;
const BRANK_LIP: readonly [number, number, number] = [72, 54, 38];
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, y: number, salt: number): number => {
  let h =
    Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** World pixel of a page pixel: the canal envelope on the upper field, the ford below it. */
export function pageToWorld(px: number, py: number): { x: number; y: number } {
  if (py < CANAL_FIELD.height)
    return {
      x: BA_DAN_CANAL_BANKS.x + ((px + 0.5) * BA_DAN_CANAL_BANKS.width) / CANAL_FIELD.width,
      y: BA_DAN_CANAL_BANKS.y + ((py + 0.5) * BA_DAN_CANAL_BANKS.height) / CANAL_FIELD.height,
    };
  const ford = BA_DAN_EDGE_WATER[0];
  return { x: (ford?.x ?? 0) + px + 0.5, y: (ford?.y ?? 0) + (py - (ford?.source.y ?? 0)) + 0.5 };
}

const cellKindAt = (wx: number, wy: number): string => {
  const dx = (wx - 1024) / 64;
  const dy = wy / 32;
  return BA_DAN_VILLAGE.rows[Math.floor((dy - dx) / 2)]?.[Math.floor((dx + dy) / 2)] ?? ',';
};

/** Width of the south kerb and the end caps, in page pixels measured in from the edge. */
export const COPING_WIDTH = 12;
/** The master's north kerb east of the bridge is a wider band (about sixteen pixels). */
export const NORTH_KERB_WIDTH = 17;
const COPING_STONE: readonly [number, number, number] = [214, 197, 163];
const COPING_WET: readonly [number, number, number] = [128, 118, 100];
const COPING_JOINT: readonly [number, number, number] = [126, 110, 88];

/**
 * The laid stone coping along every edge the master painted translucent or as a
 * pale blue-grey ghost (the south bank, the north bank east of the bridge, both
 * end caps; the rest is painted pebbles, see `finishWater`): one course of
 * dressed blocks, a darker joint between them, wet and cool where the water touches, a little lighter along
 * the top edge. `inset` is the distance in page pixels from the outer edge.
 * Anything past the kerb's width returns null.
 */
export function copingRgb(
  wx: number,
  wy: number,
  inset: number,
  width = COPING_WIDTH,
): [number, number, number] | null {
  if (inset > width) return null;
  const { x, y } = worldToLogical(wx, wy);
  const end = x > 12.35 || x < 0.65;
  // Blocks run along the bank: along x on the south bank, along y on a cap. A
  // wide kerb is two courses, the inner one offset half a block, with a mortar
  // line between them.
  const courses = width > 14 ? 2 : 1;
  const course = Math.min(courses - 1, Math.floor((inset / width) * courses));
  const courseEdge = courses > 1 ? Math.abs(inset - width / courses) : 99;
  const along =
    (end ? y : x) * 4.4 + 0.5 * course + 0.4 * noise2(x * 1.3 + course * 5, y * 1.3, 331);
  const block = Math.floor(along);
  const within = along - block;
  const tone = 0.93 + 0.14 * hash(block, (end ? 1 : 0) + course * 2, 341);
  const grain = 0.97 + 0.06 * noise2(wx / 1.7, (wy * 2) / 1.7, 343);
  const wet = smooth(width - 3.4, width - 0.6, inset);
  const rim = 1 - smooth(0.4, 2.2, inset);
  const joint = Math.max(
    (1 - smooth(0.06, 0.15, within)) * 0.85,
    (1 - smooth(0.2, 0.9, courseEdge)) * 0.35,
  );
  return [0, 1, 2].map((c) => {
    let v = COPING_STONE[c]! * tone * grain * (1 + 0.07 * rim);
    v = v * (1 - joint) + COPING_JOINT[c]! * joint;
    return Math.round(v * (1 - 0.4 * wet) + COPING_WET[c]! * 0.4 * wet);
  }) as [number, number, number];
}

/**
 * The canal's painted edge. The master's alpha is a hard cut, a stair of whole
 * pixels along every diagonal; here it is antialiased into a soft painted
 * edge, the outermost stone takes a soft dark-brown lip, grass breaks
 * irregularly over the coping where lawn is its neighbour, and the colour of
 * the clear pixels beside it is carried outward so the encoder and the
 * renderer's filtering never pull black in. Then the shared light is baked in,
 * so a shadow crosses the water and its banks like the ground around them.
 */
export function finishWater(master: Image): Image {
  const { width, height } = master;
  // The master's south bank and end caps are a translucent band (alpha 230 to
  // 178 down to a hard cut at 70%), so the paving and garden showed through the
  // kerb as a ghost. The canal is solid to its outer edge: the translucent
  // texels become opaque here and the kerb is painted over them (`copingRgb`).
  const page = newImage(width, height);
  page.data.set(master.data);
  const canalRows = Math.min(height, CANAL_FIELD.height);
  const ghost = new Uint8Array(width * height);
  for (let y = 0; y < canalRows; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4 + 3;
      const a = page.data[i] ?? 0;
      if (a > 0 && a < 255) ghost[y * width + x] = 1;
      if (a > 0) page.data[i] = 255;
    }
  // The kerb goes wherever the translucent band was, and a little past it.
  const kerbed = new Uint8Array(width * height);
  const GHOST_REACH = 8;
  for (let y = 0; y < canalRows; y++)
    for (let x = 0; x < width; x++) {
      if (!ghost[y * width + x]) continue;
      for (let dy = -GHOST_REACH; dy <= GHOST_REACH; dy++)
        for (let dx = -GHOST_REACH; dx <= GHOST_REACH; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy >= 0 && yy < canalRows && xx >= 0 && xx < width) kerbed[yy * width + xx] = 1;
        }
    }
  const out = newImage(width, height);
  const alphaAt = (x: number, y: number): number =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : (page.data[(y * width + x) * 4 + 3] ?? 0);
  // Distance (Chebyshev, up to 4) from an opaque pixel to the nearest clear one, and which.
  const R = 4;
  const nearest = new Int8Array(width * height * 2);
  const dist = new Uint8Array(width * height).fill(R + 1);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) >= 128) {
        let best = R + 1;
        for (let dy = -R; dy <= R && best > 1; dy++)
          for (let dx = -R; dx <= R; dx++) {
            if (alphaAt(x + dx, y + dy) >= 128) continue;
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            if (d < best) {
              best = d;
              nearest[(y * width + x) * 2] = dx;
              nearest[(y * width + x) * 2 + 1] = dy;
            }
          }
        dist[y * width + x] = best;
      }
    }
  // True distance to clear (chamfer, two passes): the master's translucent kerb
  // ends in a hard cut at about 70% opacity, a stair of whole pixels along its
  // outer edge, so that band is feathered out over several pixels instead.
  const clear = new Float32Array(width * height);
  for (let i = 0; i < clear.length; i++) clear[i] = (page.data[i * 4 + 3] ?? 0) === 0 ? 0 : 1e4;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x > 0) clear[i] = Math.min(clear[i] ?? 0, (clear[i - 1] ?? 0) + 1);
      if (y > 0) {
        clear[i] = Math.min(clear[i] ?? 0, (clear[i - width] ?? 0) + 1);
        if (x > 0) clear[i] = Math.min(clear[i] ?? 0, (clear[i - width - 1] ?? 0) + 1.41);
        if (x < width - 1) clear[i] = Math.min(clear[i] ?? 0, (clear[i - width + 1] ?? 0) + 1.41);
      }
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (x < width - 1) clear[i] = Math.min(clear[i] ?? 0, (clear[i + 1] ?? 0) + 1);
      if (y < height - 1) {
        clear[i] = Math.min(clear[i] ?? 0, (clear[i + width] ?? 0) + 1);
        if (x < width - 1) clear[i] = Math.min(clear[i] ?? 0, (clear[i + width + 1] ?? 0) + 1.41);
        if (x > 0) clear[i] = Math.min(clear[i] ?? 0, (clear[i + width - 1] ?? 0) + 1.41);
      }
    }
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const a = alphaAt(x, y);
      if (a === 0 && !(y < CANAL_FIELD.height)) continue;
      // Antialiased alpha: a tent filter of the hard cut, then a contrast curve.
      let sum = 0;
      let weight = 0;
      // A tent filter two pixels wide: a 2:1 stair needs about that to read as a line.
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const w = (3 - Math.abs(dx)) * (3 - Math.abs(dy));
          sum += w * alphaAt(x + dx, y + dy);
          weight += w;
        }
      const average = sum / weight;
      let alpha =
        y < CANAL_FIELD.height && average < 255
          ? Math.round(255 * smooth(0.04, 0.96, average / 255))
          : a;
      // The translucent kerb thins out into the paving, never a cut edge.
      if (y < CANAL_FIELD.height && a > 0 && a < 255)
        alpha = Math.round(alpha * smooth(0.5, 7, clear[y * width + x] ?? 0));
      if (a === 0) {
        // Carry the neighbouring colour into a clear pixel next to the edge.
        let found = false;
        for (let r = 1; r <= 3 && !found; r++)
          for (let dy = -r; dy <= r && !found; dy++)
            for (let dx = -r; dx <= r && !found; dx++)
              if (alphaAt(x + dx, y + dy) >= 128) {
                const s = ((y + dy) * width + (x + dx)) * 4;
                out.data.set(
                  [page.data[s] ?? 0, page.data[s + 1] ?? 0, page.data[s + 2] ?? 0, 0],
                  at,
                );
                found = true;
              }
        if (!found) continue;
      } else out.data.set(page.data.subarray(at, at + 4), at);
      const d = dist[y * width + x] ?? R + 1;
      const world = pageToWorld(x, y);
      let rgb: [number, number, number] = [
        out.data[at] ?? 0,
        out.data[at + 1] ?? 0,
        out.data[at + 2] ?? 0,
      ];
      const logical = worldToLogical(world.x, world.y);
      // East of the bridge the master paints the north bank as a pale blue-grey
      // kerb (opaque, but it reads as a ghost beside the warm paving); the pebble
      // ring west of it is real stone and stays.
      const northKerb = logical.y < 6.5 && logical.x > 9.5;
      if (kerbed[y * width + x] || northKerb) {
        const stone = copingRgb(
          world.x,
          world.y,
          clear[y * width + x] ?? 0,
          northKerb ? NORTH_KERB_WIDTH : COPING_WIDTH,
        );
        if (stone) rgb = stone;
      }
      if (y < CANAL_FIELD.height && d <= R) {
        const ox = nearest[(y * width + x) * 2] ?? 0;
        const oy = nearest[(y * width + x) * 2 + 1] ?? 0;
        const outside = pageToWorld(x + ox, y + oy);
        const kind = cellKindAt(outside.x, outside.y);
        if (kind === ',' || kind === 'T') {
          const reach = 4 * smooth(0.5, 0.82, noise2(world.x / 6, (world.y * 2) / 6, 261));
          if (d <= reach * (0.45 + 0.55 * hash(x, y, 263))) {
            const lawn = villageLawnRgb(world.x, world.y);
            const shade = 0.78 + 0.07 * d;
            rgb = [lawn[0] * shade, lawn[1] * shade, lawn[2] * shade].map(Math.round) as typeof rgb;
          }
        }
        const k = 0.5 * (1 - smooth(0, 2.6, d - 1));
        rgb = [0, 1, 2].map((c) => Math.round(rgb[c]! * (1 - k) + BRANK_LIP[c]! * k)) as typeof rgb;
      }
      const lit = litRgb(world.x, world.y, rgb);
      out.data.set([lit[0], lit[1], lit[2], alpha], at);
    }
  return out;
}

export async function packWater(plate: WaterPlate): Promise<Uint8Array> {
  return encodeWebp(readMaster(plate), WATER_QUALITY, true);
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/art/ba-dan-water.ts')) {
  for (const plate of WATER_PLATES) {
    const bytes = await packWater(plate);
    writeFileSync(shippedPath(plate), bytes);
    console.log(shippedPath(plate), bytes.byteLength);
  }
}
