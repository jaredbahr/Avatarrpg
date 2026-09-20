/** Assemble local quarry-ground regions from reusable authored material panels. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { QUARRY_GATE } from '../../src/content/maps/combat';
import { newImage, pixelAt, readImage, setPixel } from './lib/image';
import { alphaBounds, crop } from './lib/trim';
import { scaleTo } from './lib/scale';
import { encodeWebp } from './lib/webp';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Provide the authored six-panel quarry material source.');

const source = readImage(sourcePath);
const panelSize = source.width / 3;
if (!Number.isInteger(panelSize) || source.height !== panelSize * 2)
  throw new Error('Expected a 3 by 2 sheet of equal square material panels.');

const inset = 24;
const panel = (index: number) =>
  crop(source, {
    x: (index % 3) * panelSize + inset,
    y: Math.floor(index / 3) * panelSize + inset,
    width: panelSize - inset * 2,
    height: panelSize - inset * 2,
  });
const materials = [0, 1, 2].map((index) => scaleTo(panel(index), 128, 128));
const transitions = [3, 4, 5].map((index) => scaleTo(panel(index), 128, 128));

type GroundClass = 'earth' | 'road' | 'limestone';
type RegionName = 'earth-west' | 'earth-east' | 'road' | 'limestone';
const groundClass = (x: number, y: number): GroundClass => {
  const key = QUARRY_GATE.rows[y]?.[x] ?? '.';
  return key === '=' ? 'road' : key === '^' || key === 'o' ? 'limestone' : 'earth';
};
const regionAt = (x: number, y: number): RegionName | null => {
  const key = QUARRY_GATE.rows[y]?.[x];
  if (!key) return null;
  if (key === '=') return 'road';
  if (key === 'o' || key === '^') return 'limestone';
  return x < 10 ? 'earth-west' : 'earth-east';
};
const regionNames = ['earth-west', 'earth-east', 'road', 'limestone'] as const;
const materialIndex: Record<GroundClass, number> = { earth: 0, road: 1, limestone: 2 };
const transitionIndex = (a: GroundClass, b: GroundClass) =>
  (a === 'earth' && b === 'road') || (a === 'road' && b === 'earth')
    ? 0
    : (a === 'earth' && b === 'limestone') || (a === 'limestone' && b === 'earth')
      ? 1
      : null;
const mirror = (value: number, size: number) => {
  const period = ((value % (size * 2)) + size * 2) % (size * 2);
  return period < size ? period : size * 2 - period - 1;
};

const page = { x: -128, y: -192, width: 2304, height: 1280 };
const images = new Map(regionNames.map((name) => [name, newImage(page.width, page.height)]));
for (let py = 0; py < page.height; py++)
  for (let px = 0; px < page.width; px++) {
    const wx = px + 0.5 + page.x,
      wy = py + 0.5 + page.y;
    const gx = ((wx - 768) / 64 + wy / 32) / 2;
    const gy = (wy / 32 - (wx - 768) / 64) / 2;
    const x = Math.floor(gx),
      y = Math.floor(gy);
    const name = regionAt(x, y);
    if (!name) continue;
    const image = images.get(name);
    if (!image) throw new Error(`Unknown local ground region ${name}.`);
    const current = groundClass(x, y);
    const material = materials[materialIndex[current]];
    if (!material) throw new Error('Missing authored material panel.');
    let rgba = pixelAt(material, mirror(px, material.width), mirror(py, material.height));
    const lx = gx - x,
      ly = gy - y;
    const edges = [
      { x: x - 1, y, t: (lx + 0.15) / 0.3, along: gy, forward: false },
      { x: x + 1, y, t: (lx - 0.85) / 0.3, along: gy, forward: true },
      { x, y: y - 1, t: (ly + 0.15) / 0.3, along: gx, forward: false },
      { x, y: y + 1, t: (ly - 0.85) / 0.3, along: gx, forward: true },
    ];
    for (const edge of edges) {
      if (edge.t < 0 || edge.t > 1) continue;
      const transition = transitionIndex(current, groundClass(edge.x, edge.y));
      if (transition === null) continue;
      const field = transitions[transition];
      if (!field) throw new Error('Missing authored transition panel.');
      const dirtToOther = current === 'earth' ? edge.forward : !edge.forward;
      const t = dirtToOther ? edge.t : 1 - edge.t;
      rgba = pixelAt(
        field,
        Math.min(127, Math.max(0, Math.floor(t * 128))),
        mirror(Math.floor(edge.along * 128), 128),
      );
      break;
    }
    setPixel(image, px, py, [rgba[0], rgba[1], rgba[2], 255]);
  }

/**
 * A clipped alpha edge filters against the procedural base during oblique
 * scaling. Extend the authored edge by two world pixels so adjacent regions
 * overlap instead of exposing that gray fallback seam; it changes no map cell.
 */
function bleedEdges(image: ReturnType<typeof newImage>, pixels = 2): void {
  for (let pass = 0; pass < pixels; pass++) {
    const previous = new Uint8Array(image.data);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const index = (y * image.width + x) * 4;
        if ((previous[index + 3] ?? 0) !== 0) continue;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ] as const) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height) continue;
          const neighbor = (ny * image.width + nx) * 4;
          if ((previous[neighbor + 3] ?? 0) === 0) continue;
          image.data[index] = previous[neighbor] ?? 0;
          image.data[index + 1] = previous[neighbor + 1] ?? 0;
          image.data[index + 2] = previous[neighbor + 2] ?? 0;
          image.data[index + 3] = previous[neighbor + 3] ?? 255;
          break;
        }
      }
  }
}

const outDir = 'public/art/maps/quarry-gate-scene';
mkdirSync(outDir, { recursive: true });
const regions = [];
let totalBytes = 0;
for (const [name, image] of images) {
  bleedEdges(image);
  const bounds = alphaBounds(image);
  if (!bounds) throw new Error(`Empty local ground region ${name}.`);
  const bytes = await encodeWebp(crop(image, bounds), 82, true);
  writeFileSync(`${outDir}/${name}.webp`, bytes);
  totalBytes += bytes.length;
  regions.push({
    name,
    url: `art/maps/quarry-gate-scene/${name}.webp`,
    x: page.x + bounds.x,
    y: page.y + bounds.y,
    width: bounds.width,
    height: bounds.height,
    bytes: bytes.length,
  });
}
if (totalBytes > 240 * 1024)
  throw new Error(`Modular quarry ground exceeds 240KiB: ${totalBytes}.`);
mkdirSync('art/raw/quarry-gate', { recursive: true });
writeFileSync(
  'art/raw/quarry-gate/modular-ground-registration.json',
  JSON.stringify({ source: sourcePath, page, regions, totalBytes }, null, 2),
);
console.log({ source: sourcePath, regions, totalBytes });
