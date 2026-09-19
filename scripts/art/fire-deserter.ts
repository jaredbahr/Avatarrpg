/** Review-only packing: no manifest or shipped asset mutations.
 * node --import tsx scripts/art/fire-deserter.ts [SOURCE] [OUTPUT_DIRECTORY]
 */
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { PNG } from 'pngjs';
import { newImage, readPng, writePng, pixelAt, setPixel, flatten } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleBy } from './lib/scale';
import { BASELINE, MARGIN, placeOnBaseline } from './lib/align';
import { splitGrid } from './split-sheet';
import { main as pack } from './pack';

const sourcePath = process.argv[2] ?? 'assets/reference/fire-deserter/combat-source.png';
const out = process.argv[3] ?? '.shots/fire-deserter-review';
const key = 'unit.enemy.deserter';
const poses = [
  'idle/0',
  'idle/1',
  'walk/0',
  'walk/1',
  'cast/0',
  'cast/1',
  'cast/2',
  'hit/0',
  'ko/0',
];
const source = readPng(sourcePath);
const cells = splitGrid(source, 3, 3);
const idle = cells[0] && alphaBounds(cells[0]);
if (!idle || idle.height < 151) throw new Error('Insufficient standing source resolution');
const scale = 151 / idle.height;
const scaled = cells.map((cell) => {
  const bounds = alphaBounds(cell);
  if (!bounds) throw new Error('Empty source pose');
  return scaleBy(crop(cell, bounds), scale);
});
const walkSourcePath = 'assets/reference/fire-deserter/walk-source.png';
const walkSource = readPng(walkSourcePath);
const walkCells = splitGrid(walkSource, 2, 2);
// Only the right column has genuinely alternating planted legs. The left
// column repeats one lead leg and is deliberately not included.
const selectedWalkCells = [1, 3].map((index) => {
  const cell = walkCells[index];
  if (!cell) throw new Error('Missing walking source pose');
  const bounds = alphaBounds(cell);
  if (!bounds) throw new Error('Empty walking source pose');
  return crop(cell, bounds);
});
const walkScale = 151 / Math.max(...selectedWalkCells.map((cell) => cell.height));
for (const [index, cell] of selectedWalkCells.entries())
  scaled[index + 2] = scaleBy(cell, walkScale);
const width = Math.max(128, ...scaled.map((cell) => cell.width + 2 * MARGIN));
let height = 192;
while (Math.round(height * BASELINE) < Math.max(...scaled.map((cell) => cell.height)) + MARGIN)
  height++;
const contact = newImage(width * 3, height * 3);
const report = [];
for (const [index, pose] of poses.entries()) {
  const cell = scaled[index];
  if (!cell) throw new Error(`Missing ${pose}`);
  const placed = placeOnBaseline(cell, width, height);
  if (placed.problems.length) throw new Error(placed.problems.join('; '));
  const path = join(out, 'normalised', key, `${pose}.png`);
  mkdirSync(dirname(path), { recursive: true });
  writePng(path, placed.image);
  report.push({ pose, bounds: alphaBounds(placed.image) });
  const left = (index % 3) * width,
    top = Math.floor(index / 3) * height;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      setPixel(contact, left + x, top + y, pixelAt(placed.image, x, y));
}
if (
  pack([
    '--unit',
    key,
    '--in',
    join(out, 'normalised'),
    '--out',
    join(out, 'package'),
    '--name',
    'deserter',
  ]) !== 0
)
  throw new Error('Packing failed');
const pngPath = join(out, 'package', 'deserter.png');
const original = readFileSync(pngPath);
const decoded = PNG.sync.read(original);
const lossless = PNG.sync.write(decoded, { deflateLevel: 9, deflateStrategy: 0 });
const packed = lossless.length < original.length ? lossless : original;
writeFileSync(pngPath, packed);
writePng(join(out, 'contact-128.png'), contact);
writePng(join(out, 'contact-96.png'), scaleBy(contact, 0.75));
writePng(join(out, 'contact-64.png'), scaleBy(contact, 0.5));
// An opaque review background makes generated hidden RGB irrelevant and shows
// the same ordinary alpha compositing that the runtime applies over terrain.
for (const tileSize of [128, 96, 64])
  writePng(
    join(out, `contact-${tileSize}-on-grey.png`),
    flatten(scaleBy(contact, tileSize / 128), '#808078'),
  );
const measurements = {
  source: sourcePath,
  sourceSize: { width: source.width, height: source.height },
  sourceSha256: createHash('sha256').update(readFileSync(sourcePath)).digest('hex'),
  frameSize: { width, height },
  pixelsPerTile: 128,
  footprint: { w: 1, h: 1 },
  anchor: { x: 0.5, y: 0.85 },
  sourceScale: scale,
  walkingSource: walkSourcePath,
  walkingSourceSha256: createHash('sha256').update(readFileSync(walkSourcePath)).digest('hex'),
  walkingSourceScale: walkScale,
  walkingSelectedCells: [1, 3],
  poses: report,
  pngBytesBeforeLosslessPass: original.length,
  pngBytesStrategyZero: lossless.length,
  pngBytes: packed.length,
  jsonBytes: statSync(join(out, 'package', 'deserter.json')).size,
  atlasSize: { width: decoded.width, height: decoded.height },
  unusedFrameSlots: (decoded.width * decoded.height) / (width * height) - poses.length,
  status:
    'Source review only. Distinct planted legs; arms remain near-static. Alpha compositing checked. Runtime gait unreviewed. No manifest or budget integration.',
};
writeFileSync(join(out, 'measurements.json'), `${JSON.stringify(measurements, null, 2)}\n`);
console.log(JSON.stringify(measurements, null, 2));
