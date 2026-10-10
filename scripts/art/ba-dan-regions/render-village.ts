/**
 * Lay the village's frozen upright geometry out on the repaint's grid, for the regional tools.
 *
 *   node --import tsx scripts/art/ba-dan-regions/render-village.ts <outDir> x y w h [--scale 1.5]
 *
 * The geometry is `art/source/ba-dan-regions/geometry/`: `scene.json` (every scenery entry as it stood
 * when the painting was made: world rectangle, depth, footprint, flags, the sprite file) and `sprites/`
 * (the packed sprites those entries drew). Nothing here reads the game's scene data, so the painting
 * can be split whatever the scene says today.
 *
 * Writes, for the scene-pixel box (x, y, w, h), which should start on even world pixels so the
 * scaled grid is whole:
 *   uprights.png    every upright piece at S times the world scale, bilinear from the full-size paintings
 *   ids.png         RGB, the sorted index + 1 of the front-most piece owning each pixel (0 = none)
 *   front.png       red channel: the strongest alpha of a piece over the owner that did not take ownership
 *   pieces.json     the box and scale, the walkable cells, and one entry per scenery piece in draw order:
 *                   id, depth key, footprint, world rect, the scaled rectangle of its own sprite, and the
 *                   file it is stored in
 *   pieces/NNN.png  each piece's own silhouette at S times the world scale, unobstructed
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { newImage, writePng } from '../lib/image';
import type { Image } from '../lib/image';
import { decodeWebp } from '../lib/webp';

const GEOMETRY = 'art/source/ba-dan-regions/geometry';

const argv = process.argv.slice(2);
const [outDir, ...rest] = argv;
if (!outDir) throw new Error('usage: render-village.ts outDir x y w h [--scale S]');
const scaleAt = rest.indexOf('--scale');
const S = scaleAt >= 0 ? Number(rest[scaleAt + 1]) : 1.5;
const nums = rest
  .filter((_, i) => !(scaleAt >= 0 && (i === scaleAt || i === scaleAt + 1)))
  .map(Number);
const [bx = 0, by = 0, bw = 512, bh = 256] = nums;
if (!nums.every(Number.isFinite)) throw new Error('box must be numbers');
if ((bx * S) % 1 !== 0 || (by * S) % 1 !== 0)
  throw new Error(`box origin (${bx}, ${by}) times ${S} is not whole pixels`);

interface Piece {
  id: string;
  file: string;
  sourceRect: Rect | null;
  x: number;
  y: number;
  width: number;
  height: number;
  flip: boolean;
  depth: { x: number; y: number };
  exterior: boolean;
  fade: boolean;
  footprint: { x: number; y: number }[];
}
const geometry = JSON.parse(readFileSync(`${GEOMETRY}/scene.json`, 'utf8')) as {
  pieces: Piece[];
  walkable: number[][];
};

const cache = new Map<string, Image>();
async function load(file: string): Promise<Image> {
  let image = cache.get(file);
  if (!image) {
    image = await decodeWebp(new Uint8Array(readFileSync(`${GEOMETRY}/sprites/${file}`)));
    cache.set(file, image);
  }
  return image;
}

type Rect = { x: number; y: number; width: number; height: number };
type Rgba = [number, number, number, number];

function bilinear(source: Image, rect: Rect, fx: number, fy: number): Rgba {
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const acc = [0, 0, 0, 0];
  for (const [ox, oy, w] of [
    [0, 0, (1 - tx) * (1 - ty)],
    [1, 0, tx * (1 - ty)],
    [0, 1, (1 - tx) * ty],
    [1, 1, tx * ty],
  ] as const) {
    const sx = rect.x + Math.max(0, Math.min(rect.width - 1, x0 + ox));
    const sy = rect.y + Math.max(0, Math.min(rect.height - 1, y0 + oy));
    const s = (sy * source.width + sx) * 4;
    const a = (source.data[s + 3] ?? 0) / 255;
    acc[0]! += (source.data[s] ?? 0) * a * w;
    acc[1]! += (source.data[s + 1] ?? 0) * a * w;
    acc[2]! += (source.data[s + 2] ?? 0) * a * w;
    acc[3]! += a * w;
  }
  const a = acc[3]!;
  return a <= 0 ? [0, 0, 0, 0] : [acc[0]! / a, acc[1]! / a, acc[2]! / a, a * 255];
}

mkdirSync(`${outDir}/pieces`, { recursive: true });

// ---- uprights, per-piece sprites and the owner map ----
const lw = Math.round(bw * S);
const lh = Math.round(bh * S);
const layer = newImage(lw, lh);
const owner = new Int32Array(lw * lh); // index + 1
const ownerStrong = new Uint8Array(lw * lh);
// The strongest alpha (0-255) of a piece drawn over the owner without taking ownership.
const front = new Uint8Array(lw * lh);
const sorted = [...geometry.pieces].sort((a, b) => a.depth.x + a.depth.y - (b.depth.x + b.depth.y));
const manifest: unknown[] = [];

for (const [index, piece] of sorted.entries()) {
  const source = await load(piece.file);
  const rect = piece.sourceRect ?? { x: 0, y: 0, width: source.width, height: source.height };
  // The piece's own sprite on the village's scaled grid; it may run beyond the box.
  const sx0 = Math.floor((piece.x - bx) * S);
  const sy0 = Math.floor((piece.y - by) * S);
  const sx1 = Math.ceil((piece.x + piece.width - bx) * S);
  const sy1 = Math.ceil((piece.y + piece.height - by) * S);
  const sw = sx1 - sx0;
  const sh = sy1 - sy0;
  const sprite = newImage(sw, sh);
  let any = false;
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const u = ((sx0 + x + 0.5) / S + bx - piece.x) / piece.width;
      const v = ((sy0 + y + 0.5) / S + by - piece.y) / piece.height;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const fx = (piece.flip ? 1 - u : u) * rect.width;
      const fy = v * rect.height;
      const rgba = bilinear(source, rect, fx - 0.5, fy - 0.5);
      if (rgba[3] <= 0) continue;
      any = true;
      sprite.data.set(
        [Math.round(rgba[0]), Math.round(rgba[1]), Math.round(rgba[2]), Math.round(rgba[3])],
        (y * sw + x) * 4,
      );
      const lx = sx0 + x;
      const ly = sy0 + y;
      if (lx < 0 || ly < 0 || lx >= lw || ly >= lh) continue;
      const a = rgba[3] / 255;
      const d = (ly * lw + lx) * 4;
      const below = (layer.data[d + 3] ?? 0) / 255;
      const out = a + below * (1 - a);
      for (let c = 0; c < 3; c++)
        layer.data[d + c] = Math.round(
          ((rgba[c] ?? 0) * a + (layer.data[d + c] ?? 0) * below * (1 - a)) / out,
        );
      layer.data[d + 3] = Math.round(out * 255);
      const o = ly * lw + lx;
      const strong = a >= 0.5;
      if (strong || !ownerStrong[o]) {
        owner[o] = index + 1;
        ownerStrong[o] = strong ? 1 : 0;
        front[o] = 0;
      } else front[o] = Math.max(front[o] ?? 0, Math.round(a * 255));
    }
  const file = `pieces/${String(index).padStart(3, '0')}.png`;
  if (any) writePng(`${outDir}/${file}`, sprite);
  manifest.push({
    index,
    id: piece.id,
    file: piece.file,
    exterior: piece.exterior,
    flip: piece.flip,
    fade: piece.fade,
    depth: piece.depth,
    depthKey: piece.depth.x + piece.depth.y,
    footprint: piece.footprint,
    world: { x: piece.x, y: piece.y, width: piece.width, height: piece.height },
    sprite: any ? { file, x: sx0, y: sy0, width: sw, height: sh } : null,
  });
}
writePng(`${outDir}/uprights.png`, layer);

const ids = newImage(lw, lh);
for (let i = 0; i < lw * lh; i++) {
  const v = owner[i] ?? 0;
  ids.data.set([v & 255, (v >> 8) & 255, (v >> 16) & 255, 255], i * 4);
}
writePng(`${outDir}/ids.png`, ids);
const frontImage = newImage(lw, lh);
for (let i = 0; i < lw * lh; i++) frontImage.data.set([front[i] ?? 0, 0, 0, 255], i * 4);
writePng(`${outDir}/front.png`, frontImage);
writeFileSync(
  `${outDir}/pieces.json`,
  JSON.stringify({
    box: { x: bx, y: by, width: bw, height: bh },
    scale: S,
    pieces: manifest,
    walkable: geometry.walkable,
  }),
);
console.log(`village ${bw}x${bh} at (${bx},${by}) -> ${lw}x${lh}, ${sorted.length} pieces`);
