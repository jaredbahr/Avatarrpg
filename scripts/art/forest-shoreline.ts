/**
 * Pack the pond's dry bank: a bounded exterior feather, and a ragged bite into
 * the outer water cells so the pond does not read as the rules' eight-cell cross.
 *
 * The runtime water layer still covers every water cell, exactly as the rules
 * do. What this layer adds is the shore the camera sees: the authored dry
 * material reaches a little way inside the outermost cells by a seeded,
 * smoothly varying amount, so the boundary between wet and dry wanders the way
 * a real bank does instead of tracing the tile polygon. Nothing is ever painted
 * near a cell's centre, so every water cell still reads as water.
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
/** World pixels per cell, and packed pixels per cell at this density. */
const CELL = 64;
const DENSITY = 2;
export const SHORE_SOURCE = 'assets/reference/forest-pond-shoreline/shoreline-source.png';
export const SHORE_OUTPUT = 'public/art/maps/forest-scene/pond-bank.webp';

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

export function packShoreline(raw: Image) {
  const { width, height } = FOREST_POND_PATCH;
  if (Math.abs(raw.width / raw.height - width / height) > 0.005)
    throw new Error('Shoreline source changed the full-canvas registration aspect.');
  const source = scaleTo(raw, width * 2, height * 2);
  const out = newImage(source.width, source.height);
  const { colour: dry, distance: dryDistancePx } = nearestDry(source);
  const inset = pondInset(out.width, out.height);
  let mattePixels = 0,
    farthestSampleCells = 0,
    bitePixels = 0,
    deepestBitePixels = 0;
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
      if (!dryOutside && !dryInside) continue;
      let pixel = pixelAt(source, px, py);
      // Generated alpha drifts slightly from the exact guide, and a bite sits
      // where the source painted water. Both borrow the nearest authored dry
      // pixel: this is registration and shore, never synthesized material.
      if (pixel[3] < 16 || isWaterColour(pixel)) {
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
        pixel = replacement;
        mattePixels++;
        farthestSampleCells = Math.max(
          farthestSampleCells,
          (dryDistancePx[py * out.width + px] ?? 0) / (CELL * DENSITY),
        );
      }
      let alpha: number;
      if (dryOutside) {
        alpha =
          distance <= COVER_LIMIT
            ? 255
            : Math.round((255 * (SHORE_LIMIT - distance)) / (SHORE_LIMIT - COVER_LIMIT));
      } else {
        // The bite's own inner edge is feathered, so wet and dry meet in damp
        // silt rather than on a second, ruled line inside the pond.
        alpha = Math.round(255 * Math.min(1, (depth - inside) / BITE_FEATHER));
        bitePixels++;
        if (inside > SHORE_BITE * 0.75) deepestBitePixels++;
      }
      setPixel(out, px, py, [pixel[0], pixel[1], pixel[2], alpha]);
    }
  return { image: out, mattePixels, farthestSampleCells, bitePixels, deepestBitePixels };
}

export async function main() {
  const result = packShoreline(readImage(SHORE_SOURCE));
  writeFileSync(SHORE_OUTPUT, await encodeWebp(result.image, 88, true));
  if (process.argv.includes('--audit')) writePng('.shots/pond/packed.png', result.image);
  console.log({
    width: result.image.width,
    height: result.image.height,
    mattePixels: result.mattePixels,
    farthestSampleCells: Number(result.farthestSampleCells.toFixed(3)),
    bitePixels: result.bitePixels,
    deepestBitePixels: result.deepestBitePixels,
  });
}
if (process.argv[1]?.endsWith('forest-shoreline.ts')) await main();
