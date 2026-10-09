/**
 * Diagnose every Ba Dan scene image whose destination box covers a point.
 *
 *   npx tsx scripts/art/ba-dan-which-plate.ts --tile 10,5
 *   npx tsx scripts/art/ba-dan-which-plate.ts --point 1344,512
 *
 * Tile mode reports the diamond centre plus samples three scene pixels to
 * either side of each of its four edges. Point mode reports the requested
 * point and its four axis neighbours. Entries are printed in renderer draw
 * order: ground registration order, then upright scenery depth order.
 */
import { readFileSync } from 'node:fs';
import type { SceneImage, SceneScenery } from '../../src/core/types';
import { BA_DAN_SCENE } from '../../src/content/scenes/baDan';
import { imageSize, pixelAt, readPng } from './lib/image';
import type { Image } from './lib/image';
import { decodeWebp } from './lib/webp';

interface Sample {
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

const value = (flag: string): string | undefined => {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
};

function pair(raw: string | undefined, flag: string): readonly [number, number] | null {
  if (raw === undefined) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part)))
    throw new Error(`${flag} expects two comma-separated numbers.`);
  return [parts[0] ?? 0, parts[1] ?? 0];
}

const tile = pair(value('--tile'), '--tile');
const point = pair(value('--point'), '--point');
if ((tile === null) === (point === null))
  throw new Error('Pass exactly one of --tile x,y or --point sceneX,sceneY.');

function tileSamples(x: number, y: number): Sample[] {
  const centre = { x: 1024 + (x - y) * 64, y: (x + y + 1) * 32 };
  // Edge midpoints relative to the centre. The inward/outward direction is
  // the corresponding unit normal, rounded to integer scene pixels.
  const edges = [
    { label: 'north-west', x: -32, y: -16, nx: -1, ny: -2 },
    { label: 'north-east', x: 32, y: -16, nx: 1, ny: -2 },
    { label: 'south-east', x: 32, y: 16, nx: 1, ny: 2 },
    { label: 'south-west', x: -32, y: 16, nx: -1, ny: 2 },
  ] as const;
  const samples: Sample[] = [{ label: 'centre', ...centre }];
  for (const edge of edges) {
    const length = Math.hypot(edge.nx, edge.ny);
    const dx = Math.round((3 * edge.nx) / length);
    const dy = Math.round((3 * edge.ny) / length);
    samples.push(
      { label: `${edge.label} -3`, x: centre.x + edge.x - dx, y: centre.y + edge.y - dy },
      { label: `${edge.label} +3`, x: centre.x + edge.x + dx, y: centre.y + edge.y + dy },
    );
  }
  return samples;
}

const samples = tile
  ? tileSamples(tile[0], tile[1])
  : [
      { label: 'point', x: point?.[0] ?? 0, y: point?.[1] ?? 0 },
      { label: 'left 3', x: (point?.[0] ?? 0) - 3, y: point?.[1] ?? 0 },
      { label: 'right 3', x: (point?.[0] ?? 0) + 3, y: point?.[1] ?? 0 },
      { label: 'up 3', x: point?.[0] ?? 0, y: (point?.[1] ?? 0) - 3 },
      { label: 'down 3', x: point?.[0] ?? 0, y: (point?.[1] ?? 0) + 3 },
    ];

const publicPath = (url: string): string => `public/${url}`;
const decoded = new Map<string, Promise<Image>>();
function image(url: string): Promise<Image> {
  let pending = decoded.get(url);
  if (!pending) {
    const path = publicPath(url);
    const bytes = new Uint8Array(readFileSync(path));
    const format = imageSize(bytes)?.format;
    pending = format === 'webp' ? decodeWebp(bytes) : Promise.resolve(readPng(path));
    decoded.set(url, pending);
  }
  return pending;
}

function category(piece: SceneImage, ground: boolean): string {
  if (!ground) return 'scenery';
  if (piece.url.includes('exterior-apron')) return 'apron';
  if (piece.url.includes('edge-water'))
    return piece.sourceRect?.y === 0 ? 'bank/water' : 'edge-water';
  if (piece.url.includes('garden-')) return 'ground';
  return 'plate';
}

function sourcePixel(piece: SceneImage, source: Image, sample: Sample): readonly number[] {
  const u = (sample.x - piece.x) / piece.width;
  const v = (sample.y - piece.y) / piece.height;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return [0, 0, 0, 0];
  const rect = piece.sourceRect ?? { x: 0, y: 0, width: source.width, height: source.height };
  const flip = 'flip' in piece && piece.flip;
  const sx = rect.x + Math.floor((flip ? 1 - u : u) * rect.width);
  const sy = rect.y + Math.floor(v * rect.height);
  return pixelAt(source, Math.min(rect.x + rect.width - 1, sx), sy);
}

const scenery = [...BA_DAN_SCENE.scenery].sort(
  (a, b) => (a.depth.x + a.depth.y) * 32 - (b.depth.x + b.depth.y) * 32,
);
const entries: readonly { piece: SceneImage; ground: boolean; name: string }[] = [
  ...BA_DAN_SCENE.ground.map((piece) => ({
    piece,
    ground: true,
    name: piece.url.split('/').at(-1) ?? piece.url,
  })),
  ...scenery.map((piece: SceneScenery) => ({ piece, ground: false, name: piece.id })),
];

console.log(tile ? `tile ${tile.join(',')}` : `point ${point?.join(',')}`);
console.log(samples.map((sample) => `${sample.label}=(${sample.x},${sample.y})`).join('  '));
let order = 0;
for (const entry of entries) {
  const covered = samples.some(
    (sample) =>
      sample.x >= entry.piece.x &&
      sample.x < entry.piece.x + entry.piece.width &&
      sample.y >= entry.piece.y &&
      sample.y < entry.piece.y + entry.piece.height,
  );
  if (!covered) continue;
  const source = await image(entry.piece.url);
  const rgba = samples.map(
    (sample) => `${sample.label}=[${sourcePixel(entry.piece, source, sample).join(',')}]`,
  );
  console.log(
    `${String(order).padStart(2, '0')} ${category(entry.piece, entry.ground)} ${entry.name}`,
  );
  console.log(
    `   box=(${entry.piece.x},${entry.piece.y},${entry.piece.width},${entry.piece.height}) ${rgba.join('  ')}`,
  );
  order++;
}
