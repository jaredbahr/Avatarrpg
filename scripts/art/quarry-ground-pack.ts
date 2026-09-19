/** Pack authored material texels through authoritative map masks; never infer geometry from art. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { QUARRY_GATE } from '../../src/content/maps/combat';
import { newImage, readImage, pixelAt, setPixel, writePng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

const [materialPath, coverPath, shoulderPath] = process.argv.slice(2);
if (!materialPath || !coverPath)
  throw new Error('Provide three-panel materials and transparent timber PNGs.');
// A ground diamond is128x64 at the registered plate scale. Keep each field at
// one diamond wide so the flat limestone reads as paving beneath a standing
// unit instead of as a single oversized slab.
const FIELD_REPEAT_PX = 128;
const source = readImage(materialPath),
  timber = readImage(coverPath);
const shoulderSource = shoulderPath ? readImage(shoulderPath) : null;
if (shoulderSource) {
  for (let y = 0; y < shoulderSource.height; y++)
    for (let x = 0; x < shoulderSource.width; x++) {
      const [r, g, b, a] = pixelAt(shoulderSource, x, y);
      if (a && ((r - b > 100 && g - b > 100) || (r - g > 80 && r - b > 80)))
        setPixel(shoulderSource, x, y, [0, 0, 0, 0]);
    }
}
const shoulderBounds = shoulderSource && alphaBounds(shoulderSource);
const shoulder =
  shoulderSource && shoulderBounds ? scaleTo(crop(shoulderSource, shoulderBounds), 716, 24) : null;
if (source.width !== source.height * 3)
  throw new Error('Expected three equal square material panels.');
const fields = [0, 1, 2].map((index) =>
  // Normalize the authored marks to ground scale before sampling. Native panel
  // scale made small chips read as knee-high obstacles at the 96px camera.
  scaleTo(
    crop(source, {
      // Discard generation's panel-border contamination before repeating the field.
      x: index * source.height + 8,
      y: 8,
      width: source.height - 16,
      height: source.height - 16,
    }),
    FIELD_REPEAT_PX,
    FIELD_REPEAT_PX,
  ),
);
/** Reflected authored texels meet without seams; no upscaling or invented paint. */
const mirror = (value: number, size: number) => {
  const period = value % (size * 2);
  return period < size ? period : size * 2 - period - 1;
};
const plate = newImage(2304, 1280);
const counts: Record<string, number> = {};
let shoulderPixels = 0;
for (let py = 0; py < plate.height; py++)
  for (let px = 0; px < plate.width; px++) {
    // Pixel centers in world coordinates, inverted from X=(64,32), Y=(-64,32).
    const wx = px + 0.5 - 128,
      wy = py + 0.5 - 192;
    const gx = ((wx - 768) / 64 + wy / 32) / 2;
    const gy = (wy / 32 - (wx - 768) / 64) / 2;
    const key = QUARRY_GATE.rows[Math.floor(gy)]?.[Math.floor(gx)] ?? '.';
    const material = key === '=' ? 1 : key === '^' || key === 'o' ? 2 : 0;
    const field = fields[material];
    if (!field) throw new Error('Missing authored material.');
    setPixel(plate, px, py, pixelAt(field, mirror(px, field.width), mirror(py, field.height)));
    // Western approach only. Dust straddles the real road/earth edges by at
    // most12 world pixels; no raised geometry or rule-cell boundary is moved.
    if (shoulder && gx >= 0 && gx < 10) {
      for (const edge of [5, 7]) {
        const normal = ((gy - edge) * 4096) / Math.hypot(64, 32);
        if (Math.abs(normal) >= 12) continue;
        const along = gx * Math.hypot(64, 32) - ((gy - edge) * 3072) / Math.hypot(64, 32);
        if (along < 0 || along >= 716) continue;
        const sample = pixelAt(
          shoulder,
          Math.floor(along),
          Math.floor(12 + (edge === 5 ? normal : -normal)),
        );
        const base = pixelAt(plate, px, py),
          a = sample[3] / 255;
        if (a) {
          setPixel(plate, px, py, [
            Math.round(base[0] * (1 - a) + sample[0] * a),
            Math.round(base[1] * (1 - a) + sample[1] * a),
            Math.round(base[2] * (1 - a) + sample[2] * a),
            255,
          ]);
          shoulderPixels++;
        }
      }
    }
    counts[key] = (counts[key] ?? 0) + 1;
  }
const bounds = alphaBounds(timber);
if (!bounds) throw new Error('Timber is empty.');
const trimmed = crop(timber, bounds);
const scale = Math.min(168 / trimmed.width, 72 / trimmed.height);
const piece = scaleTo(
  trimmed,
  Math.round(trimmed.width * scale),
  Math.round(trimmed.height * scale),
);
const decal = newImage(224, 96);
const ox = Math.floor((decal.width - piece.width) / 2),
  oy = Math.floor((decal.height - piece.height) / 2);
let clipped = 0;
for (let y = 0; y < piece.height; y++)
  for (let x = 0; x < piece.width; x++) {
    const px = x + ox,
      py = y + oy,
      rgba = pixelAt(piece, x, y);
    // Clip against the true 128x64 cell diamond, not an invented rectangular footprint.
    if (Math.abs((px + 0.5) / 2 - 56) / 64 + Math.abs((py + 0.5) / 2 - 24) / 32 > 1) {
      if (rgba[3]) clipped++;
    } else setPixel(decal, px, py, rgba);
  }
const packed = scaleTo(plate, 1728, 960);
const outputs = await Promise.all(
  [0, 1].map(async (index) => ({
    name: `ground-${index === 0 ? 'west' : 'east'}`,
    bytes: await encodeWebp(crop(packed, { x: index * 864, y: 0, width: 864, height: 960 }), 88),
  })),
);
outputs.push({ name: 'cover-timber', bytes: await encodeWebp(decal, 88, true) });
const bytes = outputs.reduce((total, output) => total + output.bytes.length, 0);
if (bytes > 240 * 1024) throw new Error(`Ground and cover planning budget exceeded: ${bytes}`);
const directory = 'public/art/maps/quarry-gate-scene';
mkdirSync(directory, { recursive: true });
for (const output of outputs) writeFileSync(`${directory}/${output.name}.webp`, output.bytes);
mkdirSync('art/raw/quarry-gate', { recursive: true });
writePng('art/raw/quarry-gate/masked-ground.png', plate);
writePng('art/raw/quarry-gate/packed-cover.png', decal);
console.log({
  bytes,
  counts,
  clipped,
  shoulderPixels,
  coverBounds: bounds,
  ground: [864, 960],
  cover: [224, 96],
});
