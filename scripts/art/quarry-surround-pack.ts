/** Register the authored quarry surround outside the existing playable diamond.
 * Usage: node --import tsx scripts/art/quarry-surround-pack.ts <source.png>
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import { encodeWebp } from './lib/webp';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Provide the reviewed quarry surround source PNG.');
const source = readImage(sourcePath);
if (source.width !== 1572 || source.height !== 1001)
  throw new Error('The reviewed surround registration expects 1572 x 1001 pixels.');
const WORLD = { x: -320, y: -560, width: 2688, height: 1664 };
const PAGE = { width: 672, height: 832 };
// Measured generated diamond: top (624,325), right (1347,695), bottom
// (928,909). The inferred left corner is covered by the source's terrace lip.
// Only this exterior painting receives the affine source registration.
function sourcePoint(mapX: number, mapY: number) {
  return { x: 624 + 36.15 * mapX - (419 / 12) * mapY, y: 325 + 18.5 * mapX + (214 / 12) * mapY };
}
function mapPoint(x: number, y: number) {
  const diagonal = (x - 768) / 64;
  const sum = y / 32;
  return { x: (diagonal + sum) / 2, y: (sum - diagonal) / 2 };
}
function playable(x: number, y: number) {
  // A small conservative guard keeps bilinear edge filtering off the live floor.
  return x >= -0.02 && x <= 20.02 && y >= -0.02 && y <= 12.02;
}
function guidePixel(rgba: readonly number[]) {
  return (rgba[2] ?? 0) > (rgba[1] ?? 0) + 10 && (rgba[0] ?? 0) > (rgba[1] ?? 0) + 20;
}
// Dilate the keyed guide by three source pixels to discard its anti-aliased fringe.
const guideMask = new Uint8Array(source.width * source.height);
for (let y = 0; y < source.height; y++)
  for (let x = 0; x < source.width; x++) {
    if (!guidePixel(pixelAt(source, x, y))) continue;
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < source.width && yy >= 0 && yy < source.height)
          guideMask[yy * source.width + xx] = 1;
      }
  }
const contaminated = (x: number, y: number) => guideMask[y * source.width + x] === 1;
let repairedEdgePixels = 0;
function sample(x: number, y: number): readonly [number, number, number, number] {
  const sx = Math.max(0, Math.min(source.width - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(source.height - 1, Math.round(y)));
  const direct = pixelAt(source, sx, sy);
  if (!contaminated(sx, sy)) return [direct[0], direct[1], direct[2], 255];
  for (let radius = 1; radius <= 16; radius++)
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const candidate = pixelAt(source, sx + dx, sy + dy);
        if (candidate[3] === 0 || contaminated(sx + dx, sy + dy)) continue;
        repairedEdgePixels++;
        return [candidate[0], candidate[1], candidate[2], 255];
      }
  throw new Error(`The generated hole misses the registered boundary near ${sx},${sy}.`);
}
const pages = [newImage(PAGE.width, PAGE.height), newImage(PAGE.width, PAGE.height)];
let excludedPixels = 0;
for (const [index, page] of pages.entries())
  for (let y = 0; y < page.height; y++)
    for (let x = 0; x < page.width; x++) {
      const worldX = WORLD.x + (index * PAGE.width + x + 0.5) * 2;
      const worldY = WORLD.y + (y + 0.5) * 2;
      const point = mapPoint(worldX, worldY);
      if (playable(point.x, point.y)) {
        excludedPixels++;
        continue;
      }
      const painted = sourcePoint(point.x, point.y);
      setPixel(page, x, y, sample(painted.x, painted.y));
    }
const directory = 'public/art/maps/quarry-surround';
mkdirSync(directory, { recursive: true });
const budget = 320 * 1024;
let outputs: Uint8Array[] = [];
let quality = 84;
for (const candidate of [84, 82, 80, 78, 76, 74, 72, 70, 68, 66]) {
  const encoded = await Promise.all(pages.map((page) => encodeWebp(page, candidate, true)));
  if (encoded.reduce((sum, file) => sum + file.length, 0) > budget) continue;
  outputs = encoded;
  quality = candidate;
  break;
}
if (!outputs.length) throw new Error('Exterior surround exceeds its existing family headroom.');
for (const [index, bytes] of outputs.entries()) {
  writeFileSync(`${directory}/${index === 0 ? 'west' : 'east'}.webp`, bytes);
  const page = pages[index];
  if (page) writePng(`art/raw/terraces/surround-${index}.png`, page);
}
const report = {
  source: sourcePath,
  sourceSha256: createHash('sha256').update(readFileSync(sourcePath)).digest('hex'),
  sourcePixels: [source.width, source.height],
  world: WORLD,
  pagePixels: PAGE,
  excludedPixels,
  repairedEdgePixels,
  quality,
  bytes: outputs.map((bytes) => bytes.length),
  note: 'Only exterior pixels retained; no live floor, actor, prop or target-overlay pixels modified.',
};
writeFileSync('art/raw/terraces/surround-registration.json', JSON.stringify(report, null, 2));
console.log(report);
