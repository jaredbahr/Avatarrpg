/**
 * Composite Ba Dan's ground plates in draw order into one PNG, to look at the
 * result a player sees rather than one plate at a time.
 *
 *   node --import tsx scripts/art/ba-dan-ground-composite.ts out.png x y w h [--scenery] [--exterior] [--relight] [--grid]
 *
 * The box is in scene pixels. `--scenery` also draws the upright pieces
 * (nearest-neighbour, depth order) so the ground is judged in context;
 * `--relight` runs the shared light over the ground first (what plates baked with
 * it look like, without regenerating them); with scenery the runtime's own
 * contact shadow is laid over the ground as the game does, then the renderer's
 * ground joins (the neighbour-coloured wedges `paintTileSeams` draws over a
 * partial scene; `--no-seams` leaves them off). `--exterior` adds the surround
 * walls and rim pieces beyond the board. `--grid` draws the tile grid last, one
 * pixel wide, so a piece's wall feet and eaves can be judged against the tile lines.
 * `--layer out.png --scale S` draws the upright pieces instead as a separate transparent
 * layer at S times the world scale, filtered bilinearly from their full-size paintings
 * (the game shows world pixels at 1.5 screen pixels), for the review composites.
 */
import { readFileSync } from 'node:fs';
import type { SceneImage } from '../../src/core/types';
import { BA_DAN_SCENE } from '../../src/content/scenes/baDan';
import { imageSize, newImage, readPng, setPixel, writePng } from './lib/image';
import type { Image } from './lib/image';
import { decodeWebp } from './lib/webp';
import { MAP_MARGIN_COLORS } from '../../src/render/palettes';
import { litRgb, withRuntimeContact, withRuntimeSeams } from './ba-dan-village-light';

const [out, ...rest] = process.argv.slice(2);
const nums = rest.filter((a) => /^[\d.-]+$/.test(a) && !isNaN(Number(a))).map(Number);
if (rest.includes('--scale'))
  nums.splice(nums.indexOf(Number(rest[rest.indexOf('--scale') + 1])), 1);
const [bx = 0, by = 0, bw = 512, bh = 256] = nums;
const withExterior = rest.includes('--exterior');
const relight = rest.includes('--relight');
const withGrid = rest.includes('--grid');
const withSeams = !rest.includes('--no-seams');
const layerAt = rest.indexOf('--layer');
const layerOut = layerAt >= 0 ? rest[layerAt + 1] : undefined;
const scaleAt = rest.indexOf('--scale');
const layerScale = scaleAt >= 0 ? Number(rest[scaleAt + 1]) : 1;
const withScenery = rest.includes('--scenery') || withExterior || layerOut !== undefined;
if (!out) throw new Error('usage: out.png x y w h [--scenery] [--exterior]');

/** `GROUND_ROOT` points at another tree's `public/`, to composite an earlier commit's plates. */
const root = process.env.GROUND_ROOT ?? 'public';
const cache = new Map<string, Image>();
async function load(url: string): Promise<Image> {
  let image = cache.get(url);
  if (!image) {
    const path = `${root}/${url}`;
    const bytes = new Uint8Array(readFileSync(path));
    image = imageSize(bytes)?.format === 'webp' ? await decodeWebp(bytes) : readPng(path);
    cache.set(url, image);
  }
  return image;
}

const canvas = newImage(bw, bh);
// The page behind the ground is the scene's margin colour, as the renderer fills it.
const margin = BA_DAN_SCENE.marginTone ? MAP_MARGIN_COLORS[BA_DAN_SCENE.marginTone] : '#222222';
const marginRgb = [1, 3, 5].map((i) => parseInt(margin.slice(i, i + 2), 16));
for (let i = 0; i < bw * bh; i++) canvas.data.set([...marginRgb, 255], i * 4);

type Rect = { x: number; y: number; width: number; height: number };

function nearest(
  source: Image,
  rect: Rect,
  fx: number,
  fy: number,
): [number, number, number, number] {
  const sx = Math.min(rect.x + rect.width - 1, rect.x + Math.floor(fx));
  const sy = Math.min(rect.y + rect.height - 1, rect.y + Math.floor(fy));
  const s = (sy * source.width + sx) * 4;
  return [
    source.data[s] ?? 0,
    source.data[s + 1] ?? 0,
    source.data[s + 2] ?? 0,
    source.data[s + 3] ?? 0,
  ];
}

/** Bilinear with premultiplied alpha, clamped to the source rectangle. */
function bilinear(
  source: Image,
  rect: Rect,
  fx: number,
  fy: number,
): [number, number, number, number] {
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

async function draw(piece: SceneImage & { flip?: boolean }, ground = false): Promise<void> {
  if (
    piece.x >= bx + bw ||
    piece.y >= by + bh ||
    piece.x + piece.width <= bx ||
    piece.y + piece.height <= by
  )
    return;
  const source = await load(piece.url);
  const rect = piece.sourceRect ?? { x: 0, y: 0, width: source.width, height: source.height };
  for (
    let y = Math.max(by, Math.floor(piece.y));
    y < Math.min(by + bh, piece.y + piece.height);
    y++
  )
    for (
      let x = Math.max(bx, Math.floor(piece.x));
      x < Math.min(bx + bw, piece.x + piece.width);
      x++
    ) {
      const u = (x + 0.5 - piece.x) / piece.width;
      const v = (y + 0.5 - piece.y) / piece.height;
      const fx = (piece.flip ? 1 - u : u) * rect.width;
      const fy = v * rect.height;
      // Ground plates that the scene stretches (the canal page) are filtered as
      // the game filters them; everything else is a whole-number or 1:1 blit.
      const rgba =
        ground && Math.abs(piece.width - rect.width) > 0.5
          ? bilinear(source, rect, fx - 0.5, fy - 0.5)
          : nearest(source, rect, fx, fy);
      const a = rgba[3] / 255;
      if (a === 0) continue;
      const d = ((y - by) * bw + (x - bx)) * 4;
      const lit = ground && relight ? litRgb(x + 0.5, y + 0.5, rgba) : null;
      for (let c = 0; c < 3; c++)
        canvas.data[d + c] = Math.round(
          (lit ? (lit[c] ?? 0) : (rgba[c] ?? 0)) * a + (canvas.data[d + c] ?? 0) * (1 - a),
        );
    }
}

for (const piece of BA_DAN_SCENE.ground) await draw(piece, true);
if (withScenery) {
  // The game seats scenery with its own contact ink over the finished ground.
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const d = (y * bw + x) * 4;
      const contact = withRuntimeContact(bx + x + 0.5, by + y + 0.5, [
        canvas.data[d] ?? 0,
        canvas.data[d + 1] ?? 0,
        canvas.data[d + 2] ?? 0,
      ]);
      canvas.data.set(
        withSeams ? withRuntimeSeams(bx + x + 0.5, by + y + 0.5, contact) : contact,
        d,
      );
    }
  const sorted = [...BA_DAN_SCENE.scenery]
    .filter((p) => withExterior || !p.exterior)
    .sort((a, b) => a.depth.x + a.depth.y - (b.depth.x + b.depth.y));
  if (layerOut) {
    // Upright pieces as their own layer, sampled from the full-size painting.
    const S = layerScale;
    const lw = Math.round(bw * S);
    const lh = Math.round(bh * S);
    const layer = newImage(lw, lh);
    for (const piece of sorted) {
      const source = await load(piece.url);
      const rect = piece.sourceRect ?? { x: 0, y: 0, width: source.width, height: source.height };
      const x0 = Math.max(0, Math.floor((piece.x - bx) * S));
      const x1 = Math.min(lw, Math.ceil((piece.x + piece.width - bx) * S));
      const y0 = Math.max(0, Math.floor((piece.y - by) * S));
      const y1 = Math.min(lh, Math.ceil((piece.y + piece.height - by) * S));
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const u = ((x + 0.5) / S + bx - piece.x) / piece.width;
          const v = ((y + 0.5) / S + by - piece.y) / piece.height;
          if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
          const fx = (piece.flip ? 1 - u : u) * rect.width;
          const fy = v * rect.height;
          const rgba = bilinear(source, rect, fx - 0.5, fy - 0.5);
          const a = rgba[3] / 255;
          if (a === 0) continue;
          const d = (y * lw + x) * 4;
          const below = (layer.data[d + 3] ?? 0) / 255;
          const out = a + below * (1 - a);
          for (let c = 0; c < 3; c++)
            layer.data[d + c] = Math.round(
              ((rgba[c] ?? 0) * a + (layer.data[d + c] ?? 0) * below * (1 - a)) / out,
            );
          layer.data[d + 3] = Math.round(out * 255);
        }
    }
    writePng(layerOut, layer);
  } else for (const piece of sorted) await draw(piece);
}
if (withGrid) {
  // Tile (gx, gy) has its back corner at (1024 + (gx - gy) * 64, (gx + gy) * 32).
  const tint = [255, 40, 200];
  const plot = (gx: number, gy: number): void => {
    const x = Math.round(1024 + (gx - gy) * 64) - bx;
    const y = Math.round((gx + gy) * 32) - by;
    if (x < 0 || y < 0 || x >= bw || y >= bh) return;
    const d = (y * bw + x) * 4;
    for (let c = 0; c < 3; c++)
      canvas.data[d + c] = Math.round(0.6 * (tint[c] ?? 0) + 0.4 * (canvas.data[d + c] ?? 0));
  };
  const steps = 64;
  for (let line = -8; line <= 40; line++)
    for (let i = 0; i <= 40 * steps; i++) {
      const t = i / steps - 8;
      plot(line, t);
      plot(t, line);
    }
}
for (let i = 0; i < bw * bh; i++)
  setPixel(canvas, i % bw, Math.floor(i / bw), [...canvas.data.subarray(i * 4, i * 4 + 3), 255]);
writePng(out, canvas);
