/** Register one continuous authored wall, then partition its pixels by ground-depth owner. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { WEST_CELLS, westSurfaces, type Point } from './quarry-west-guide';
import { newImage, pixelAt, readImage, setPixel, writePng } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

const input = process.argv[2];
if (!input) throw new Error('Provide the transparent western structure PNG.');
const source = readImage(input);
let fringe = 0;
for (let y = 0; y < source.height; y++)
  for (let x = 0; x < source.width; x++) {
    const [r, g, b, a] = pixelAt(source, x, y);
    if (a && ((r - b > 100 && g - b > 100) || (r - g > 80 && r - b > 80))) {
      setPixel(source, x, y, [0, 0, 0, 0]);
      fringe++;
    }
  }
const bounds = alphaBounds(source, 64);
if (!bounds) throw new Error('Empty structure');
const art = scaleTo(crop(source, bounds), 1024, 832);
const contains = (poly: readonly Point[], x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a && b && a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
};
const pieces = WEST_CELLS.map(() => newImage(1024, 832));
const surfaces = WEST_CELLS.map(westSurfaces);
let clipped = 0,
  opaque = 0,
  missing = 0;
for (let y = 0; y < art.height; y++)
  for (let x = 0; x < art.width; x++) {
    const wx = 896 + (x + 0.5) / 2,
      wy = -32 + (y + 0.5) / 2;
    let owner = -1;
    for (const [index, faces] of surfaces.entries())
      if (faces.some((face) => contains(face, wx, wy))) owner = index;
    const rgba = pixelAt(art, x, y);
    if (rgba[3] > 64) opaque++;
    const piece = pieces[owner];
    if (piece) {
      if (rgba[3] < 64) missing++;
      setPixel(piece, x, y, rgba);
    } else {
      if (rgba[3] > 64) clipped++;
      setPixel(art, x, y, [0, 0, 0, 0]);
    }
  }
const atlas = newImage(1024, 2048);
let ax = 2,
  ay = 2,
  rowHeight = 0;
const frames = pieces.map((piece, index) => {
  const cell = WEST_CELLS[index],
    rect = alphaBounds(piece);
  if (!cell) throw new Error('Missing registered cell');
  if (!rect)
    return {
      id: `quarry-wall-${cell.x}-${cell.y}`,
      url: 'art/maps/quarry-gate-scene/west-structure.webp',
      sourceRect: { x: 0, y: 0, width: 1, height: 1 },
      x: 768 + (cell.x - cell.y) * 64,
      y: (cell.x + cell.y + 1) * 32,
      width: 0.5,
      height: 0.5,
      footprint: [{ x: cell.x, y: cell.y }],
      depth: { x: cell.x + 0.5, y: cell.y + 0.5 },
      fadeWhenOccluding: true,
      fadeGroup: 'quarry-west-structure',
    };
  if (ax + rect.width + 2 > atlas.width) {
    ax = 2;
    ay += rowHeight + 4;
    rowHeight = 0;
  }
  if (ay + rect.height + 2 > atlas.height) throw new Error('Atlas overflow');
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++)
      setPixel(atlas, ax + x, ay + y, pixelAt(piece, rect.x + x, rect.y + y));
  const entry = {
    id: `quarry-wall-${cell.x}-${cell.y}`,
    url: 'art/maps/quarry-gate-scene/west-structure.webp',
    sourceRect: { x: ax, y: ay, width: rect.width, height: rect.height },
    x: 896 + rect.x / 2,
    y: -32 + rect.y / 2,
    width: rect.width / 2,
    height: rect.height / 2,
    footprint: [{ x: cell.x, y: cell.y }],
    depth: { x: cell.x + 0.5, y: cell.y + 0.5 },
    fadeWhenOccluding: true,
    fadeGroup: 'quarry-west-structure',
  };
  ax += rect.width + 4;
  rowHeight = Math.max(rowHeight, rect.height);
  return entry;
});
const packed = crop(atlas, { x: 0, y: 0, width: atlas.width, height: ay + rowHeight + 2 });
const bytes = await encodeWebp(packed, 88, true);
if (bytes.length > 240 * 1024) throw new Error(`Western proof exceeds 240KiB: ${bytes.length}`);
mkdirSync('art/raw/quarry-west', { recursive: true });
writePng('art/raw/quarry-west/registered.png', art);
writePng('art/raw/quarry-west/atlas.png', packed);
writeFileSync('public/art/maps/quarry-gate-scene/west-structure.webp', bytes);
writeFileSync('art/raw/quarry-west/frames.json', JSON.stringify(frames, null, 2));
writeFileSync(
  'src/content/scenes/quarryWestFrames.ts',
  `/** Authored continuous wall partitioned by exact ground-depth ownership. */\nexport const QUARRY_WEST_FRAMES = ${JSON.stringify(frames, null, 2)} as const;\n`,
);
console.log({
  source: [source.width, source.height],
  bounds,
  fringe,
  clipped,
  opaque,
  missing,
  atlas: [packed.width, packed.height],
  bytes: bytes.length,
});
