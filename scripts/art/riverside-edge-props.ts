/**
 * Bake the riverside's painted edge stops into its painting, so that no
 * blocked cell that reads as open ground is left without something standing
 * on it (docs/art/riverside.md).
 *
 * Every stop is method (b) from the edge-prop prototype: an element cut out
 * of this painting (a fence, a rock, a stack of log rounds), laid on the
 * blocked cell with a soft shadow falling the way the painting's own shadows
 * fall, and relit where it moves from sunlight into canopy shade. Nothing
 * here is new art. The blocked cells are unreachable, so no one can stand
 * behind a stop and the props can live in the painting rather than as runtime
 * scenery.
 *
 * The bake starts from the unmodified painting in `art/source/ba-dan-riverside`
 * and writes the map's WebP through the same encode path as every map
 * painting (`paintingWebp` in map.ts, 40 px a tile at quality 88).
 *
 * Usage: node --import tsx scripts/art/riverside-edge-props.ts [--preview <png>]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { RIVERSIDE } from '../../src/content/maps/riverside';
import type { Image } from './lib/image';
import { newImage, readImage, writePng } from './lib/image';
import { paintingWebp } from './map';
import type { Bounds } from './lib/trim';

export const RIVERSIDE_SOURCE = 'art/source/ba-dan-riverside/painting.png';
export const RIVERSIDE_PROPS = 'art/source/ba-dan-riverside/props';
export const RIVERSIDE_OUTPUT = 'public/art/maps/ba_dan_riverside.webp';
export const RIVERSIDE_PX = 40;
export const RIVERSIDE_QUALITY = 88;

/** Where each cutout was cut from in the source painting (its README). */
export const CUTOUT_ORIGINS = {
  fence: { x: 150, y: 754 },
  'rock-left': { x: 150, y: 837 },
  'rock-small': { x: 326, y: 840 },
  logs: { x: 1377, y: 474 },
} as const;
export type CutoutId = keyof typeof CUTOUT_ORIGINS;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Something the painting draws in front of a stop, laid back over it. */
export type Occluder =
  /** A cutout re-laid at the place it was cut from. */
  | { readonly kind: 'cutout'; readonly cutout: CutoutId }
  /** The source painting inside a polygon, in painting pixels. */
  | { readonly kind: 'polygon'; readonly points: readonly Point[] };

export interface EdgeStop {
  readonly id: string;
  /** The blocked cells whose open-looking ground this stop explains. */
  readonly cells: readonly Point[];
  /** The walkable cell a party member stands on to see the stop. */
  readonly from: Point;
  readonly cutout: CutoutId;
  /** A column range of the cutout, when only part of it is used. */
  readonly columns?: readonly [number, number];
  readonly flip?: boolean;
  /** Where the cutout's bottom centre stands, in painting pixels. */
  readonly foot: Point;
  /**
   * The cast shadow: how dark, and how far it reaches along the ground for
   * each pixel of height. Null where the stop stands in shade already.
   */
  readonly shadow: { readonly strength: number; readonly reach: number } | null;
  /**
   * Relight from the ground the element was painted on to the ground it is
   * laid on, per channel, so a sunlit rock sits in canopy shade.
   */
  readonly relight?: { readonly from: Bounds; readonly to: Bounds };
  readonly front?: readonly Occluder[];
}

/**
 * The painting's own shadows fall to the left and a little down: the light
 * is warm afternoon from the upper right. A point `h` pixels up an element
 * lands `reach * h` to the left and a quarter of that lower.
 */
const SHADOW_DROP = 0.25;
const SHADOW_RGB = [46, 38, 22] as const;

export const EDGE_STOPS: readonly EdgeStop[] = [
  {
    // The lane north between the middle and north-east houses. Two bays of
    // the tea garden's front-facing rail close the gap; the north-east house
    // stands in front of the right-hand post.
    id: 'north-lane',
    cells: [
      { x: 15, y: 3 },
      { x: 16, y: 3 },
      { x: 17, y: 3 },
    ],
    from: { x: 15, y: 4 },
    cutout: 'fence',
    foot: { x: 647, y: 156 },
    shadow: { strength: 0.34, reach: 0.7 },
    front: [
      {
        kind: 'polygon',
        // The house's roof eave and west wall, traced on the painting.
        points: [
          { x: 651, y: 133 },
          { x: 654, y: 130 },
          { x: 664, y: 130 },
          { x: 676, y: 124 },
          { x: 688, y: 114 },
          { x: 700, y: 103 },
          { x: 760, y: 88 },
          { x: 760, y: 200 },
          { x: 668, y: 200 },
          { x: 668, y: 143 },
          { x: 660, y: 142 },
          { x: 654, y: 139 },
        ],
      },
    ],
  },
  {
    // The lane west past (10,3) continued at (9,2) behind the north-west
    // house's garden fence: one more bay of rail runs from the fence's end
    // post to the tree, and the end post stays in front of it.
    id: 'north-west-fence',
    cells: [{ x: 9, y: 2 }],
    from: { x: 10, y: 3 },
    cutout: 'fence',
    columns: [0, 45],
    foot: { x: 399, y: 116 },
    shadow: { strength: 0.34, reach: 0.7 },
    front: [
      {
        kind: 'polygon',
        points: [
          { x: 377, y: 104 },
          { x: 386, y: 104 },
          { x: 386, y: 142 },
          { x: 377, y: 142 },
        ],
      },
    ],
  },
  {
    // The west lane's end at the rim, deep in the canopy's shade.
    id: 'west-rim',
    cells: [{ x: 0, y: 6 }],
    from: { x: 1, y: 6 },
    cutout: 'rock-left',
    foot: { x: 20, y: 272 },
    shadow: null,
    relight: {
      from: { x: 140, y: 820, width: 100, height: 80 },
      to: { x: 0, y: 240, width: 40, height: 40 },
    },
  },
  {
    // The east clearing's rim past the banner fence: a second rank of log
    // rounds behind the painted ones makes a woodpile against the fence.
    id: 'east-rim',
    cells: [
      { x: 34, y: 12 },
      { x: 35, y: 12 },
    ],
    from: { x: 33, y: 12 },
    cutout: 'logs',
    foot: { x: 1391, y: 508 },
    shadow: { strength: 0.3, reach: 0.6 },
    front: [{ kind: 'cutout', cutout: 'logs' }],
  },
  {
    // The south-east bank path where it runs on under the canopy. A small
    // rock stands where the sand of (34,21) narrows between two trees, and
    // the right-hand tree's leaves are laid back over its corner: the canopy
    // is in front of the rock, as it is in front of the sand.
    id: 'south-east-bank',
    cells: [{ x: 34, y: 21 }],
    from: { x: 34, y: 20 },
    cutout: 'rock-small',
    foot: { x: 1369, y: 853 },
    shadow: { strength: 0.3, reach: 0.5 },
    front: [
      {
        kind: 'polygon',
        points: [
          { x: 1400, y: 835 },
          { x: 1394, y: 837 },
          { x: 1388, y: 840 },
          { x: 1386, y: 846 },
          { x: 1382, y: 851 },
          { x: 1374, y: 852 },
          { x: 1370, y: 855 },
          { x: 1367, y: 859 },
          { x: 1366, y: 866 },
          { x: 1368, y: 872 },
          { x: 1364, y: 877 },
          { x: 1361, y: 880 },
          { x: 1361, y: 890 },
          { x: 1400, y: 890 },
        ],
      },
    ],
  },
];

function copy(image: Image): Image {
  return { width: image.width, height: image.height, data: new Uint8Array(image.data) };
}

/** The part of a cutout a stop uses, mirrored if it asks. */
export function stopSprite(cutout: Image, stop: Pick<EdgeStop, 'columns' | 'flip'>): Image {
  const [x0, x1] = stop.columns ?? [0, cutout.width];
  const out = newImage(x1 - x0, cutout.height);
  for (let y = 0; y < cutout.height; y++)
    for (let x = 0; x < out.width; x++) {
      const sx = stop.flip ? x1 - 1 - x : x0 + x;
      const from = (y * cutout.width + sx) * 4;
      out.data.set(cutout.data.subarray(from, from + 4), (y * out.width + x) * 4);
    }
  return out;
}

/** Straight-alpha "over", with the source's top left at (left, top). */
function over(dst: Image, src: Image, left: number, top: number): void {
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const dx = left + x;
      const dy = top + y;
      if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
      const s = (y * src.width + x) * 4;
      const a = (src.data[s + 3] ?? 0) / 255;
      if (a === 0) continue;
      const d = (dy * dst.width + dx) * 4;
      for (let c = 0; c < 3; c++)
        dst.data[d + c] = Math.round((src.data[s + c] ?? 0) * a + (dst.data[d + c] ?? 0) * (1 - a));
      dst.data[d + 3] = 255;
    }
}

function meanChannel(image: Image, box: Bounds, channel: number): number {
  let sum = 0;
  for (let y = box.y; y < box.y + box.height; y++)
    for (let x = box.x; x < box.x + box.width; x++)
      sum += image.data[(y * image.width + x) * 4 + channel] ?? 0;
  return sum / (box.width * box.height);
}

/**
 * Scale each channel by how much darker (and cooler) the new ground is than
 * the ground the element was painted on, softened a little so a rock in
 * shade keeps some of its own light.
 */
export function relight(sprite: Image, source: Image, from: Bounds, to: Bounds): Image {
  const ratio = [0, 1, 2].map(
    (c) =>
      Math.min(1.2, Math.max(0.35, meanChannel(source, to, c) / meanChannel(source, from, c))) **
      0.9,
  );
  const out = copy(sprite);
  for (let i = 0; i < out.data.length; i += 4)
    for (let c = 0; c < 3; c++)
      out.data[i + c] = Math.min(255, Math.round((sprite.data[i + c] ?? 0) * (ratio[c] ?? 1)));
  return out;
}

/**
 * The element's shadow on flat ground, as an image the size of the sprite
 * plus `pad` on every side. Each pixel `h` rows above the base row falls
 * `reach * h` left and a quarter of that down; the result is softened by two
 * one-pixel box blurs, like the painting's soft shadow edges.
 */
export function castShadow(
  sprite: Image,
  strength: number,
  reach: number,
): { image: Image; pad: number } {
  const pad = Math.ceil(sprite.height * reach) + 3;
  const w = sprite.width + 2 * pad;
  const h = sprite.height + 2 * pad;
  let cover = new Float32Array(w * h);
  const base = sprite.height - 1;
  for (let y = 0; y < sprite.height; y++)
    for (let x = 0; x < sprite.width; x++) {
      const alpha = (sprite.data[(y * sprite.width + x) * 4 + 3] ?? 0) / 255;
      if (alpha === 0) continue;
      const up = base - y;
      const gx = Math.round(pad + x - reach * up);
      const gy = Math.round(pad + base + SHADOW_DROP * reach * up);
      const i = gy * w + gx;
      cover[i] = Math.max(cover[i] ?? 0, alpha);
    }
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) sum += cover[(y + dy) * w + x + dx] ?? 0;
        next[y * w + x] = sum / 9;
      }
    cover = next;
  }
  const image = newImage(w, h);
  for (let i = 0; i < w * h; i++) {
    image.data.set(SHADOW_RGB, i * 4);
    image.data[i * 4 + 3] = Math.round(255 * strength * Math.min(1, (cover[i] ?? 0) * 1.6));
  }
  return { image, pad };
}

function insidePolygon(points: readonly Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Where a stop's sprite lands: its top-left corner in painting pixels. */
export function spriteOrigin(sprite: Image, stop: EdgeStop): Point {
  return {
    x: Math.round(stop.foot.x - sprite.width / 2),
    y: Math.round(stop.foot.y - sprite.height),
  };
}

export type Cutouts = Readonly<Record<CutoutId, Image>>;

export function readCutouts(dir = RIVERSIDE_PROPS): Cutouts {
  return {
    fence: readImage(`${dir}/fence.png`),
    'rock-left': readImage(`${dir}/rock-left.png`),
    'rock-small': readImage(`${dir}/rock-small.png`),
    logs: readImage(`${dir}/logs.png`),
  };
}

/** The painting with every edge stop laid on it. */
export function bakeEdgeProps(
  source: Image,
  cutouts: Cutouts,
  stops: readonly EdgeStop[] = EDGE_STOPS,
): Image {
  const out = copy(source);
  for (const stop of stops) {
    let sprite = stopSprite(cutouts[stop.cutout], stop);
    if (stop.relight) sprite = relight(sprite, source, stop.relight.from, stop.relight.to);
    const at = spriteOrigin(sprite, stop);
    if (stop.shadow) {
      const shadow = castShadow(sprite, stop.shadow.strength, stop.shadow.reach);
      over(out, shadow.image, at.x - shadow.pad, at.y - shadow.pad);
    }
    over(out, sprite, at.x, at.y);
    for (const front of stop.front ?? []) {
      if (front.kind === 'cutout') {
        const origin = CUTOUT_ORIGINS[front.cutout];
        over(out, cutouts[front.cutout], origin.x, origin.y);
        continue;
      }
      const xs = front.points.map((p) => p.x);
      const ys = front.points.map((p) => p.y);
      for (let y = Math.min(...ys); y <= Math.max(...ys); y++)
        for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
          if (!insidePolygon(front.points, x + 0.5, y + 0.5)) continue;
          const i = (y * out.width + x) * 4;
          out.data.set(source.data.subarray(i, i + 4), i);
        }
    }
  }
  return out;
}

export async function bakeRiverside(): Promise<{ image: Image; bytes: Uint8Array }> {
  const image = bakeEdgeProps(readImage(RIVERSIDE_SOURCE), readCutouts());
  const bytes = await paintingWebp(image, RIVERSIDE, RIVERSIDE_PX, RIVERSIDE_QUALITY);
  return { image, bytes };
}

async function main(): Promise<void> {
  const { image, bytes } = await bakeRiverside();
  mkdirSync(dirname(RIVERSIDE_OUTPUT), { recursive: true });
  writeFileSync(RIVERSIDE_OUTPUT, bytes);
  const preview = process.argv.indexOf('--preview');
  const previewPath = preview >= 0 ? process.argv[preview + 1] : undefined;
  if (previewPath) writePng(previewPath, image);
  console.log(
    JSON.stringify({ output: RIVERSIDE_OUTPUT, bytes: bytes.length, stops: EDGE_STOPS.length }),
  );
}

if (process.argv[1]?.endsWith('riverside-edge-props.ts')) await main();
