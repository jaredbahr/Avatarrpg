/**
 * Pack the pond: its dry bank, a bounded exterior feather, a ragged bite into
 * the outer water cells so the pond does not read as the rules' eight-cell
 * cross, and the bed the water sits on.
 *
 * The runtime water layer still covers every water cell, exactly as the rules
 * do — it lays a 0.4-alpha film over the tile. What this layer adds is what the
 * camera sees through that film: the authored dry material reaches a little way
 * inside the outermost cells by a seeded, smoothly varying amount, so the
 * boundary between wet and dry wanders the way a real bank does instead of
 * tracing the tile polygon; and the rest of the water carries the forest's own
 * floor material, darkened with distance from the shore, so the middle of the
 * pond reads as deeper water over a visible bed rather than as a flat teal field.
 */
import { writeFileSync } from 'node:fs';
import { FOREST_POND_PATCH, FOREST_WATER_CELLS } from '../../src/content/scenes/forestRoad';
import { newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import type { Image } from './lib/image';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

export const SHORE_LIMIT = 0.12;
export const COVER_LIMIT = 0.08;
/** The deepest the dry bank reaches inside a water cell, in cells. */
export const SHORE_BITE = 0.3;
/** The innermost sliver of a bite, feathered so wet and dry meet softly. */
export const BITE_FEATHER = 0.05;
/** The narrowest a bite gets, as a fraction of `SHORE_BITE`. */
export const BITE_FLOOR = 0.3;
/** How far in the bed reaches its full depth, in cells. */
export const BED_DEPTH = 1.5;
/** What the shelf just under the bank keeps of the floor's brightness. */
export const BED_SHELF = 0.78;
/** How much of the authored silt's brightness the deepest water takes away. */
export const BED_SHADE = 0.55;
/** The deepest the seeded mottle may darken or lighten the bed, at full depth. */
export const BED_MOTTLE = 0.07;
/**
 * Standing water absorbs red first, so the bed cools as it goes under.
 *
 * The first pass used a small shift (0.94/1.06) and the pond's middle read
 * green-teal through the 0.4-alpha film: `e2e/renderer.spec.ts`'s authored-water
 * gate, which wants blue-minus-red above 20 where the rules say water, measured
 * 3.8 on a CI runner and 4.0 under SwiftShader locally, against 23 on an
 * accelerated GPU, where the same head clears it. The gate passed on the plate
 * before the bed existed, so the shift has to carry the water's own colour over
 * an opaque floor: 0.80/1.26 restores it on both rasterisers without touching
 * the brightness the bed's depth gradient is tuned for.
 */
export const BED_COOL = { red: 0.8, blue: 1.26 } as const;
/** World pixels per cell, and packed pixels per cell at this density. */
const CELL = 64;
const DENSITY = 2;
export const SHORE_SOURCE = 'assets/reference/forest-pond-shoreline/shoreline-source.png';
export const SHORE_OUTPUT = 'public/art/maps/forest-scene/pond-bank.webp';
/** The atlas the route ground itself is packed from, and its own 3px guard. */
export const BED_SOURCE = 'assets/source/forest-material-v2/material-sheet.png';
const ATLAS_GUARD = 3;
const ATLAS_PERIODS = 192;

/**
 * The forest floor under the pond, sampled in world space exactly as
 * `forest-route-ground.ts` samples it for the road, out of the atlas's own
 * dry-earth quadrant. The pond therefore holds the material the ground around
 * it is made of — a unit of road, one unit of water below — and the bed's grain
 * continues across the shoreline instead of changing material at the wet line.
 */
export function bedSampler(
  atlas: Image,
): (x: number, y: number) => [number, number, number, number] {
  const swatch = Math.floor(Math.min(atlas.width, atlas.height) / 2);
  const period = swatch - ATLAS_GUARD * 2;
  const wrap = (value: number): number => {
    const wrapped = ((value % (period * 2)) + period * 2) % (period * 2);
    return (
      ATLAS_GUARD +
      Math.min(period - 1, Math.floor(wrapped < period ? wrapped : period * 2 - wrapped))
    );
  };
  return (x, y) => pixelAt(atlas, wrap(x * ATLAS_PERIODS), wrap(y * ATLAS_PERIODS));
}

export function shorePosition(px: number, py: number, density = 2) {
  const worldX = FOREST_POND_PATCH.x + (px + 0.5) / density;
  const worldY = FOREST_POND_PATCH.y + (py + 0.5) / density;
  const dx = (worldX - 768) / 64,
    dy = worldY / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
}

export function shoreDistance(x: number, y: number): number {
  return Math.min(
    ...FOREST_WATER_CELLS.map((c) => Math.max(c.x - x, x - c.x - 1, c.y - y, y - c.y - 1, 0)),
  );
}

/**
 * How deep the dry bank bites into the water at a point, in cells. Smooth
 * value noise in cell space, so neighbouring shore pixels agree and the bite
 * arrives in clumps that read as a bank rather than per-pixel speckle.
 */
export function biteDepth(x: number, y: number): number {
  return SHORE_BITE * (BITE_FLOOR + (1 - BITE_FLOOR) * shoreNoise(x * 2.6, y * 2.6));
}

/**
 * How much of the bed's borrowed silt colour survives at a point, by how far
 * the point sits inside the water. The shelf under the bank keeps the artist's
 * own tone, so the bite's feather meets it without a seam; the middle of the
 * pond loses `BED_SHADE` of its brightness and gains a slow mottle, which is
 * what makes the water read as deeper there. Position-seeded and smooth, so
 * neighbouring pixels agree and the bed never speckles.
 */
export function bedShade(x: number, y: number, inset: number): number {
  const depth = Math.min(1, Math.max(0, inset) / BED_DEPTH);
  const mottle = (shoreNoise(x * 1.7 + 31.7, y * 1.7 + 17.3) - 0.5) * 2 * BED_MOTTLE * depth;
  return Math.max(0.3, BED_SHELF - BED_SHADE * depth + mottle);
}

/** Two octaves of value noise over a seeded integer lattice. */
function shoreNoise(x: number, y: number): number {
  return (valueNoise(x, y) * 2 + valueNoise(x * 2.1 + 11.3, y * 2.1 + 4.7)) / 3;
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash01(ix, iy);
  const b = hash01(ix + 1, iy);
  const c = hash01(ix, iy + 1);
  const d = hash01(ix + 1, iy + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function hash01(ix: number, iy: number): number {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The nearest authored dry pixel's colour and 4-connected distance at every
 * packed pixel, by one multi-source breadth-first walk out of the dry material.
 * Registration and the bite both use it, so neither synthesises a colour the
 * artist did not draw.
 */
function nearestDry(source: Image): { colour: Image; distance: Float64Array } {
  const { width, height } = source;
  const colour = newImage(width, height);
  const distance = new Float64Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const pixel = pixelAt(source, px, py);
      if (pixel[3] < 16 || isWaterColour(pixel)) continue;
      // Only the authored bank outside the water cells seeds the fill: the
      // shallow-water mottling the artist drew at the rim reads as scattered
      // green noise once it is carried inward pixel by pixel.
      const { x, y } = shorePosition(px, py);
      if (shoreDistance(x, y) <= 0) continue;
      const index = py * width + px;
      distance[index] = 0;
      setPixel(colour, px, py, pixel);
      queue[tail++] = index;
    }
  while (head < tail) {
    const index = queue[head++] ?? 0;
    const px = index % width;
    const py = (index - px) / width;
    const step = (distance[index] ?? 0) + 1;
    const spread = (next: number): void => {
      if (next < 0 || next >= width * height) return;
      if ((distance[next] ?? -1) >= 0) return;
      const nx = next % width;
      const ny = (next - nx) / width;
      if (Math.abs(nx - px) + Math.abs(ny - py) !== 1) return;
      distance[next] = step;
      setPixel(colour, nx, ny, pixelAt(colour, px, py));
      queue[tail++] = next;
    };
    spread(index - 1);
    spread(index + 1);
    spread(index - width);
    spread(index + width);
  }
  return { colour, distance };
}

/** How far inside the water a packed pixel sits, in cells; zero outside it. */
export function pondInset(width: number, height: number): Float64Array {
  const far = 1e9;
  const inset = new Float64Array(width * height);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const { x, y } = shorePosition(px, py);
      inset[py * width + px] = shoreDistance(x, y) <= 0 ? far : 0;
    }
  const pixelsPerCell = CELL * DENSITY;
  const step = (index: number, previous: number, cost: number): void => {
    const value = inset[previous];
    if (value !== undefined && value + cost < (inset[index] ?? far)) inset[index] = value + cost;
  };
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const index = py * width + px;
      if (px > 0) step(index, index - 1, 1);
      if (py > 0) step(index, index - width, 1);
      if (px > 0 && py > 0) step(index, index - width - 1, 2);
      if (px + 1 < width && py > 0) step(index, index - width + 1, 2);
    }
  for (let py = height - 1; py >= 0; py--)
    for (let px = width - 1; px >= 0; px--) {
      const index = py * width + px;
      if (px + 1 < width) step(index, index + 1, 1);
      if (py + 1 < height) step(index, index + width, 1);
      if (px + 1 < width && py + 1 < height) step(index, index + width + 1, 2);
      if (px > 0 && py + 1 < height) step(index, index + width - 1, 2);
    }
  for (let index = 0; index < inset.length; index++) {
    const value = inset[index] ?? 0;
    inset[index] = value >= far ? 0 : value / pixelsPerCell;
  }
  return inset;
}

/** Teal is absent from the authored ochre dry-margin material. */
export function isWaterColour(pixel: readonly number[]): boolean {
  const [r = 0, g = 0, b = 0] = pixel;
  return b > r + 5 && g > r + 5;
}

export function packShoreline(raw: Image, atlas: Image) {
  const { width, height } = FOREST_POND_PATCH;
  if (Math.abs(raw.width / raw.height - width / height) > 0.005)
    throw new Error('Shoreline source changed the full-canvas registration aspect.');
  const source = scaleTo(raw, width * 2, height * 2);
  const out = newImage(source.width, source.height);
  const { colour: dry, distance: dryDistancePx } = nearestDry(source);
  const inset = pondInset(out.width, out.height);
  const bedSample = bedSampler(atlas);
  let mattePixels = 0,
    farthestSampleCells = 0,
    bitePixels = 0,
    deepestBitePixels = 0,
    bedPixels = 0,
    deepBedPixels = 0,
    deepestShade = 1;
  for (let py = 0; py < out.height; py++)
    for (let px = 0; px < out.width; px++) {
      const { x, y } = shorePosition(px, py);
      const distance = shoreDistance(x, y);
      const depth = biteDepth(x, y);
      const inside = inset[py * out.width + px] ?? 0;
      const dryOutside = distance > 0 && distance < SHORE_LIMIT;
      /*
       * Inside a water cell the bank reaches in by `depth`, so the wet outline
       * wanders instead of running along the tile's own edge. The bite is
       * bounded well below half a cell, so the middle of every water cell -
       * where a unit stands and where the runtime water reads as water - is
       * never covered.
       */
      const dryInside = inside > 0 && inside < depth;
      const wet = inside > 0;
      if (!dryOutside && !wet) continue;
      /*
       * The bed is painted first, because both the bank and its bite sit on it:
       * the forest floor, darkened with distance from the shore. It is opaque
       * across every water pixel, so the 0.4-alpha water film tints authored
       * sediment the same way the road beside it is made, instead of showing
       * whichever ground the pond happens to sit on.
       */
      let pixel: readonly number[] = [0, 0, 0, 0];
      if (wet) {
        const silt = bedSample(x, y);
        const shade = bedShade(x, y, inside);
        pixel = [
          Math.round(silt[0] * shade * BED_COOL.red),
          Math.round(silt[1] * shade),
          Math.min(255, Math.round(silt[2] * shade * BED_COOL.blue)),
          255,
        ];
        bedPixels++;
        deepestShade = Math.min(deepestShade, shade);
        if (inside > BED_DEPTH * 0.6) deepBedPixels++;
      }
      if (dryOutside || dryInside) {
        let bank = pixelAt(source, px, py);
        // Generated alpha drifts slightly from the exact guide, and a bite sits
        // where the source painted water. Both borrow the nearest authored dry
        // pixel: this is registration and shore, never synthesized material.
        if (bank[3] < 16 || isWaterColour(bank)) {
          /*
           * The nearest bank pixel is reached by a straight 4-connected walk, so
           * copying it verbatim lays the bank into the water as parallel streaks.
           * A small seeded offset along the shore turns those into mottle, and
           * falls back to the exact pixel when the offset lands off the bank.
           */
          const jitterX = Math.round((hash01(px >> 2, py >> 2) - 0.5) * 7);
          const jitterY = Math.round((hash01(py >> 2, px >> 2) - 0.5) * 7);
          let replacement = pixelAt(
            dry,
            Math.min(dry.width - 1, Math.max(0, px + jitterX)),
            Math.min(dry.height - 1, Math.max(0, py + jitterY)),
          );
          if (replacement[3] < 16) replacement = pixelAt(dry, px, py);
          if (replacement[3] < 16)
            throw new Error(`No nearby authored dry shore pixel at ${px},${py}`);
          bank = replacement;
          mattePixels++;
          farthestSampleCells = Math.max(
            farthestSampleCells,
            (dryDistancePx[py * out.width + px] ?? 0) / (CELL * DENSITY),
          );
        }
        if (dryOutside) {
          // Nothing lies under this band, outside the water: it keeps its own
          // alpha, opaque against the bank and feathered out to the dry ground.
          const alpha =
            distance <= COVER_LIMIT
              ? 255
              : Math.round((255 * (SHORE_LIMIT - distance)) / (SHORE_LIMIT - COVER_LIMIT));
          pixel = [bank[0], bank[1], bank[2], alpha];
        } else {
          /*
           * The bite is the damp edge of the bank. It fades into the bed that is
           * already painted underneath, rather than into bare ground: wet and
           * dry meet in silt, and the pond has no translucent hole in it.
           */
          const weight = Math.min(1, (depth - inside) / BITE_FEATHER);
          pixel = [
            Math.round(bank[0] * weight + (pixel[0] ?? 0) * (1 - weight)),
            Math.round(bank[1] * weight + (pixel[1] ?? 0) * (1 - weight)),
            Math.round(bank[2] * weight + (pixel[2] ?? 0) * (1 - weight)),
            255,
          ];
          bitePixels++;
          if (inside > SHORE_BITE * 0.75) deepestBitePixels++;
        }
      }
      setPixel(out, px, py, pixel);
    }
  return {
    image: out,
    mattePixels,
    farthestSampleCells,
    bitePixels,
    deepestBitePixels,
    bedPixels,
    deepBedPixels,
    deepestShade,
  };
}

export async function main() {
  const result = packShoreline(readImage(SHORE_SOURCE), readImage(BED_SOURCE));
  writeFileSync(SHORE_OUTPUT, await encodeWebp(result.image, 88, true));
  if (process.argv.includes('--audit')) writePng('.shots/pond/packed.png', result.image);
  console.log({
    width: result.image.width,
    height: result.image.height,
    mattePixels: result.mattePixels,
    farthestSampleCells: Number(result.farthestSampleCells.toFixed(3)),
    bitePixels: result.bitePixels,
    deepestBitePixels: result.deepestBitePixels,
    bedPixels: result.bedPixels,
    deepBedPixels: result.deepBedPixels,
    deepestShade: Number(result.deepestShade.toFixed(3)),
  });
}
if (process.argv[1]?.endsWith('forest-shoreline.ts')) await main();
