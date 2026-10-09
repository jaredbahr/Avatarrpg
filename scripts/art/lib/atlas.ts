/**
 * Shelf packing for the village's sprite atlases: items sorted tallest first (or, with
 * `tallestFirst` false, in the order given), laid left to right in rows no wider than `width`,
 * `gutter` pixels apart. Each sprite's edge pixels are replicated
 * into its gutter, which is what clamp-to-edge sampling would read, so a filtered edge (or a
 * strip of a long wall cut at a join) never picks up a neighbour or a seam of clear pixels.
 */
import { newImage } from './image';
import type { Image } from './image';

export interface Item {
  readonly name: string;
  readonly image: Image;
}
export interface Placed {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function shelfPack(
  items: readonly Item[],
  width: number,
  gutter = 2,
  tallestFirst = true,
): { placed: Placed[]; height: number } {
  const order = tallestFirst
    ? [...items].sort((a, b) => b.image.height - a.image.height || a.name.localeCompare(b.name))
    : items;
  const placed: Placed[] = [];
  let x = gutter;
  let y = gutter;
  let row = 0;
  for (const { name, image } of order) {
    if (x + image.width + gutter > width) {
      x = gutter;
      y += row + gutter;
      row = 0;
    }
    placed.push({ name, x, y, width: image.width, height: image.height });
    x += image.width + gutter;
    row = Math.max(row, image.height);
  }
  return { placed, height: y + row + gutter };
}

export function composeAtlas(
  items: readonly Item[],
  placed: readonly Placed[],
  width: number,
  height: number,
  gutter = 2,
): Image {
  const atlas = newImage(width, height);
  const byName = new Map(items.map((i) => [i.name, i.image]));
  for (const p of placed) {
    const src = byName.get(p.name)!;
    for (let dy = -gutter; dy < p.height + gutter; dy++)
      for (let dx = -gutter; dx < p.width + gutter; dx++) {
        const sx = Math.max(0, Math.min(p.width - 1, dx));
        const sy = Math.max(0, Math.min(p.height - 1, dy));
        const from = (sy * p.width + sx) * 4;
        const to = ((p.y + dy) * width + p.x + dx) * 4;
        atlas.data.set(src.data.subarray(from, from + 4), to);
      }
  }
  return atlas;
}

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * MaxRects, best short side fit, into a fixed `width` by `height` page: every sprite (plus its
 * gutter on all four sides) goes in the free rectangle it leaves the least short side over, tried
 * in the order given. Null when something does not fit. Deterministic: ties take the first
 * rectangle in the list, which is itself ordered by how the page was cut.
 */
export function maxRectsPack(
  items: readonly Item[],
  width: number,
  height: number,
  gutter = 2,
): Placed[] | null {
  let free: FreeRect[] = [{ x: 0, y: 0, width, height }];
  const placed: Placed[] = [];
  for (const { name, image } of items) {
    const w = image.width + 2 * gutter;
    const h = image.height + 2 * gutter;
    let best: FreeRect | null = null;
    let bestShort = Infinity;
    let bestLong = Infinity;
    for (const f of free) {
      if (f.width < w || f.height < h) continue;
      const short = Math.min(f.width - w, f.height - h);
      const long = Math.max(f.width - w, f.height - h);
      if (short < bestShort || (short === bestShort && long < bestLong)) {
        best = f;
        bestShort = short;
        bestLong = long;
      }
    }
    if (!best) return null;
    const used: FreeRect = { x: best.x, y: best.y, width: w, height: h };
    placed.push({
      name,
      x: used.x + gutter,
      y: used.y + gutter,
      width: image.width,
      height: image.height,
    });
    const next: FreeRect[] = [];
    for (const f of free) {
      if (
        used.x >= f.x + f.width ||
        used.x + used.width <= f.x ||
        used.y >= f.y + f.height ||
        used.y + used.height <= f.y
      ) {
        next.push(f);
        continue;
      }
      if (used.x > f.x) next.push({ ...f, width: used.x - f.x });
      if (used.x + used.width < f.x + f.width)
        next.push({ ...f, x: used.x + used.width, width: f.x + f.width - used.x - used.width });
      if (used.y > f.y) next.push({ ...f, height: used.y - f.y });
      if (used.y + used.height < f.y + f.height)
        next.push({ ...f, y: used.y + used.height, height: f.y + f.height - used.y - used.height });
    }
    free = next.filter(
      (a, i) =>
        !next.some(
          (b, j) =>
            i !== j &&
            a.x >= b.x &&
            a.y >= b.y &&
            a.x + a.width <= b.x + b.width &&
            a.y + a.height <= b.y + b.height &&
            (a.x !== b.x || a.y !== b.y || a.width !== b.width || a.height !== b.height || j < i),
        ),
    );
  }
  return placed;
}

/**
 * The smallest page, by area, `maxRectsPack` fills: widths in steps of 32 up to `maxSide`, each
 * with its shortest height (steps of 2), sprites tallest first. Ties take the narrower page.
 */
export function packTight(
  items: readonly Item[],
  maxSide = 2048,
  gutter = 2,
): { placed: Placed[]; width: number; height: number } {
  const order = [...items].sort(
    (a, b) =>
      b.image.height - a.image.height ||
      b.image.width - a.image.width ||
      a.name.localeCompare(b.name),
  );
  let best: { placed: Placed[]; width: number; height: number } | null = null;
  for (let width = 512; width <= maxSide; width += 32) {
    if (order.some((i) => i.image.width + 2 * gutter > width)) continue;
    let lo = 0;
    let hi = maxSide / 2;
    let found: Placed[] | null = null;
    while (lo < hi) {
      const mid = lo + Math.floor((hi - lo) / 2);
      const placed = maxRectsPack(order, width, mid * 2, gutter);
      if (placed) {
        found = placed;
        hi = mid;
      } else lo = mid + 1;
    }
    found = found ?? maxRectsPack(order, width, lo * 2, gutter);
    if (!found) continue;
    const height = lo * 2;
    if (!best || width * height < best.width * best.height) best = { placed: found, width, height };
  }
  if (!best) throw new Error('The sprites do not fit one page.');
  return best;
}
