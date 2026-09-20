/** Pack the generated forest shelf into the exact elevated cell envelope. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { FOREST_ROAD } from '../../src/content/maps/combat';
import {
  FOREST_RAISED_SHELF,
  FOREST_RAISED_SHELF_CELLS,
} from '../../src/content/scenes/forestRoad';
import { newImage, pixelAt, readImage, setPixel } from './lib/image';
import { encodeWebp } from './lib/webp';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Provide the generated forest shelf PNG.');
const source = readImage(sourcePath);
if (source.width !== source.height || source.width < 512)
  throw new Error(
    `Expected a square shelf source of at least 512px; received ${source.width}x${source.height}.`,
  );

const raised = new Set(FOREST_RAISED_SHELF_CELLS.map(({ x, y }) => `${x},${y}`));
const projected = (x: number, y: number) => ({
  x: 768 + (x - y) * 64,
  y: (x + y + 1) * 32,
});

const cellAt = (x: number, y: number): boolean => raised.has(`${x},${y}`);

const groupBounds = (cells: readonly { x: number; y: number }[]) => {
  const centers = cells.map(({ x, y }) => projected(x, y));
  const minX = Math.min(...centers.map(({ x }) => x)) - 64;
  const maxX = Math.max(...centers.map(({ x }) => x)) + 64;
  const minY = Math.min(...centers.map(({ y }) => y)) - 32;
  const maxY = Math.max(...centers.map(({ y }) => y)) + 32;
  return {
    x: minX - FOREST_RAISED_SHELF.x,
    y: minY - FOREST_RAISED_SHELF.y,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/** Each generated cluster is registered against its matching projected cell group. */
const groups = [
  {
    cells: FOREST_RAISED_SHELF_CELLS.filter(({ y }) => y <= 3),
    source: { x: 413, y: 113, width: 825, height: 657 },
    material: { x: 533, y: 253, width: 320, height: 180 },
  },
  {
    cells: FOREST_RAISED_SHELF_CELLS.filter(({ y }) => y >= 5),
    source: { x: 42, y: 556, width: 820, height: 592 },
    material: { x: 262, y: 716, width: 320, height: 180 },
  },
].map((group) => ({ ...group, target: groupBounds(group.cells) }));

const groupAt = (x: number, y: number) =>
  groups.find((group) => group.cells.some((cell) => cell.x === x && cell.y === y));

/** Bilinear lookup over the generated shelf clusters, preserving their alpha. */
function sourceColour(x: number, y: number): [number, number, number, number] {
  const samples = [
    pixelAt(source, Math.floor(x), Math.floor(y)),
    pixelAt(source, Math.ceil(x), Math.floor(y)),
    pixelAt(source, Math.floor(x), Math.ceil(y)),
    pixelAt(source, Math.ceil(x), Math.ceil(y)),
  ];
  let red = 0,
    green = 0,
    blue = 0,
    alpha = 0;
  for (const [r, g, b, a] of samples) {
    const opacity = a / 255;
    red += r * opacity;
    green += g * opacity;
    blue += b * opacity;
    alpha += opacity;
  }
  if (alpha <= 0.02) return [0, 0, 0, 0];
  return [
    Math.round(red / alpha),
    Math.round(green / alpha),
    Math.round(blue / alpha),
    Math.round((alpha / samples.length) * 255),
  ];
}

/** Fill a rare anti-aliased gap from the same verified opaque top-material crop. */
function nearestMaterial(
  x: number,
  y: number,
  bounds: { x: number; y: number; width: number; height: number },
): [number, number, number] | null {
  for (let radius = 1; radius <= 32; radius++) {
    for (const [dx, dy] of [
      [radius, 0],
      [-radius, 0],
      [0, radius],
      [0, -radius],
      [radius, radius],
      [radius, -radius],
      [-radius, radius],
      [-radius, -radius],
    ] as const) {
      const sx = Math.round(x + dx);
      const sy = Math.round(y + dy);
      if (
        sx < bounds.x ||
        sy < bounds.y ||
        sx >= bounds.x + bounds.width ||
        sy >= bounds.y + bounds.height
      )
        continue;
      const candidate = pixelAt(source, sx, sy);
      if (candidate[3] > 64) return [candidate[0], candidate[1], candidate[2]];
    }
  }
  return null;
}

const image = newImage(FOREST_RAISED_SHELF.width, FOREST_RAISED_SHELF.height);

for (let py = 0; py < image.height; py++) {
  for (let px = 0; px < image.width; px++) {
    const worldX = FOREST_RAISED_SHELF.x + px + 0.5;
    const worldY = FOREST_RAISED_SHELF.y + py + 0.5;
    const diagonal = (worldX - 768) / 64;
    const sum = worldY / 32;
    const cellX = (diagonal + sum) / 2;
    const cellY = (sum - diagonal) / 2;
    const ix = Math.floor(cellX);
    const iy = Math.floor(cellY);
    const group = cellAt(ix, iy) ? groupAt(ix, iy) : undefined;
    if (!group) continue;

    // Register each generated cluster to its own projected L-shaped footprint;
    // sharing one crop across both groups creates detached slivers and leaves
    // portions of the authored elevation showing through.
    const u = (worldX - (FOREST_RAISED_SHELF.x + group.target.x)) / group.target.width;
    const v = (worldY - (FOREST_RAISED_SHELF.y + group.target.y)) / group.target.height;
    const materialX = group.material.x + u * group.material.width;
    const materialY = group.material.y + v * group.material.height;
    const material = sourceColour(materialX, materialY);
    const fallback =
      material[3] > 0
        ? ([material[0], material[1], material[2]] as const)
        : nearestMaterial(materialX, materialY, group.material);
    if (!fallback) continue;

    let [red, green, blue] = fallback;
    const fx = cellX - ix;
    const fy = cellY - iy;
    const exposedEdge = (!cellAt(ix + 1, iy) && fx > 0.74) || (!cellAt(ix, iy + 1) && fy > 0.74);
    if (exposedEdge) {
      const rimX = group.source.x + u * group.source.width;
      const rimY = group.source.y + v * group.source.height;
      const rim = sourceColour(rimX, rimY);
      if (rim[3] > 0.55) {
        red = Math.round(red * 0.28 + rim[0] * 0.72);
        green = Math.round(green * 0.28 + rim[1] * 0.72);
        blue = Math.round(blue * 0.28 + rim[2] * 0.72);
      }
    }
    setPixel(image, px, py, [red, green, blue, 255]);
  }
}

const output = 'public/art/maps/forest-scene/raised-shelf.webp';
mkdirSync('public/art/maps/forest-scene', { recursive: true });
const bytes = await encodeWebp(image, 84, true);
writeFileSync(output, bytes);

const registration = {
  map: FOREST_ROAD.id,
  cells: FOREST_RAISED_SHELF_CELLS,
  exitGap: { x: 19, y: 4 },
  projectedBounds: FOREST_RAISED_SHELF,
  source: sourcePath,
  sourcePixels: [source.width, source.height],
  output: {
    path: output,
    width: image.width,
    height: image.height,
    bytes: bytes.length,
    quality: 84,
  },
  note: 'Generated shelf material is clipped to the authored elevation mask. Collision, elevation and the road exit remain map-owned; no water or grid is painted.',
};
mkdirSync('art/raw/forest', { recursive: true });
writeFileSync(
  'art/raw/forest/raised-shelf-registration.json',
  JSON.stringify(registration, null, 2),
);
console.log(registration);
