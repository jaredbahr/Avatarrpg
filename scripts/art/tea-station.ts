/** Review-only tea-station normalization in the existing square prop contract. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { placeOnBaseline } from './lib/align';
import { flatten, newImage, pixelAt, readPng, setPixel, writePng } from './lib/image';
import { scaleBy } from './lib/scale';
import { alphaBounds, crop } from './lib/trim';

const sourcePath = 'assets/reference/tea-station/worktable-source.png';
const out = process.argv[2] ?? '.shots/tea-station-review';
const source = readPng(sourcePath);
const bounds = alphaBounds(source);
if (!bounds) throw new Error('Empty tea-station source');
if (!source.data.some((value, index) => index % 4 === 3 && value === 0))
  throw new Error('Tea station requires genuine transparent alpha');
// The discovery inherits NPC scale 1.5. Size the painted object, preserving
// the shared square frame/foot line and all existing interaction geometry.
const factor = Math.min(1, 220 / bounds.width, 165 / bounds.height);
const placed = placeOnBaseline(scaleBy(crop(source, bounds), factor), 256, 256);
if (placed.problems.length) throw new Error(placed.problems.join('; '));
mkdirSync(out, { recursive: true });
const outputPath = join(out, 'tea-station.png');
writePng(outputPath, placed.image);
const sen = readPng('public/art/npcs/gao.png');
const comparison = newImage(512, 256);
for (let y = 0; y < 256; y++)
  for (let x = 0; x < 256; x++) {
    setPixel(comparison, x, y, pixelAt(placed.image, x, y));
    setPixel(comparison, x + 256, y, pixelAt(sen, x, y));
  }
for (const tileSize of [64, 96])
  writePng(
    join(out, `tea-beside-sen-${tileSize}.png`),
    flatten(scaleBy(comparison, (tileSize * 1.5) / 256), '#88867a'),
  );
writePng(join(out, 'tea-beside-sen-source.png'), flatten(comparison, '#88867a'));
const propBytes = readdirSync('public/art/props').reduce(
  (sum, name) =>
    sum + (name === 'tea-station.png' ? 0 : statSync(join('public/art/props', name)).size),
  0,
);
const bytes = statSync(outputPath).size;
const normalizedBounds = alphaBounds(placed.image);
const report = {
  base: 'ff243ab',
  source: sourcePath,
  sourceSize: { width: source.width, height: source.height },
  sourceSha256: createHash('sha256').update(readFileSync(sourcePath)).digest('hex'),
  sourceBounds: bounds,
  normalizedBounds,
  senBounds: alphaBounds(sen),
  frame: { width: 256, height: 256, footLine: 0.85 },
  inheritedMarkerScale: 1.5,
  pngBytes: bytes,
  originalPropsBytes: propBytes,
  projectedPropsBytes: propBytes + bytes,
  propsBudgetBytes: 4 * 1024 * 1024,
  outputSha256: createHash('sha256').update(readFileSync(outputPath)).digest('hex'),
  status:
    'Source checkpoint only; no runtime registration. Static comparisons are not gameplay captures.',
};
writeFileSync(join(out, 'measurements.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
