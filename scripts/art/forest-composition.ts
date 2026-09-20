/** Pack one authored ground plate; retain registered substrate at rule-sensitive boundaries. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import { readImage, newImage, pixelAt, setPixel, writePng } from './lib/image';
import { scaleTo } from './lib/scale';
import { crop } from './lib/trim';
import { encodeWebp } from './lib/webp';

const [platePath, atlasPath, auditDirectory] = process.argv.slice(2);
if (!platePath || !atlasPath)
  throw new Error('Provide the authored plate and original material atlas.');
const raw = readImage(platePath);
if (Math.abs(raw.width / raw.height - 1.8) > 0.001)
  throw new Error('Plate must retain the 2304:1280 registration aspect.');
// Multiples of 18:10 give two equal chunks with no cropping or upscaling.
const factor = Math.floor(Math.min(raw.width / 18, raw.height / 10, 2048 / 10));
const plate = scaleTo(raw, factor * 18, factor * 10);
const atlas = readImage(atlasPath);
const swatch = Math.floor(Math.min(atlas.width, atlas.height) / 2);
const edge = 3,
  period = swatch - edge * 2;
function sample(value: number): number {
  const wrapped = ((value % (period * 2)) + period * 2) % (period * 2);
  return edge + Math.min(period - 1, Math.floor(wrapped < period ? wrapped : period * 2 - wrapped));
}
const critical = FOREST_ROAD.rows.flatMap((row, y) =>
  [...row].flatMap((key, x) => (key === '~' || key === '^' ? [{ x, y }] : [])),
);
const output = newImage(plate.width, plate.height);
let guardedPixels = 0;
for (let py = 0; py < plate.height; py++) {
  for (let px = 0; px < plate.width; px++) {
    const worldX = ((px + 0.5) * 2304) / plate.width - 128;
    const worldY = ((py + 0.5) * 1280) / plate.height - 192;
    const dx = (worldX - 768) / 64,
      dy = worldY / 32;
    const x = (dx + dy) / 2,
      y = (dy - dx) / 2;
    const guarded = critical.some(
      (cell) =>
        x >= cell.x - 0.08 && x <= cell.x + 1.08 && y >= cell.y - 0.08 && y <= cell.y + 1.08,
    );
    if (!guarded) {
      setPixel(output, px, py, pixelAt(plate, px, py));
      continue;
    }
    // Only copy existing authored swatch pixels. The actual row chooses the
    // material, so guide-placeholder drift cannot enlarge water or elevation.
    const cell = FOREST_ROAD.rows[Math.floor(y)]?.[Math.floor(x)] ?? ',';
    const material = cell === '~' ? 2 : cell === '^' ? 3 : cell === '=' ? 0 : 1;
    const sx = sample(x * 192) + (material % 2) * swatch;
    const sy = sample(y * 192) + Math.floor(material / 2) * swatch;
    setPixel(output, px, py, pixelAt(atlas, sx, sy));
    guardedPixels++;
  }
}
const directory = 'public/art/maps/forest-scene';
const prior = { ...output, data: output.data.slice() };
const elevated = critical.filter(({ x, y }) => FOREST_ROAD.rows[y]?.[x] === '^');
const logical = (px: number, py: number) => {
  const dx = (((px + 0.5) * 2304) / plate.width - 896) / 64;
  const dy = (((py + 0.5) * 1280) / plate.height - 192) / 32;
  return { x: (dx + dy) / 2, y: (dy - dx) / 2 };
};
const elevationDistance = (x: number, y: number) =>
  Math.min(...elevated.map((c) => Math.max(c.x - x, x - c.x - 1, c.y - y, y - c.y - 1, 0)));
const terrain = (x: number, y: number) => FOREST_ROAD.rows[Math.floor(y)]?.[Math.floor(x)] ?? ',';
let mattePixels = 0;
for (let py = 0; py < plate.height; py++) {
  for (let px = 0; px < plate.width; px++) {
    const { x, y } = logical(px, py);
    const distance = elevationDistance(x, y);
    if (distance > 0.08) continue;
    const key = terrain(x, y);
    let sourceX = px,
      sourceY = py;
    // The observed source fringe extends 0.0161 cell outside stone. A 0.02
    // exterior matte copies the nearest same-terrain authored pixel clear of
    // that fringe. No colour synthesis, blurred edge or extra stone is added.
    if (key !== '^' && distance <= 0.02) {
      let best = Infinity;
      for (let oy = -6; oy <= 6; oy++) {
        for (let ox = -6; ox <= 6; ox++) {
          const sx = px + ox,
            sy = py + oy;
          if (sx < 0 || sy < 0 || sx >= plate.width || sy >= plate.height) continue;
          const candidate = logical(sx, sy);
          const square = ox * ox + oy * oy;
          if (
            square < best &&
            terrain(candidate.x, candidate.y) === key &&
            elevationDistance(candidate.x, candidate.y) >= 0.04
          ) {
            best = square;
            sourceX = sx;
            sourceY = sy;
          }
        }
      }
      if (!Number.isFinite(best)) throw new Error('No same-terrain authored pixel for edge matte.');
      mattePixels++;
    }
    setPixel(output, px, py, pixelAt(plate, sourceX, sourceY));
  }
}
let elevationChangedPixels = 0;
for (let py = 0; py < output.height; py++) {
  for (let px = 0; px < output.width; px++) {
    if (pixelAt(prior, px, py).every((value, i) => value === pixelAt(output, px, py)[i])) continue;
    const wx = ((px + 0.5) * 2304) / output.width - 896;
    const wy = ((py + 0.5) * 1280) / output.height - 192;
    const x = wx / 128 + wy / 64,
      y = wy / 64 - wx / 128;
    if (
      !elevated.some(
        (c) => x >= c.x - 0.08 && x <= c.x + 1.08 && y >= c.y - 0.08 && y <= c.y + 1.08,
      )
    )
      throw new Error('Elevation correction changed a pixel outside its approved envelope.');
    elevationChangedPixels++;
  }
}
if (auditDirectory) {
  mkdirSync(auditDirectory, { recursive: true });
  writePng(`${auditDirectory}/before.png`, prior);
  writePng(`${auditDirectory}/after.png`, output);
}
// Independent colour audit of composed pixels: teal is unique among this
// plate's earth/grass materials. This does not certify post-WebP edge colours.
let sourceWaterSpill = 0,
  packedWaterSpill = 0;
const teal = ([r, g, b]: readonly number[]) =>
  r !== undefined && g !== undefined && b !== undefined && b > r + 5 && g > r + 5;
for (let py = 0; py < output.height; py++) {
  for (let px = 0; px < output.width; px++) {
    const wx = ((px + 0.5) * 2304) / output.width - 896;
    const wy = ((py + 0.5) * 1280) / output.height - 192;
    const cellX = Math.floor(wx / 128 + wy / 64);
    const cellY = Math.floor(wy / 64 - wx / 128);
    if (FOREST_ROAD.rows[cellY]?.[cellX] === '~') continue;
    if (teal(pixelAt(plate, px, py))) sourceWaterSpill++;
    if (teal(pixelAt(output, px, py))) packedWaterSpill++;
  }
}
if (packedWaterSpill !== 0)
  throw new Error(`Water guide spills into ${packedWaterSpill} ground pixels.`);
mkdirSync(directory, { recursive: true });
for (const [index, side] of ['west', 'east'].entries()) {
  const chunk = crop(output, {
    x: (index * output.width) / 2,
    y: 0,
    width: output.width / 2,
    height: output.height,
  });
  writeFileSync(`${directory}/ground-${side}.webp`, await encodeWebp(chunk, 88));
}
console.log({
  source: [raw.width, raw.height],
  packed: [output.width, output.height],
  guardedPixels,
  sourceWaterSpill,
  packedWaterSpill,
  elevationChangedPixels,
  mattePixels,
});
